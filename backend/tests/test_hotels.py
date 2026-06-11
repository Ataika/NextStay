def test_hotel_model_persists(db):
    from app.models.hotel import Hotel

    hotel = Hotel(
        code="GRAND_BISHKEK",
        name="Grand Bishkek",
        webhook_url="http://hotelsim:8090/webhook",
        hmac_secret="secret-123",
        active=True,
    )
    db.add(hotel)
    db.commit()
    db.refresh(hotel)

    assert hotel.id is not None
    assert hotel.code == "GRAND_BISHKEK"
    assert hotel.active is True
    assert hotel.created_at is not None
