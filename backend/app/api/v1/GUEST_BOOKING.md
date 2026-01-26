# Реализация Guest Token и Booking

## Что было реализовано

### 1. Модель GuestToken

Создана модель `GuestToken` в `app/models/guest_token.py` для хранения токенов гостей:
- Уникальный токен для каждого бронирования
- Связь с бронированием и комнатой
- Информация о WiFi, контактах, инструкциях и правилах отеля
- Статус валидности и доступа

### 2. Автоматическое создание токена при бронировании

При создании бронирования (`POST /api/v1/bookings`):
1. Создается бронирование
2. **Автоматически генерируется уникальный токен** для гостя
3. Создается запись `GuestToken` с полной информацией
4. В ответе возвращается бронирование **с токеном гостя** (`guestToken`)

### 3. Guest API

#### `GET /api/v1/guest/{token}`
Получить данные гостя по токену:
- Проверяет валидность токена
- Проверяет срок действия (не истек ли)
- Возвращает полную информацию: WiFi, контакты, инструкции, правила отеля

#### `POST /api/v1/guest/{token}/checkout`
Обработать выезд гостя:
1. Обновляет статус токена на "Checked out"
2. Обновляет статус бронирования на "Checked-out"
3. Обновляет статус комнаты на "Dirty"
4. **Автоматически создает задачу уборки** с высоким приоритетом

## Структура данных

### GuestToken в БД
```python
- token: уникальный токен (например, "guest-token-abc123xyz")
- booking_id: ID бронирования
- room_id: ID комнаты
- room_number: номер комнаты
- guest_name: имя гостя
- check_in, check_out: даты заезда/выезда
- is_valid: валидность токена
- access_status: "Active", "Expired", "Checked out"
- wifi_ssid, wifi_password: данные WiFi
- contact_info: JSON с контактами
- instructions: JSON с инструкциями
- house_rules: JSON с правилами отеля
```

### Booking с токеном
При создании или получении бронирования по ID, в ответе теперь есть поле:
```json
{
  "id": 1,
  "guestName": "John Doe",
  "roomId": 2,
  "roomNumber": "102",
  "checkIn": "2026-01-20T14:00:00Z",
  "checkOut": "2026-01-22T12:00:00Z",
  "status": "Upcoming",
  "guestToken": "guest-token-abc123xyz"  // <-- Новое поле
}
```

## Примеры использования

### 1. Создать бронирование (автоматически создается токен)

```bash
POST /api/v1/bookings
{
  "guestName": "John Doe",
  "roomId": 1,
  "roomNumber": "101",
  "checkIn": "2026-01-20T14:00:00Z",
  "checkOut": "2026-01-22T12:00:00Z",
  "status": "Upcoming"
}
```

**Ответ:**
```json
{
  "id": 1,
  "guestName": "John Doe",
  "roomId": 1,
  "roomNumber": "101",
  "checkIn": "2026-01-20T14:00:00Z",
  "checkOut": "2026-01-22T12:00:00Z",
  "status": "Upcoming",
  "guestToken": "guest-token-abc123xyz",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

### 2. Получить данные гостя по токену

```bash
GET /api/v1/guest/guest-token-abc123xyz
```

**Ответ:**
```json
{
  "token": "guest-token-abc123xyz",
  "bookingId": 1,
  "roomId": 1,
  "roomNumber": "101",
  "guestName": "John Doe",
  "checkIn": "2026-01-20T14:00:00Z",
  "checkOut": "2026-01-22T12:00:00Z",
  "isValid": true,
  "accessStatus": "Active",
  "wifi": {
    "ssid": "NextStay_Guest",
    "password": "Welcome2026!"
  },
  "contact": {
    "phone": "+1 (555) 123-4567",
    "whatsapp": "+1 (555) 123-4567",
    "email": "support@nextstay.com"
  },
  "instructions": {
    "accessInfo": "Use the QR code...",
    "activeFrom": "2026-01-20T14:00:00Z",
    "activeUntil": "2026-01-22T12:00:00Z",
    "doorTroubleshooting": "..."
  },
  "houseRules": {
    "quietHours": "22:00 - 08:00",
    "checkOutTime": "12:00",
    "smokingPolicy": "No smoking..."
  }
}
```

### 3. Обработать выезд гостя

```bash
POST /api/v1/guest/guest-token-abc123xyz/checkout
```

**Что происходит:**
1. Токен помечается как невалидный
2. Бронирование получает статус "Checked-out"
3. Комната получает статус "Dirty"
4. Создается задача уборки с приоритетом "High"

**Ответ:**
```json
{
  "message": "Checkout completed successfully",
  "roomNumber": "101"
}
```

## Важные моменты

1. **Токен генерируется автоматически** при создании бронирования
2. **Токен уникален** для каждого бронирования
3. **Токен проверяется на срок действия** при каждом запросе
4. **При checkout автоматически создается задача уборки**
5. **Токен возвращается в ответе** при создании или получении бронирования по ID

## Интеграция с фронтендом

Фронтенд может:
1. Создать бронирование и получить токен
2. Передать токен гостю (например, по email/SMS)
3. Гость использует токен для доступа к странице `/guest/{token}`
4. Гость может выполнить checkout через токен
