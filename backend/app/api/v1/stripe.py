import stripe
from app.core.config import FRONTEND_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
from app.core.logging import get_logger
from app.core.utils import count_stay_nights
from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.payment import Payment as PaymentModel
from app.models.room import Room as RoomModel
from app.models.user import User as UserModel
from app.services.email_service import send_booking_confirmation_to_guest, send_booking_notification_to_owner
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(tags=["stripe"])
logger = get_logger(__name__)

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CreateCheckoutSessionRequest(BaseModel):
    booking_id: int


class CreateCheckoutSessionResponse(BaseModel):
    session_id: str
    url: str


@router.post("/stripe/create-checkout-session", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(request: CreateCheckoutSessionRequest, db: Session = Depends(get_db)):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured. Please set STRIPE_SECRET_KEY.")

    booking = db.query(BookingModel).filter(BookingModel.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != "Pending":
        raise HTTPException(
            status_code=400, detail=f"Booking is already {booking.status}. Cannot create checkout session."
        )

    room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    nights = count_stay_nights(booking.check_in, booking.check_out)
    total_amount = room.price * nights

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"Room {booking.room_number} - NextStay",
                            "description": (
                                f"Booking from {booking.check_in.date()} "
                                f"to {booking.check_out.date()} ({nights} nights)"
                            ),
                        },
                        "unit_amount": int(total_amount * 100),
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=f"{FRONTEND_URL}/booking/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/booking/cancel?booking_id={booking.id}",
            metadata={
                "booking_id": str(booking.id),
                "room_number": booking.room_number,
                "guest_name": booking.guest_name,
            },
            customer_email=booking.guest_email if booking.guest_email else None,
            idempotency_key=f"checkout-booking-{booking.id}",
        )

        booking.stripe_session_id = checkout_session.id
        db.commit()

        return CreateCheckoutSessionResponse(session_id=checkout_session.id, url=checkout_session.url)
    except stripe.error.StripeError as err:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(err)}") from err


@router.get("/stripe/confirm-and-get-booking")
def confirm_and_get_booking(session_id: str, db: Session = Depends(get_db)):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured. Please set STRIPE_SECRET_KEY.")
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as err:
        raise HTTPException(status_code=400, detail=f"Invalid session: {str(err)}") from err

    payment_status = getattr(session, "payment_status", None)
    if payment_status != "paid":
        raise HTTPException(status_code=400, detail="Payment not completed for this session.")

    metadata = getattr(session, "metadata", None) or {}
    booking_id_raw = metadata.get("booking_id") if isinstance(metadata, dict) else getattr(metadata, "booking_id", None)
    if not booking_id_raw:
        raise HTTPException(status_code=400, detail="Booking reference missing from Stripe session.")
    booking_id = int(booking_id_raw)

    booking = db.query(BookingModel).filter(BookingModel.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == "Pending":
        booking.status = "Confirmed"
        booking.stripe_payment_intent_id = getattr(session, "payment_intent", None)
        amount_total = getattr(session, "amount_total", None) or 0
        booking.amount_paid = amount_total / 100
        room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
        if room:
            nights = count_stay_nights(booking.check_in, booking.check_out)
            booking.amount_paid = room.price * nights
        db.commit()
        db.refresh(booking)
    from app.api.v1.bookings import Booking

    return Booking.from_orm_with_dates(booking, include_token=True, db=db)


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    stripe_signature: str | None = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook secret is not configured")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(err)}") from err
    except stripe.error.SignatureVerificationError as err:
        raise HTTPException(status_code=400, detail=f"Invalid signature: {str(err)}") from err

    # Record every incoming event for audit + idempotency. A redelivered event
    # (same event id) updates the existing audit row instead of duplicating it.
    payment = record_payment_event(event, db)

    if event["type"] == "checkout.session.completed":
        try:
            handle_checkout_session_completed(event["data"]["object"], db, background_tasks)
        except Exception as exc:  # noqa: BLE001 — keep the audit row, surface for Stripe retry
            payment.error_message = str(exc)
            db.commit()
            logger.exception("Stripe webhook handler failed for event %s", event.get("id"))
            raise HTTPException(status_code=500, detail="Webhook handler error") from exc

    return {"status": "success"}


