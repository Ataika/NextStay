from fastapi import APIRouter, HTTPException, Depends, Request, Header, BackgroundTasks
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
import stripe
from datetime import datetime
from app.db.session import SessionLocal
from app.models.booking import Booking as BookingModel
from app.models.room import Room as RoomModel
from app.core.config import (
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    FRONTEND_URL
)
from app.services.email_service import (
    send_booking_confirmation_to_guest,
    send_booking_notification_to_owner
)

router = APIRouter(tags=["stripe"])

# Initialize Stripe
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# Dependency для получения сессии БД
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


@router.post("/stripe/create-checkout-session", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    db: Session = Depends(get_db)
):
    """
    Создать Stripe Checkout сессию для оплаты бронирования
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="Stripe is not configured. Please set STRIPE_SECRET_KEY."
        )
    
    # Получаем бронирование
    booking = db.query(BookingModel).filter(BookingModel.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status != "Pending":
        raise HTTPException(
            status_code=400,
            detail=f"Booking is already {booking.status}. Cannot create checkout session."
        )
    
    # Получаем комнату для расчета цены
    room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Вычисляем количество ночей и общую стоимость
    nights = (booking.check_out - booking.check_in).days
    total_amount = room.price * nights
    
    # Создаем Stripe Checkout Session
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
                        "unit_amount": int(total_amount * 100),  # Stripe использует центы
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
        
        # Сохраняем session_id в бронировании
        booking.stripe_session_id = checkout_session.id
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
    По session_id Stripe проверяет оплату, при необходимости переводит бронь в Confirmed
    и возвращает бронирование с guest token. Используется на странице успеха после оплаты
    (когда webhook локально не вызывается).
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
    # Если ещё Pending — подтверждаем (как в webhook), без рассылки email
    if booking.status == "Pending":
        booking.status = "Confirmed"
        booking.stripe_payment_intent_id = session.get("payment_intent")
        booking.amount_paid = (session.get("amount_total") or 0) / 100
        room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
        if room:
            nights = (booking.check_out - booking.check_in).days
            booking.amount_paid = room.price * nights
        db.commit()
        db.refresh(booking)
    # Возвращаем бронирование с guest token в том же формате, что и GET /bookings/{id}
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
    Обработка webhook от Stripe для подтверждения платежей
    """
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Stripe webhook secret is not configured"
        )
    
    payload = await request.body()
    
    try:
        # Проверяем подпись webhook
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail=f"Invalid signature: {str(e)}")
    
    # Обрабатываем событие
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        handle_checkout_session_completed(session, db, background_tasks)
    elif event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        handle_payment_intent_succeeded(payment_intent, db)
    
    return {"status": "success"}


def handle_checkout_session_completed(session: dict, db: Session, background_tasks: BackgroundTasks):
    """Обработка завершенной checkout сессии"""
    booking_id = int(session["metadata"]["booking_id"])
    booking = db.query(BookingModel).filter(BookingModel.id == booking_id).first()
    
    if not booking:
        print(f"[STRIPE] Booking {booking_id} not found")
        return
    
    # Обновляем статус бронирования
    booking.status = "Confirmed"
    booking.stripe_payment_intent_id = session.get("payment_intent")
    booking.amount_paid = session.get("amount_total", 0) / 100  # Конвертируем из центов
    
    # Получаем комнату для расчета
    room = db.query(RoomModel).filter(RoomModel.id == booking.room_id).first()
    if room:
        nights = (booking.check_out - booking.check_in).days
        booking.amount_paid = room.price * nights
    
    db.commit()
    db.refresh(booking)
    
    # Отправляем email уведомления
    if booking.guest_email:
        from app.models.guest_token import GuestToken as GuestTokenModel
        guest_token = db.query(GuestTokenModel).filter(
            GuestTokenModel.booking_id == booking.id
        ).first()
        
        token = guest_token.token if guest_token else None
        
        # Отправляем email через background tasks (не блокируем webhook)
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
        
        # Отправляем уведомление владельцу (можно получить из настроек или использовать дефолтный email)
        owner_email = "owner@nextstay.com"  # TODO: получить из настроек Property
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


def handle_payment_intent_succeeded(payment_intent: dict, db: Session):
    """Обработка успешного платежа (backup handler)"""
    # Если checkout.session.completed уже обработал, этот handler не нужен
    # Но оставляем для надежности
    pass
