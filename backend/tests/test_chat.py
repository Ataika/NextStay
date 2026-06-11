from tests.conftest import login_owner, make_owner


def make_user(db, email="staff@test.com", role="STAFF", name="Staff User"):
    from app.api.v1.auth import hash_password
    from app.models.user import User

    user = User(email=email, full_name=name, role=role, is_active=True, password_hash=hash_password("Password1!"))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_user(client, email, password="Password1!"):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def make_conversation(db, creator_id, kind="group", title="Test Chat"):
    from app.models.chat_conversation import ChatConversation
    from app.models.chat_participant import ChatParticipant

    conv = ChatConversation(kind=kind, title=title, created_by_id=creator_id)
    db.add(conv)
    db.flush()
    db.add(ChatParticipant(conversation_id=conv.id, user_id=creator_id))
    db.commit()
    db.refresh(conv)
    return conv


def make_message(db, conversation_id, sender_id, content="Hello"):
    from app.models.chat_message import ChatMessage

    msg = ChatMessage(conversation_id=conversation_id, sender_id=sender_id, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def add_participant(db, conversation_id, user_id):
    from app.models.chat_participant import ChatParticipant

    existing = db.query(ChatParticipant).filter_by(conversation_id=conversation_id, user_id=user_id).first()
    if not existing:
        db.add(ChatParticipant(conversation_id=conversation_id, user_id=user_id))
        db.commit()


class TestChatConversations:
    def test_list_conversations_auto_creates_general(self, client, db):
        make_owner(db)
        token = login_owner(client)
        resp = client.get("/api/v1/chat/conversations", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["kind"] == "group"

    def test_list_conversations_requires_auth(self, client, db):
        resp = client.get("/api/v1/chat/conversations")
        assert resp.status_code == 401

    def test_create_direct_conversation(self, client, db):
        make_owner(db)
        token = login_owner(client)
        other = make_user(db)
        resp = client.post(
            "/api/v1/chat/conversations/direct",
            json={"user_id": other.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["kind"] == "direct"

    def test_create_direct_idempotent(self, client, db):
        make_owner(db)
        token = login_owner(client)
        other = make_user(db)
        first = client.post(
            "/api/v1/chat/conversations/direct",
            json={"user_id": other.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        second = client.post(
            "/api/v1/chat/conversations/direct",
            json={"user_id": other.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.json()["id"] == second.json()["id"]

    def test_cannot_dm_self(self, client, db):
        owner = make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/chat/conversations/direct",
            json={"user_id": owner.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "yourself" in resp.json()["detail"].lower()

    def test_dm_nonexistent_user(self, client, db):
        make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/chat/conversations/direct",
            json={"user_id": 9999},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_create_group_conversation(self, client, db):
        make_owner(db)
        token = login_owner(client)
        other = make_user(db)
        resp = client.post(
            "/api/v1/chat/conversations/group",
            json={"title": "Team Chat", "member_ids": [other.id]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        assert resp.json()["kind"] == "group"
        assert resp.json()["title"] == "Team Chat"

    def test_create_group_requires_at_least_one_member(self, client, db):
        owner = make_owner(db)
        token = login_owner(client)
        resp = client.post(
            "/api/v1/chat/conversations/group",
            json={"title": "Solo", "member_ids": [owner.id]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_get_conversation_messages_empty(self, client, db):
        owner = make_owner(db)
        token = login_owner(client)
        conv = make_conversation(db, creator_id=owner.id)
        resp = client.get(
            f"/api/v1/chat/conversations/{conv.id}/messages",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_search_chat_users(self, client, db):
        make_owner(db)
        token = login_owner(client)
        make_user(db, email="alice@test.com", name="Alice")
        resp = client.get("/api/v1/chat/users?query=alice", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        names = [u["name"] for u in resp.json()]
        assert "Alice" in names


class TestChatMessages:
    def test_edit_own_message(self, client, db):
        owner = make_owner(db)
        token = login_owner(client)
        conv = make_conversation(db, creator_id=owner.id)
        msg = make_message(db, conv.id, owner.id, "Original")
        resp = client.patch(
            f"/api/v1/chat/messages/{msg.id}",
            json={"content": "Edited"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "Edited"
        assert resp.json()["edited_at"] is not None

    def test_edit_other_user_message_forbidden(self, client, db):
        owner = make_owner(db)
        other = make_user(db)
        token = login_owner(client)
        conv = make_conversation(db, creator_id=owner.id)
        add_participant(db, conv.id, other.id)
        msg = make_message(db, conv.id, other.id, "Other's message")
        resp = client.patch(
            f"/api/v1/chat/messages/{msg.id}",
            json={"content": "Tampered"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_edit_deleted_message_rejected(self, client, db):
        owner = make_owner(db)
        token = login_owner(client)
        conv = make_conversation(db, creator_id=owner.id)
        msg = make_message(db, conv.id, owner.id, "To delete")
        client.delete(f"/api/v1/chat/messages/{msg.id}", headers={"Authorization": f"Bearer {token}"})
        resp = client.patch(
            f"/api/v1/chat/messages/{msg.id}",
            json={"content": "Try to edit deleted"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_edit_nonexistent_message(self, client, db):
        make_owner(db)
        token = login_owner(client)
        resp = client.patch(
            "/api/v1/chat/messages/9999",
            json={"content": "ghost edit"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_delete_own_message(self, client, db):
        owner = make_owner(db)
        token = login_owner(client)
        conv = make_conversation(db, creator_id=owner.id)
        msg = make_message(db, conv.id, owner.id, "Bye")
        resp = client.delete(f"/api/v1/chat/messages/{msg.id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 204

    def test_delete_already_deleted_message_is_idempotent(self, client, db):
        owner = make_owner(db)
        token = login_owner(client)
        conv = make_conversation(db, creator_id=owner.id)
        msg = make_message(db, conv.id, owner.id, "Once")
        client.delete(f"/api/v1/chat/messages/{msg.id}", headers={"Authorization": f"Bearer {token}"})
        resp = client.delete(f"/api/v1/chat/messages/{msg.id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 204

    def test_delete_other_message_as_non_admin_forbidden(self, client, db):
        owner = make_owner(db)
        make_user(db, email="staff2@test.com")
        token_other = login_user(client, "staff2@test.com")
        conv = make_conversation(db, creator_id=owner.id)
        msg = make_message(db, conv.id, owner.id, "Owner's message")
        resp = client.delete(f"/api/v1/chat/messages/{msg.id}", headers={"Authorization": f"Bearer {token_other}"})
        assert resp.status_code == 403

    def test_owner_can_delete_any_message(self, client, db):
        owner = make_owner(db)
        other = make_user(db)
        token = login_owner(client)
        conv = make_conversation(db, creator_id=owner.id)
        add_participant(db, conv.id, other.id)
        msg = make_message(db, conv.id, other.id, "Staff message")
        resp = client.delete(f"/api/v1/chat/messages/{msg.id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 204