def _derive_hotel_id(db: Session, booking_id: int | None) -> tuple[int | None, int | None]:
    """Return (booking_id, hotel_id) — hotel_id derived from the booking's room."""
    if not booking_id:
        return None, None
    booking = db.query(BookingModel).filter(BookingModel.id == booking_id).first()
    if not booking:
        # Booking gone — don't store a dangling FK; the id is still in payload for audit.
        return None, None
    room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
    return booking_id, (room.hotel_id if room else None)


def record_payment_event(event: dict, db: Session) -> PaymentModel:
    """Upsert a Payment audit row keyed by the Stripe event id (idempotent)."""
    event_id = event["id"]
    obj = event.get("data", {}).get("object", {}) or {}
    metadata = obj.get("metadata") or {}
    raw_booking_id = metadata.get("booking_id")
    booking_id = int(raw_booking_id) if raw_booking_id else None
    booking_id, hotel_id = _derive_hotel_id(db, booking_id)

    customer_email = (obj.get("customer_details") or {}).get("email") or obj.get("customer_email")
    fields = dict(
        event_type=event.get("type"),
        booking_id=booking_id,
        hotel_id=hotel_id,
        stripe_session_id=obj.get("id") if str(event.get("type", "")).startswith("checkout.session") else None,
        stripe_payment_intent_id=obj.get("payment_intent"),
        payment_status=obj.get("payment_status") or obj.get("status"),
        currency=obj.get("currency"),
        amount_total_cents=obj.get("amount_total"),
        customer_email=customer_email,
        payload=event,
    )

    payment = db.query(PaymentModel).filter(PaymentModel.stripe_event_id == event_id).first()
    if payment:
        for key, value in fields.items():
            setattr(payment, key, value)
    else:
        payment = PaymentModel(stripe_event_id=event_id, **fields)
        db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def handle_checkout_session_completed(session: dict, db: Session, background_tasks: BackgroundTasks):
    booking_id = int(session["metadata"]["booking_id"])
    booking = db.query(BookingModel).filter(BookingModel.id == booking_id).first()

    if not booking:
        # Permanent condition (booking gone) — nothing to retry; audit row already records the event.
        logger.warning("Stripe webhook: booking %d not found.", booking_id)
        return

    if booking.status == "Confirmed":
        # Idempotent: a redelivered event must not re-confirm or re-send emails.
        logger.info("Booking %d already confirmed; skipping (idempotent).", booking_id)
        return

    booking.status = "Confirmed"
    booking.stripe_payment_intent_id = session.get("payment_intent")
    booking.amount_paid = session.get("amount_total", 0) / 100

    room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
    if room:
        nights = count_stay_nights(booking.check_in, booking.check_out)
        booking.amount_paid = room.price * nights

    db.commit()
    db.refresh(booking)

    if booking.guest_email:
        from app.models.guest_token import GuestToken as GuestTokenModel

        guest_token = db.query(GuestTokenModel).filter(GuestTokenModel.booking_id == booking.id).first()
        token = guest_token.token if guest_token else None

        # Resolve owner email from DB instead of hardcoding
        owner = db.query(UserModel).filter(UserModel.role == "OWNER", UserModel.is_active.is_(True)).first()
        owner_email = owner.email if owner else "owner@nextstay.com"

        background_tasks.add_task(
            send_booking_confirmation_to_guest,
            guest_email=booking.guest_email,
            guest_name=booking.guest_name,
            room_number=booking.room_number,
            check_in=booking.check_in.strftime("%B %d, %Y"),
            check_out=booking.check_out.strftime("%B %d, %Y"),
            total_amount=booking.amount_paid or 0,
            guest_token=token or "",
        )
        background_tasks.add_task(
            send_booking_notification_to_owner,
            owner_email=owner_email,
            guest_name=booking.guest_name,
            guest_email=booking.guest_email or "",
            room_number=booking.room_number,
            check_in=booking.check_in.strftime("%B %d, %Y"),
            check_out=booking.check_out.strftime("%B %d, %Y"),
            total_amount=booking.amount_paid or 0,
        )

    logger.info("Booking %d confirmed via Stripe webhook.", booking_id)
