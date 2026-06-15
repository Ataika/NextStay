import asyncio
from collections import defaultdict
from datetime import datetime, timezone

from app.core.config import AUTH_JWT_SECRET, DEV_OWNER_TOKEN, DEV_OWNER_TOKEN_ENABLED
from app.db.session import SessionLocal
from app.models.chat_conversation import ChatConversation as ChatConversationModel
from app.models.chat_message import ChatMessage as ChatMessageModel
from app.models.chat_participant import ChatParticipant as ChatParticipantModel
from app.models.hotel_profile import HotelProfile as HotelProfileModel
from app.models.user import User as UserModel
from app.security.auth import get_current_user
from app.security.tenancy import require_hotel_id
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

router = APIRouter(tags=["chat"])

CHAT_HISTORY_LIMIT = 100
HOTEL_CHAT_KEY_PREFIX = "hotel:"
ALLOWED_ROLES = {"OWNER", "STAFF", "SYS_ADMIN", "DIRECTOR", "MANAGER"}


class ConnectionManager:
    def __init__(self):
        self._connections: dict[int, list[WebSocket]] = {}
        self._names: dict[int, str] = {}

    async def connect(self, user_id: int, name: str, ws: WebSocket):
        await ws.accept()
        sockets = self._connections.setdefault(user_id, [])
        sockets.append(ws)
        self._names[user_id] = name

    def disconnect(self, user_id: int, ws: WebSocket):
        sockets = self._connections.get(user_id, [])
        if ws in sockets:
            sockets.remove(ws)
        if sockets:
            self._connections[user_id] = sockets
            return
        self._connections.pop(user_id, None)
        self._names.pop(user_id, None)

    async def send_to_users(self, user_ids: list[int], message: dict):
        dead: list[tuple[int, WebSocket]] = []
        seen_ids = set()

        for user_id in user_ids:
            if user_id in seen_ids:
                continue
            seen_ids.add(user_id)
            for ws in self._connections.get(user_id, []):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append((user_id, ws))

        for user_id, ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast_presence(self):
        if not self._connections:
            return
        await self.send_to_users(list(self._connections.keys()), {"type": "presence", "online": self.online_users()})

    def is_online(self, user_id: int) -> bool:
        return bool(self._connections.get(user_id))

    def online_users(self) -> list[dict]:
        return [
            {"id": user_id, "name": name}
            for user_id, name in sorted(self._names.items(), key=lambda item: item[1].lower())
        ]


