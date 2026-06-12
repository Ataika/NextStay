"""Hotel simulator FastAPI app: mini booking site + JSON API + PMS webhook receiver."""

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from hotelsim import config
from hotelsim.pms_client import build_event, send_event
from hotelsim.signing import verify_signature
from hotelsim.store import Store

_DEFAULT_SEED = [("101", "Standard", 100.0), ("102", "Deluxe", 150.0), ("201", "Suite", 250.0)]
_STATIC_DIR = Path(__file__).parent / "static"


class BookRequest(BaseModel):
    roomNumber: str
    guestName: str
    guestEmail: str | None = None
    checkIn: str
    checkOut: str
    amountPaid: float | None = None


def create_app(db_path: str | None = None) -> FastAPI:
    app = FastAPI(title="NextStay Hotel Simulator")
    store = Store(db_path if db_path is not None else config.DB_PATH)
    store.init_schema()
    store.seed_rooms(_DEFAULT_SEED)
    app.state.store = store

    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        index_file = _STATIC_DIR / "index.html"
        if index_file.exists():
            return index_file.read_text(encoding="utf-8")
        return "<h1>NextStay Hotel Simulator</h1>"

    @app.get("/api/rooms")
    def api_rooms():
        return store.list_rooms()

    @app.get("/api/bookings")
    def api_bookings():
        return store.list_bookings()

    @app.get("/api/events")
    def api_events():
        return store.list_inbound_events()

    @app.post("/api/book")
    def api_book(req: BookRequest):
        external_id = store.create_booking(req.roomNumber, req.guestName, req.guestEmail, req.checkIn, req.checkOut)
        event = build_event(
            "booking_created",
            external_booking_id=external_id,
            room_number=req.roomNumber,
            guest_name=req.guestName,
            guest_email=req.guestEmail,
            check_in=req.checkIn,
            check_out=req.checkOut,
            amount_paid=req.amountPaid,
        )
        send_event(event)
        return {"externalBookingId": external_id, "status": "active"}

    @app.post("/api/cancel/{external_id}")
    def api_cancel(external_id: str):
        if not store.cancel_booking(external_id):
            raise HTTPException(status_code=404, detail="Booking not found")
        send_event(build_event("booking_cancelled", external_booking_id=external_id))
        return {"externalBookingId": external_id, "status": "cancelled"}

    @app.post("/webhook")
    async def webhook(request: Request):
        raw_body = await request.body()
        signature = request.headers.get("X-NextStay-Signature")
        if not verify_signature(raw_body, config.HMAC_SECRET, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
        event = json.loads(raw_body)
        store.apply_inbound_event(event)
        return {"status": "ok"}

    return app


app = create_app()
