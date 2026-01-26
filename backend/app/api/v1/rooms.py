from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.room import Room as RoomModel

router = APIRouter(tags=["rooms"])


# Dependency для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models для запросов/ответов
class RoomBase(BaseModel):
    number: str
    category: str
    status: str
    price: float
    capacity: int
    description: Optional[str] = None
    amenities: Optional[List[str]] = None


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    number: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    price: Optional[float] = None
    capacity: Optional[int] = None
    description: Optional[str] = None
    amenities: Optional[List[str]] = None


class Room(RoomBase):
    id: int

    class Config:
        from_attributes = True


# CRUD операции
@router.get("/rooms", response_model=List[Room])
def get_all_rooms(db: Session = Depends(get_db)):
    """Получить все комнаты"""
    rooms = db.query(RoomModel).all()
    return rooms


@router.get("/rooms/{room_id}", response_model=Room)
def get_room_by_id(room_id: int, db: Session = Depends(get_db)):
    """Получить комнату по ID"""
    room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.post("/rooms", response_model=Room, status_code=201)
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    """Создать новую комнату"""
    # Проверка на уникальность номера комнаты
    existing_room = db.query(RoomModel).filter(RoomModel.number == room.number).first()
    if existing_room:
        raise HTTPException(status_code=400, detail="Room with this number already exists")
    
    db_room = RoomModel(
        number=room.number,
        category=room.category,
        status=room.status,
        price=room.price,
        capacity=room.capacity,
        description=room.description,
        amenities=room.amenities
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room


@router.patch("/rooms/{room_id}", response_model=Room)
def update_room(room_id: int, room_update: RoomUpdate, db: Session = Depends(get_db)):
    """Обновить комнату"""
    db_room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Проверка на уникальность номера, если он изменяется
    if room_update.number and room_update.number != db_room.number:
        existing_room = db.query(RoomModel).filter(RoomModel.number == room_update.number).first()
        if existing_room:
            raise HTTPException(status_code=400, detail="Room with this number already exists")
    
    # Обновление полей
    update_data = room_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_room, field, value)
    
    db.commit()
    db.refresh(db_room)
    return db_room


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    """Удалить комнату"""
    db_room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    db.delete(db_room)
    db.commit()
    return None
