from tests.conftest import login_owner, make_owner, make_room


class TestTaskCRUD:
    def test_create_task_no_staff_gives_pending(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        resp = client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number, "priority": "Medium"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "Pending"
        assert data["roomId"] == room.id
        db.refresh(room)
        assert room.status == "Cleaning"

    def test_create_task_room_not_found(self, client, db):
        make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/tasks",
            json={"roomId": 9999, "roomNumber": "999", "priority": "High"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_create_task_invalid_priority(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        resp = client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number, "priority": "INVALID"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_get_all_tasks(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get("/api/v1/tasks", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_get_task_by_id(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        r = client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number},
            headers={"Authorization": f"Bearer {token}"},
        )
        task_id = r.json()["id"]
        resp = client.get(f"/api/v1/tasks/{task_id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["id"] == task_id

    def test_get_task_not_found(self, client, db):
        make_owner(db)
        token = login_owner(client)
        resp = client.get("/api/v1/tasks/9999", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404

    def test_assign_task(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        r = client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number},
            headers={"Authorization": f"Bearer {token}"},
        )
        task_id = r.json()["id"]
        resp = client.patch(
            f"/api/v1/tasks/{task_id}/assign",
            json={"staffId": 1, "staffName": "Alice"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["assignedToName"] == "Alice"
        assert resp.json()["status"] == "In Progress"

    def test_delete_task(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        r = client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number},
            headers={"Authorization": f"Bearer {token}"},
        )
        task_id = r.json()["id"]
        resp = client.delete(f"/api/v1/tasks/{task_id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 204

    def test_unauthenticated_access(self, client, db):
        resp = client.get("/api/v1/tasks")
        assert resp.status_code == 401


class TestTaskLifecycle:
    def test_complete_task_restores_room_to_available(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        r = client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number, "priority": "Urgent"},
            headers={"Authorization": f"Bearer {token}"},
        )
        task_id = r.json()["id"]
        resp = client.patch(f"/api/v1/tasks/{task_id}/complete", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "Completed"
        db.refresh(room)
        assert room.status == "Available"

    def test_complete_already_completed_task_rejected(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        r = client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number},
            headers={"Authorization": f"Bearer {token}"},
        )
        task_id = r.json()["id"]
        client.patch(f"/api/v1/tasks/{task_id}/complete", headers={"Authorization": f"Bearer {token}"})
        resp = client.patch(f"/api/v1/tasks/{task_id}/complete", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 400
        assert "already completed" in resp.json()["detail"].lower()

    def test_task_filter_by_room_id(self, client, db):
        make_owner(db)
        token = login_owner(client)
        room1 = make_room(db, number="101")
        room2 = make_room(db, number="102")
        client.post(
            "/api/v1/tasks",
            json={"roomId": room1.id, "roomNumber": room1.number},
            headers={"Authorization": f"Bearer {token}"},
        )
        client.post(
            "/api/v1/tasks",
            json={"roomId": room2.id, "roomNumber": room2.number},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get(f"/api/v1/tasks?room_id={room1.id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        tasks = resp.json()
        assert len(tasks) == 1
        assert tasks[0]["roomId"] == room1.id

    def test_round_robin_assigns_staff_when_available(self, client, db):
        """When a cleaner exists in staff_members, the task is auto-assigned (In Progress)."""
        from sqlalchemy import text

        make_owner(db)
        token = login_owner(client)
        room = make_room(db)
        db.execute(text("INSERT INTO staff_members (name, role, is_active) VALUES ('Bob', 'cleaner', 1)"))
        db.commit()
        resp = client.post(
            "/api/v1/tasks",
            json={"roomId": room.id, "roomNumber": room.number},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "In Progress"
        assert data["assignedToName"] == "Bob"