manager = ConnectionManager()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _resolve_user_from_token(token: str, db: Session) -> UserModel | None:
    if DEV_OWNER_TOKEN_ENABLED and token == DEV_OWNER_TOKEN:
        return (
            db.query(UserModel)
            .filter(UserModel.role == "OWNER", UserModel.is_active.is_(True))
            .order_by(UserModel.id.asc())
            .first()
        )

    try:
        payload = jwt.decode(token, AUTH_JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except JWTError:
        return None

    if not user_id:
        return None

    return db.query(UserModel).filter(UserModel.id == int(user_id), UserModel.is_active.is_(True)).first()


def _ensure_chat_access(user: UserModel) -> None:
    if user.role.upper() not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")


def _direct_key(user_a: int, user_b: int) -> str:
    first, second = sorted((user_a, user_b))
    return f"{first}:{second}"


def _general_conversation_key(hotel_id: int) -> str:
    return f"{HOTEL_CHAT_KEY_PREFIX}{hotel_id}"


def _participants_same_hotel(participants: list[UserModel], hotel_id: int) -> bool:
    for participant in participants:
        if participant.hotel_id is not None and participant.hotel_id != hotel_id:
            return False
    return True


def _users_share_hotel(user_a: UserModel, user_b: UserModel) -> bool:
    if user_a.hotel_id is None or user_b.hotel_id is None:
        return user_a.hotel_id == user_b.hotel_id
    return user_a.hotel_id == user_b.hotel_id


def _ensure_general_conversation_for_user(db: Session, user: UserModel) -> None:
    hotel_id = require_hotel_id(user, db)
    system_key = _general_conversation_key(hotel_id)
    conversation = db.query(ChatConversationModel).filter(ChatConversationModel.system_key == system_key).first()
    changed = False

    if not conversation:
        hotel = db.query(HotelProfileModel).filter(HotelProfileModel.id == hotel_id).first()
        title = f"{hotel.hotel_name} staff" if hotel else "General staff"
        conversation = ChatConversationModel(
            kind="group",
            title=title,
            system_key=system_key,
            created_by_id=user.id,
        )
        db.add(conversation)
        db.flush()
        changed = True

    membership = (
        db.query(ChatParticipantModel)
        .filter(
            ChatParticipantModel.conversation_id == conversation.id,
            ChatParticipantModel.user_id == user.id,
        )
        .first()
    )
    if not membership:
        db.add(ChatParticipantModel(conversation_id=conversation.id, user_id=user.id))
        changed = True

    if changed:
        db.commit()


def _conversation_for_user(db: Session, conversation_id: int, user_id: int) -> ChatConversationModel | None:
    return (
        db.query(ChatConversationModel)
        .join(ChatParticipantModel, ChatParticipantModel.conversation_id == ChatConversationModel.id)
        .filter(
            ChatConversationModel.id == conversation_id,
            ChatParticipantModel.user_id == user_id,
        )
        .first()
    )


def _participants_for_conversations(db: Session, conversation_ids: list[int]) -> dict[int, list[UserModel]]:
    if not conversation_ids:
        return {}

    rows = (
        db.query(ChatParticipantModel.conversation_id, UserModel)
        .join(UserModel, UserModel.id == ChatParticipantModel.user_id)
        .filter(ChatParticipantModel.conversation_id.in_(conversation_ids))
        .order_by(UserModel.full_name.asc())
        .all()
    )

    grouped: dict[int, list[UserModel]] = defaultdict(list)
    for conversation_id, user in rows:
        grouped[conversation_id].append(user)
    return grouped


def _last_messages_for_conversations(
    db: Session, conversation_ids: list[int]
) -> dict[int, tuple[ChatMessageModel, UserModel]]:
    if not conversation_ids:
        return {}

    rows = (
        db.query(ChatMessageModel, UserModel)
        .join(UserModel, UserModel.id == ChatMessageModel.sender_id)
        .filter(ChatMessageModel.conversation_id.in_(conversation_ids))
        .order_by(ChatMessageModel.created_at.desc(), ChatMessageModel.id.desc())
        .all()
    )

    latest: dict[int, tuple[ChatMessageModel, UserModel]] = {}
    for message, sender in rows:
        if message.conversation_id not in latest:
            latest[message.conversation_id] = (message, sender)
    return latest


def _unread_counts_for_user(db: Session, user_id: int, conversation_ids: list[int]) -> dict[int, int]:
    if not conversation_ids:
        return {}

    memberships = (
        db.query(ChatParticipantModel)
        .filter(
            ChatParticipantModel.user_id == user_id,
            ChatParticipantModel.conversation_id.in_(conversation_ids),
        )
        .all()
    )
    read_map = {membership.conversation_id: membership.last_read_at for membership in memberships}

    counts: dict[int, int] = {}
    for conversation_id in conversation_ids:
        query = db.query(func.count(ChatMessageModel.id)).filter(
            ChatMessageModel.conversation_id == conversation_id,
            ChatMessageModel.sender_id != user_id,
            ChatMessageModel.deleted_at.is_(None),
        )
        last_read_at = read_map.get(conversation_id)
        if last_read_at is not None:
            query = query.filter(ChatMessageModel.created_at > last_read_at)
        counts[conversation_id] = int(query.scalar() or 0)
    return counts


def _mark_conversation_read(db: Session, conversation_id: int, user_id: int) -> None:
    membership = (
        db.query(ChatParticipantModel)
        .filter(
            ChatParticipantModel.conversation_id == conversation_id,
            ChatParticipantModel.user_id == user_id,
        )
        .first()
    )
    if not membership:
        return
    membership.last_read_at = datetime.now(timezone.utc)
    db.commit()


class ChatParticipantOut(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    online: bool


class ChatConversationSummary(BaseModel):
    id: int
    kind: str
    title: str
    created_by_id: int | None
    participants: list[ChatParticipantOut]
    last_message_preview: str | None
    last_message_at: datetime | None
    unread_count: int = 0


class ChatMessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    content: str
    created_at: datetime
    edited_at: datetime | None = None
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True


class MessageEditRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class ChatUserOption(BaseModel):
    id: int
    name: str
    email: str
    role: str
    online: bool


class DirectConversationRequest(BaseModel):
    user_id: int


class GroupConversationRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    member_ids: list[int] = Field(default_factory=list)


def _build_conversation_summary(
    conversation: ChatConversationModel,
    participants: list[UserModel],
    current_user_id: int,
    last_message: tuple[ChatMessageModel, UserModel] | None,
    unread_count: int = 0,
) -> ChatConversationSummary:
    participant_items = [
        ChatParticipantOut(
            user_id=user.id,
            name=user.full_name,
            email=user.email,
            role=user.role,
            online=manager.is_online(user.id),
        )
        for user in participants
    ]

    if conversation.kind == "direct":
        other = next((user for user in participants if user.id != current_user_id), None)
        title = other.full_name if other else (participants[0].full_name if participants else "Direct message")
    else:
        title = conversation.title or "Untitled group"

    preview = None
    created_at = None
    if last_message:
        message, sender = last_message
        preview = f"{sender.full_name}: {message.content}" if conversation.kind == "group" else message.content
        created_at = message.created_at

    return ChatConversationSummary(
        id=conversation.id,
        kind=conversation.kind,
        title=title,
        created_by_id=conversation.created_by_id,
        participants=participant_items,
        last_message_preview=preview,
        last_message_at=created_at,
        unread_count=unread_count,
    )


@router.get("/chat/conversations", response_model=list[ChatConversationSummary])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)
    hotel_id = require_hotel_id(current_user, db)
    _ensure_general_conversation_for_user(db, current_user)

    conversations = (
        db.query(ChatConversationModel)
        .join(ChatParticipantModel, ChatParticipantModel.conversation_id == ChatConversationModel.id)
        .filter(ChatParticipantModel.user_id == current_user.id)
        .all()
    )

    conversation_ids = [conversation.id for conversation in conversations]
    participants_map = _participants_for_conversations(db, conversation_ids)
    last_messages = _last_messages_for_conversations(db, conversation_ids)
    unread_counts = _unread_counts_for_user(db, current_user.id, conversation_ids)

    summaries = []
    for conversation in conversations:
        participants = participants_map.get(conversation.id, [])
        if not _participants_same_hotel(participants, hotel_id):
            continue
        summaries.append(
            _build_conversation_summary(
                conversation=conversation,
                participants=participants,
                current_user_id=current_user.id,
                last_message=last_messages.get(conversation.id),
                unread_count=unread_counts.get(conversation.id, 0),
            )
        )

    def sort_key(summary: ChatConversationSummary) -> tuple[datetime, int]:
        created_at = summary.last_message_at or next(
            (conversation.updated_at for conversation in conversations if conversation.id == summary.id),
            datetime.min.replace(tzinfo=timezone.utc),
        )
        return created_at, summary.id

    summaries.sort(key=sort_key, reverse=True)
    return summaries


@router.get("/chat/conversations/{conversation_id}/messages", response_model=list[ChatMessageOut])
def get_conversation_messages(
    conversation_id: int,
    limit: int = Query(default=CHAT_HISTORY_LIMIT, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)
    conversation = _conversation_for_user(db, conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    rows = (
        db.query(ChatMessageModel, UserModel)
        .join(UserModel, UserModel.id == ChatMessageModel.sender_id)
        .filter(ChatMessageModel.conversation_id == conversation.id)
        .order_by(ChatMessageModel.created_at.desc(), ChatMessageModel.id.desc())
        .limit(limit)
        .all()
    )

    return [
        ChatMessageOut(
            id=message.id,
            conversation_id=message.conversation_id,
            sender_id=message.sender_id,
            sender_name=sender.full_name,
            content=message.content,
            created_at=message.created_at,
        )
        for message, sender in reversed(rows)
    ]


@router.post("/chat/conversations/{conversation_id}/read", status_code=204)
def mark_conversation_read(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)
    conversation = _conversation_for_user(db, conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    _mark_conversation_read(db, conversation_id, current_user.id)


@router.get("/chat/users", response_model=list[ChatUserOption])
def search_chat_users(
    query: str = Query(default="", max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)
    hotel_id = require_hotel_id(current_user, db)

    users_query = (
        db.query(UserModel)
        .filter(
            UserModel.is_active.is_(True),
            UserModel.id != current_user.id,
            UserModel.role.in_(tuple(ALLOWED_ROLES)),
            UserModel.hotel_id == hotel_id,
        )
        .order_by(UserModel.full_name.asc())
    )

    cleaned_query = query.strip()
    if cleaned_query:
        for token in cleaned_query.split():
            pattern = f"%{token}%"
            users_query = users_query.filter(
                or_(
                    UserModel.full_name.ilike(pattern),
                    UserModel.email.ilike(pattern),
                )
            )

    users = users_query.limit(limit).all()
    return [
        ChatUserOption(
            id=user.id,
            name=user.full_name,
            email=user.email,
            role=user.role,
            online=manager.is_online(user.id),
        )
        for user in users
    ]


@router.post("/chat/conversations/direct", response_model=ChatConversationSummary)
def create_or_get_direct_conversation(
    payload: DirectConversationRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)

    if payload.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot start a direct chat with yourself.")

    target_user = (
        db.query(UserModel)
        .filter(
            UserModel.id == payload.user_id,
            UserModel.is_active.is_(True),
            UserModel.role.in_(tuple(ALLOWED_ROLES)),
        )
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if not _users_share_hotel(current_user, target_user):
        raise HTTPException(status_code=404, detail="Staff member not found.")

    direct_key = _direct_key(current_user.id, target_user.id)
    conversation = db.query(ChatConversationModel).filter(ChatConversationModel.direct_key == direct_key).first()

    if not conversation:
        conversation = ChatConversationModel(
            kind="direct",
            direct_key=direct_key,
            created_by_id=current_user.id,
        )
        db.add(conversation)
        db.flush()

        db.add(ChatParticipantModel(conversation_id=conversation.id, user_id=current_user.id))
        db.add(ChatParticipantModel(conversation_id=conversation.id, user_id=target_user.id))
        db.commit()
        db.refresh(conversation)

    participants = _participants_for_conversations(db, [conversation.id]).get(conversation.id, [])
    last_message = _last_messages_for_conversations(db, [conversation.id]).get(conversation.id)
    return _build_conversation_summary(conversation, participants, current_user.id, last_message)


@router.post("/chat/conversations/group", response_model=ChatConversationSummary, status_code=201)
def create_group_conversation(
    payload: GroupConversationRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)

    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Group name is required.")

    member_ids = {member_id for member_id in payload.member_ids if member_id != current_user.id}
    if not member_ids:
        raise HTTPException(status_code=400, detail="Select at least one other staff member.")

    members = (
        db.query(UserModel)
        .filter(
            UserModel.id.in_(member_ids),
            UserModel.is_active.is_(True),
            UserModel.role.in_(tuple(ALLOWED_ROLES)),
        )
        .all()
    )
    if len(members) != len(member_ids):
        raise HTTPException(status_code=400, detail="One or more selected staff members are unavailable.")
    if any(not _users_share_hotel(current_user, member) for member in members):
        raise HTTPException(status_code=400, detail="One or more selected staff members are unavailable.")

    conversation = ChatConversationModel(
        kind="group",
        title=title,
        created_by_id=current_user.id,
    )
    db.add(conversation)
    db.flush()

    participant_ids = {current_user.id, *member_ids}
    for user_id in participant_ids:
        db.add(ChatParticipantModel(conversation_id=conversation.id, user_id=user_id))

    db.commit()
    db.refresh(conversation)

    participants = _participants_for_conversations(db, [conversation.id]).get(conversation.id, [])
    return _build_conversation_summary(conversation, participants, current_user.id, None)


@router.patch("/chat/messages/{message_id}", response_model=ChatMessageOut)
async def edit_message(
    message_id: int,
    payload: MessageEditRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)
    message = db.query(ChatMessageModel).filter(ChatMessageModel.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found.")
    if message.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message.")
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages.")

    conversation = _conversation_for_user(db, message.conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    new_content = payload.content.strip()
    message.content = new_content
    message.edited_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)

    sender = db.query(UserModel).filter(UserModel.id == message.sender_id).first()
    participant_ids = [
        p.user_id
        for p in db.query(ChatParticipantModel).filter(ChatParticipantModel.conversation_id == conversation.id).all()
    ]

    asyncio.ensure_future(
        manager.send_to_users(
            participant_ids,
            {
                "type": "message_edited",
                "id": message.id,
                "conversation_id": message.conversation_id,
                "content": new_content,
                "edited_at": message.edited_at.isoformat(),
            },
        )
    )

    return ChatMessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=sender.full_name if sender else "",
        content=message.content,
        created_at=message.created_at,
        edited_at=message.edited_at,
        deleted_at=message.deleted_at,
    )


@router.delete("/chat/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)
    message = db.query(ChatMessageModel).filter(ChatMessageModel.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found.")
    if message.deleted_at is not None:
        return None  # already deleted

    is_own = message.sender_id == current_user.id
    is_admin = current_user.role.upper() in {"OWNER", "SYS_ADMIN"}
    if not is_own and not is_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")

    conversation = _conversation_for_user(db, message.conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    now = datetime.now(timezone.utc)
    message.deleted_at = now
    db.commit()

    participant_ids = [
        p.user_id
        for p in db.query(ChatParticipantModel).filter(ChatParticipantModel.conversation_id == conversation.id).all()
    ]

    asyncio.ensure_future(
        manager.send_to_users(
            participant_ids,
            {
                "type": "message_deleted",
                "id": message_id,
                "conversation_id": conversation.id,
                "deleted_at": now.isoformat(),
            },
        )
    )
    return None


@router.get("/chat/history", response_model=list[ChatMessageOut])
def get_general_history(
    limit: int = Query(default=CHAT_HISTORY_LIMIT, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)
    _ensure_general_conversation_for_user(db, current_user)
    hotel_id = require_hotel_id(current_user, db)
    general = (
        db.query(ChatConversationModel)
        .filter(ChatConversationModel.system_key == _general_conversation_key(hotel_id))
        .first()
    )
    if not general:
        return []
    return get_conversation_messages(general.id, limit, db, current_user)


@router.get("/chat/online")
def get_online_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_chat_access(current_user)
    hotel_id = require_hotel_id(current_user, db)
    online = manager.online_users()
    if not online:
        return []
    online_ids = [entry["id"] for entry in online]
    allowed_ids = {
        user.id
        for user in db.query(UserModel).filter(UserModel.id.in_(online_ids), UserModel.hotel_id == hotel_id).all()
    }
    return [entry for entry in online if entry["id"] in allowed_ids]


@router.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket, token: str = Query(...)):
    db = SessionLocal()
    try:
        user = _resolve_user_from_token(token, db)
        if not user:
            await ws.close(code=4001)
            return
        _ensure_chat_access(user)
    except HTTPException:
        await ws.close(code=4003)
        return
    finally:
        db.close()

    await manager.connect(user.id, user.full_name, ws)
    await manager.broadcast_presence()

    try:
        while True:
            data = await ws.receive_json()
            event_type = data.get("type", "message")

            conversation_raw = data.get("conversation_id")
            try:
                conversation_id = int(conversation_raw)
            except (TypeError, ValueError):
                continue

            # --- Typing indicator ---
            if event_type == "typing":
                db = SessionLocal()
                try:
                    conversation = _conversation_for_user(db, conversation_id, user.id)
                    if not conversation:
                        continue
                    participant_ids = [
                        p.user_id
                        for p in db.query(ChatParticipantModel)
                        .filter(ChatParticipantModel.conversation_id == conversation.id)
                        .all()
                    ]
                finally:
                    db.close()
                other_ids = [uid for uid in participant_ids if uid != user.id]
                await manager.send_to_users(
                    other_ids,
                    {
                        "type": "typing",
                        "conversation_id": conversation_id,
                        "user_id": user.id,
                        "user_name": user.full_name,
                    },
                )
                continue

            if event_type != "message":
                continue

            content = (data.get("content") or "").strip()
            if not content or len(content) > 2000:
                continue

            db = SessionLocal()
            try:
                conversation = _conversation_for_user(db, conversation_id, user.id)
                if not conversation:
                    continue

                message = ChatMessageModel(
                    conversation_id=conversation.id,
                    sender_id=user.id,
                    content=content,
                )
                conversation.updated_at = datetime.now(timezone.utc)
                db.add(message)
                db.commit()
                db.refresh(message)

                participant_ids = [
                    participant.user_id
                    for participant in db.query(ChatParticipantModel)
                    .filter(ChatParticipantModel.conversation_id == conversation.id)
                    .all()
                ]
            finally:
                db.close()

            await manager.send_to_users(
                participant_ids,
                {
                    "type": "message",
                    "id": message.id,
                    "conversation_id": conversation.id,
                    "sender_id": user.id,
                    "sender_name": user.full_name,
                    "content": content,
                    "created_at": message.created_at.isoformat()
                    if message.created_at
                    else datetime.now(timezone.utc).isoformat(),
                },
            )

    except (WebSocketDisconnect, RuntimeError):
        manager.disconnect(user.id, ws)
        await manager.broadcast_presence()
