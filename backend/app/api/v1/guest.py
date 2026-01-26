from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.session import SessionLocal
from app.models.guest_token import GuestToken as GuestTokenModel
from app.models.booking import Booking as BookingModel
from app.models.room import Room as RoomModel
from app.models.task import CleaningTask as TaskModel

router = APIRouter(tags=["guest"])


# Dependency для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models
class WiFiInfo(BaseModel):
    ssid: str
    password: str


class ContactInfo(BaseModel):
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None


class Instructions(BaseModel):
    accessInfo: str
    activeFrom: str
    activeUntil: str
    doorTroubleshooting: str


class HouseRules(BaseModel):
    quietHours: str
    checkOutTime: str
    smokingPolicy: str


class GuestToken(BaseModel):
    token: str
    bookingId: int
    roomId: int
    roomNumber: str
    guestName: str
    checkIn: str
    checkOut: str
    isValid: bool
    accessStatus: str
    wifi: WiFiInfo
    contact: ContactInfo
    instructions: Instructions
    houseRules: Optional[HouseRules] = None


# CRUD операции
@router.get("/guest/{token}", response_model=GuestToken)
def get_guest_by_token(token: str, db: Session = Depends(get_db)):
    """Получить данные гостя по токену"""
    guest_token = db.query(GuestTokenModel).filter(GuestTokenModel.token == token).first()
    
    if not guest_token:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    # Проверка валидности токена
    if not guest_token.is_valid:
        raise HTTPException(status_code=404, detail="Token is no longer valid")
    
    # Проверка срока действия
    from datetime import timezone
    now = datetime.now(timezone.utc) if guest_token.check_out.tzinfo else datetime.now()
    check_out_time = guest_token.check_out
    if check_out_time.tzinfo is None:
        # Если нет временной зоны, считаем что это UTC
        check_out_time = check_out_time.replace(tzinfo=timezone.utc)
    
    if now > check_out_time:
        guest_token.access_status = "Expired"
        guest_token.is_valid = False
        db.commit()
        raise HTTPException(status_code=404, detail="Token has expired")
    
    # Формирование ответа
    return GuestToken(
        token=guest_token.token,
        bookingId=guest_token.booking_id,
        roomId=guest_token.room_id,
        roomNumber=guest_token.room_number,
        guestName=guest_token.guest_name,
        checkIn=guest_token.check_in.isoformat(),
        checkOut=guest_token.check_out.isoformat(),
        isValid=guest_token.is_valid,
        accessStatus=guest_token.access_status,
        wifi=WiFiInfo(
            ssid=guest_token.wifi_ssid,
            password=guest_token.wifi_password
        ),
        contact=ContactInfo(**guest_token.contact_info) if guest_token.contact_info else ContactInfo(),
        instructions=Instructions(**guest_token.instructions) if guest_token.instructions else Instructions(
            accessInfo="",
            activeFrom="",
            activeUntil="",
            doorTroubleshooting=""
        ),
        houseRules=HouseRules(**guest_token.house_rules) if guest_token.house_rules else None
    )


@router.post("/guest/{token}/checkout")
def checkout_guest(token: str, db: Session = Depends(get_db)):
    """Обработать выезд гостя: обновить статус бронирования, комнаты и создать задачу уборки"""
    guest_token = db.query(GuestTokenModel).filter(GuestTokenModel.token == token).first()
    
    if not guest_token or not guest_token.is_valid:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    # Обновление статуса токена
    guest_token.is_valid = False
    guest_token.access_status = "Checked out"
    
    # Обновление статуса бронирования
    booking = db.query(BookingModel).filter(BookingModel.id == guest_token.booking_id).first()
    if booking:
        booking.status = "Checked-out"
    
    # Обновление статуса комнаты на "Dirty"
    room = db.query(RoomModel).filter(RoomModel.id == guest_token.room_id).first()
    if room:
        room.status = "Dirty"
        
        # Создание задачи уборки
        cleaning_task = TaskModel(
            room_id=room.id,
            room_number=room.number,
            status="Pending",
            priority="High",
            notes=f"Cleaning after checkout - Guest: {guest_token.guest_name}"
        )
        db.add(cleaning_task)
    
    db.commit()
    
    return {"message": "Checkout completed successfully", "roomNumber": guest_token.room_number}
