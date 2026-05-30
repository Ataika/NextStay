import stripe
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Optional

from app.core.config import FRONTEND_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.payment import Payment as PaymentModel
from app.models.room import Room as RoomModel
from app.services.email_service import (
    send_booking_confirmation_to_guest,
    send_booking_notification_to_owner,
)

router = APIRouter(tags=["stripe"])

# Initialize Stripe
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models
class CreateCheckoutSessionRequest(BaseModel):
    booking_id: int


class CreateCheckoutSessionResponse(BaseModel):
    session_id: str
    url: str


def _upsert_payment_from_session(
    db: Session,
    booking: BookingModel,
    session: dict[str, Any],
    event_type: str,
    stripe_event_id: Optional[str] = None,
):
    """Persist Stripe checkout session state into oltp.payments."""
    stripe_session_id = session.get("id")
    stripe_payment_intent_id = session.get("payment_intent")

    payment = None
    if stripe_event_id:
        payment = (
            db.query(PaymentModel)
            .filter(PaymentModel.stripe_event_id == stripe_event_id)
            .first()
        )
    if not payment and stripe_session_id:
        payment = (
            db.query(PaymentModel)
            .filter(PaymentModel.stripe_session_id == stripe_session_id)
            .order_by(PaymentModel.id.desc())
            .first()
        )
    if not payment and stripe_payment_intent_id:
        payment = (
            db.query(PaymentModel)
            .filter(PaymentModel.stripe_payment_intent_id == stripe_payment_intent_id)
            .order_by(PaymentModel.id.desc())
            .first()
        )

    if not payment:
        payment = PaymentModel(booking_id=booking.id)
        db.add(payment)

    payment.stripe_event_id = stripe_event_id
    payment.event_type = event_type
    payment.stripe_session_id = stripe_session_id
    payment.stripe_payment_intent_id = stripe_payment_intent_id
    payment.payment_status = session.get("payment_status")
    payment.currency = session.get("currency")
    payment.amount_total_cents = session.get("amount_total")
    payment.customer_email = (
        session.get("customer_email")
        or (session.get("customer_details") or {}).get("email")
        or booking.guest_email
    )
    payment.payload = session
    payment.company_code = getattr(booking, "company_code", None)


def _upsert_payment_from_payment_intent(
    db: Session,
    booking: Optional[BookingModel],
    payment_intent: dict[str, Any],
    event_type: str,
    stripe_event_id: Optional[str] = None,
):
    """Persist Stripe payment_intent state into oltp.payments."""
    stripe_payment_intent_id = payment_intent.get("id")
    payment = None
    if stripe_event_id:
        payment = (
            db.query(PaymentModel)
            .filter(PaymentModel.stripe_event_id == stripe_event_id)
            .first()
        )
    if not payment and stripe_payment_intent_id:
        payment = (
            db.query(PaymentModel)
            .filter(PaymentModel.stripe_payment_intent_id == stripe_payment_intent_id)
            .order_by(PaymentModel.id.desc())
            .first()
        )

    if not payment:
        if not booking:
            return
        payment = PaymentModel(booking_id=booking.id)
        db.add(payment)

    payment.stripe_event_id = stripe_event_id
    payment.event_type = event_type
    payment.stripe_payment_intent_id = stripe_payment_intent_id
    payment.payment_status = payment_intent.get("status")
    payment.currency = payment_intent.get("currency")
    payment.amount_total_cents = payment_intent.get("amount")
    payment.customer_email = payment.customer_email or (booking.guest_email if booking else None)
    payment.payload = payment_intent
    if booking:
        payment.company_code = getattr(booking, "company_code", None)


