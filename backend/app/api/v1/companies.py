from app.db.session import SessionLocal
from app.models.company import Company as CompanyModel
from app.models.hotel import Hotel as HotelModel
from app.security.auth import require_roles
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(tags=["companies"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CompanyCreate(BaseModel):
    code: str
    name: str


class CompanyResponse(BaseModel):
    id: int
    code: str
    name: str
    hotelCount: int


class HotelBrief(BaseModel):
    id: int
    code: str
    name: str


def _to_response(db: Session, company: CompanyModel) -> CompanyResponse:
    count = db.query(HotelModel).filter(HotelModel.company_id == company.id).count()
    return CompanyResponse(id=company.id, code=company.code, name=company.name, hotelCount=count)


@router.get("/companies", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    companies = db.query(CompanyModel).order_by(CompanyModel.name).all()
    return [_to_response(db, c) for c in companies]


@router.post("/companies", response_model=CompanyResponse, status_code=201)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db), _user=Depends(require_roles("OWNER"))):
    if db.query(CompanyModel).filter(CompanyModel.code == payload.code).first():
        raise HTTPException(status_code=409, detail="Company code already exists")
    company = CompanyModel(code=payload.code, name=payload.name)
    db.add(company)
    db.commit()
    db.refresh(company)
    return _to_response(db, company)


@router.get("/companies/{company_id}/hotels", response_model=list[HotelBrief])
def company_hotels(company_id: int, db: Session = Depends(get_db)):
    if not db.query(CompanyModel).filter(CompanyModel.id == company_id).first():
        raise HTTPException(status_code=404, detail="Company not found")
    hotels = db.query(HotelModel).filter(HotelModel.company_id == company_id).order_by(HotelModel.name).all()
    return [HotelBrief(id=h.id, code=h.code, name=h.name) for h in hotels]


@router.post("/companies/{company_id}/hotels/{hotel_id}", response_model=HotelBrief)
def assign_hotel(
    company_id: int,
    hotel_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("OWNER")),
):
    company = db.query(CompanyModel).filter(CompanyModel.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    hotel = db.query(HotelModel).filter(HotelModel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    hotel.company_id = company_id
    db.commit()
    db.refresh(hotel)
    return HotelBrief(id=hotel.id, code=hotel.code, name=hotel.name)
