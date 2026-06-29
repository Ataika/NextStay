"""Tests for the multi-company grouping layer (company -> hotels over hotel_id)."""

from .conftest import login_owner, make_hotel, make_owner


def _auth(client, db):
    make_owner(db)
    return {"Authorization": f"Bearer {login_owner(client)}"}


def test_create_and_list_company(client, db):
    headers = _auth(client, db)
    r = client.post("/api/v1/companies", json={"code": "ACME", "name": "Acme Hotels"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["code"] == "ACME"
    assert r.json()["hotelCount"] == 0

    listed = client.get("/api/v1/companies")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_duplicate_code_conflict(client, db):
    headers = _auth(client, db)
    client.post("/api/v1/companies", json={"code": "ACME", "name": "Acme"}, headers=headers)
    dup = client.post("/api/v1/companies", json={"code": "ACME", "name": "Acme 2"}, headers=headers)
    assert dup.status_code == 409


def test_assign_hotel_and_list_company_hotels(client, db):
    headers = _auth(client, db)
    company_id = client.post("/api/v1/companies", json={"code": "ACME", "name": "Acme"}, headers=headers).json()["id"]
    hotel = make_hotel(db, code="H1", name="Hotel One")

    assigned = client.post(f"/api/v1/companies/{company_id}/hotels/{hotel.id}", headers=headers)
    assert assigned.status_code == 200, assigned.text

    hotels = client.get(f"/api/v1/companies/{company_id}/hotels")
    assert hotels.status_code == 200
    assert [h["code"] for h in hotels.json()] == ["H1"]

    # hotelCount reflects the assignment
    company = next(c for c in client.get("/api/v1/companies").json() if c["id"] == company_id)
    assert company["hotelCount"] == 1


def test_assign_unknown_hotel_404(client, db):
    headers = _auth(client, db)
    company_id = client.post("/api/v1/companies", json={"code": "ACME", "name": "Acme"}, headers=headers).json()["id"]
    r = client.post(f"/api/v1/companies/{company_id}/hotels/9999", headers=headers)
    assert r.status_code == 404


def test_create_requires_owner(client, db):
    # No auth token -> rejected.
    r = client.post("/api/v1/companies", json={"code": "X", "name": "Y"})
    assert r.status_code in (401, 403)