@router.post("/stripe/create-checkout-session", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    db: Session = Depends(get_db)
):
    """
    Create Stripe Checkout session for booking payment
    """
    # Debug log to verify Stripe config at runtime
    print(f"[STRIPE DEBUG] STRIPE_SECRET_KEY set: {bool(STRIPE_SECRET_KEY)}")

    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="Stripe is not configured. Please set STRIPE_SECRET_KEY."
        )

    # Get booking
    booking = db.query(BookingModel).filter(BookingModel.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != "Pending":
        raise HTTPException(
            status_code=400,
            detail=f"Booking is already {booking.status}. Cannot create checkout session."
        )

    # Get room for price calculation
    room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Calculate number of nights and total amount
    nights = (booking.check_out - booking.check_in).days
    total_amount = room.price * nights

    # Create Stripe Checkout Session
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"Room {booking.room_number} - NextStay",
                            "description": f"Booking from {booking.check_in.date()} to {booking.check_out.date()} ({nights} nights)",
                        },
                        "unit_amount": int(total_amount * 100),  # Stripe uses cents
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
        )

        # Save session_id in booking
        booking.stripe_session_id = checkout_session.id
        _upsert_payment_from_session(
            db=db,
            booking=booking,
            session=checkout_session,
            event_type="checkout.session.created",
        )
        db.commit()

        return CreateCheckoutSessionResponse(
            session_id=checkout_session.id,
            url=checkout_session.url
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")


@router.get("/stripe/confirm-and-get-booking")
def confirm_and_get_booking(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Via session_id Stripe checks payment, if necessary converts booking to Confirmed
    and returns booking with guest token. Used on success page after payment
    (when webhook is not called locally).
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="Stripe is not configured. Please set STRIPE_SECRET_KEY."
        )
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid session: {str(e)}")
    if session.get("payment_status") != "paid":
        raise HTTPException(
            status_code=400,
            detail="Payment not completed for this session."
        )
    booking_id = int(session["metadata"]["booking_id"])
    booking = db.query(BookingModel).filter(BookingModel.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # If still Pending, confirm (as in webhook), without sending email
    if booking.status == "Pending":
        booking.status = "Confirmed"
        booking.stripe_payment_intent_id = session.get("payment_intent")
        booking.amount_paid = (session.get("amount_total") or 0) / 100
        room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
        if room:
            nights = (booking.check_out - booking.check_in).days
            booking.amount_paid = room.price * nights
    _upsert_payment_from_session(
        db=db,
        booking=booking,
        session=session,
        event_type="checkout.session.confirmed",
    )
    db.commit()
    db.refresh(booking)
    # Return booking with guest token in the same format as GET /bookings/{id}
    from app.api.v1.bookings import Booking
    return Booking.from_orm_with_dates(booking, include_token=True, db=db)


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhook for payment confirmation
    """
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Stripe webhook secret is not configured"
        )

    payload = await request.body()

    try:
        # Check webhook signature
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail=f"Invalid signature: {str(e)}")

    # Handle event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        handle_checkout_session_completed(
            session=session,
            db=db,
            background_tasks=background_tasks,
            stripe_event_id=event.get("id"),
            event_type=event["type"],
        )
    elif event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        handle_payment_intent_succeeded(
            payment_intent=payment_intent,
            db=db,
            stripe_event_id=event.get("id"),
            event_type=event["type"],
        )

    return {"status": "success"}


def handle_checkout_session_completed(
    session: dict,
    db: Session,
    background_tasks: BackgroundTasks,
    stripe_event_id: Optional[str] = None,
    event_type: str = "checkout.session.completed",
):
    """Handle completed checkout session"""
    booking_id = int(session["metadata"]["booking_id"])
    booking = db.query(BookingModel).filter(BookingModel.id == booking_id).first()

    if not booking:
        print(f"[STRIPE] Booking {booking_id} not found")
        return

    # Update booking status
    booking.status = "Confirmed"
    booking.stripe_payment_intent_id = session.get("payment_intent")
    booking.amount_paid = session.get("amount_total", 0) / 100  # Convert from cents

    # Get room for price calculation
    room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
    if room:
        nights = (booking.check_out - booking.check_in).days
        booking.amount_paid = room.price * nights

    _upsert_payment_from_session(
        db=db,
        booking=booking,
        session=session,
        event_type=event_type,
        stripe_event_id=stripe_event_id,
    )
    db.commit()
    db.refresh(booking)

    # Send email notification
    if booking.guest_email:
        from app.models.guest_token import GuestToken as GuestTokenModel
        guest_token = db.query(GuestTokenModel).filter(
            GuestTokenModel.booking_id == booking.id
        ).first()

        token = guest_token.token if guest_token else None

        # Send email via background tasks (do not block webhook)
        background_tasks.add_task(
            send_booking_confirmation_to_guest,
            guest_email=booking.guest_email,
            guest_name=booking.guest_name,
            room_number=booking.room_number,
            check_in=booking.check_in.strftime("%B %d, %Y"),
            check_out=booking.check_out.strftime("%B %d, %Y"),
            total_amount=booking.amount_paid or 0,
            guest_token=token or ""
        )

        # Send notification to owner (can be obtained from settings or use default email)
        owner_email = "owner@nextstay.com"  # TODO: get from settings or use default email
        background_tasks.add_task(
            send_booking_notification_to_owner,
            owner_email=owner_email,
            guest_name=booking.guest_name,
            guest_email=booking.guest_email or "",
            room_number=booking.room_number,
            check_in=booking.check_in.strftime("%B %d, %Y"),
            check_out=booking.check_out.strftime("%B %d, %Y"),
            total_amount=booking.amount_paid or 0
        )

    print(f"[STRIPE] Booking {booking_id} confirmed successfully")


def handle_payment_intent_succeeded(
    payment_intent: dict,
    db: Session,
    stripe_event_id: Optional[str] = None,
    event_type: str = "payment_intent.succeeded",
):
    """Handle successful payment and persist event payload."""
    booking = None
    metadata = payment_intent.get("metadata") or {}
    booking_id = metadata.get("booking_id")
    if booking_id:
        booking = db.query(BookingModel).filter(BookingModel.id == int(booking_id)).first()
    else:
        payment = (
            db.query(PaymentModel)
            .filter(PaymentModel.stripe_payment_intent_id == payment_intent.get("id"))
            .order_by(PaymentModel.id.desc())
            .first()
        )
        if payment:
            booking = db.query(BookingModel).filter(BookingModel.id == payment.booking_id).first()

    if booking and booking.status == "Pending":
        booking.status = "Confirmed"
        booking.stripe_payment_intent_id = payment_intent.get("id")
        booking.amount_paid = (payment_intent.get("amount_received") or payment_intent.get("amount") or 0) / 100

    _upsert_payment_from_payment_intent(
        db=db,
        booking=booking,
        payment_intent=payment_intent,
        event_type=event_type,
        stripe_event_id=stripe_event_id,
    )
    db.commit()
