# NextStay - Функциональность проекта

## 📋 Обзор

NextStay - система управления отелем с публичной страницей бронирования и админ-панелью для владельца.

---

## 🏨 Комнаты (Rooms)

### Просмотр
- **GET** `/api/v1/rooms` - Получить все комнаты
- **GET** `/api/v1/rooms/{room_id}` - Получить комнату по ID
- **GET** `/api/v1/rooms/available` - Поиск доступных комнат по датам
  - Параметры: `checkIn`, `checkOut`, `category` (опционально), `capacity` (опционально)
  - Возвращает список доступных номеров с расчетом цены

### Создание/Редактирование
- **POST** `/api/v1/rooms` - Создать новую комнату
  - Поля: `number`, `category`, `status`, `price`, `capacity`, `description`, `amenities`
- **PATCH** `/api/v1/rooms/{room_id}` - Обновить комнату (любые поля)

### Удаление
- **DELETE** `/api/v1/rooms/{room_id}` - Удалить комнату

### Статусы комнат
- `Available` - Доступна для бронирования
- `Occupied` - Занята
- `Cleaning` - Уборка
- `Maintenance` - На обслуживании
- `Dirty` - Требует уборки

---

## 📅 Бронирования (Bookings)

### Просмотр
- **GET** `/api/v1/bookings` - Получить все бронирования
- **GET** `/api/v1/bookings/{booking_id}` - Получить бронирование по ID (с токеном гостя)

### Создание
- **POST** `/api/v1/bookings` - Создать новое бронирование
  - Обязательные поля: `guestName`, `roomId`, `roomNumber`, `checkIn`, `checkOut`, `email`
  - Автоматически:
    - Создает `guest_token` для доступа гостя
    - Проверяет доступность номера
    - Валидирует даты (check-in не в прошлом, check-out после check-in)
    - Статус по умолчанию: `"Pending"` (ожидает оплаты)

### Редактирование
- **PATCH** `/api/v1/bookings/{booking_id}` - Обновить бронирование
  - Можно изменить: `guestName`, `roomId`, `roomNumber`, `checkIn`, `checkOut`, `status`, `notes`

### Статусы бронирований
- `Pending` - Создано, ожидает оплаты
- `Confirmed` - Оплачено и подтверждено
- `Upcoming` - Предстоящее
- `Checked-in` - Гость заехал
- `Checked-out` - Гость выехал
- `Cancelled` - Отменено
- `Expired` - Истекло (не оплачено вовремя)

---

## 🧹 Задачи уборки (Cleaning Tasks)

### Просмотр
- **GET** `/api/v1/tasks` - Получить все задачи
  - Параметр: `room_id` (опционально) - фильтр по комнате
- **GET** `/api/v1/tasks/{task_id}` - Получить задачу по ID

### Создание
- **POST** `/api/v1/tasks` - Создать задачу уборки
  - Поля: `roomId`, `roomNumber`, `priority` (Low/Medium/High), `notes`
  - Автоматически меняет статус комнаты на `"Cleaning"`

### Операции
- **PATCH** `/api/v1/tasks/{task_id}/assign` - Назначить задачу сотруднику
  - Поля: `staffId`, `staffName`
  - Меняет статус на `"In Progress"`
- **PATCH** `/api/v1/tasks/{task_id}/complete` - Завершить задачу
  - Меняет статус на `"Completed"`
  - Автоматически переводит комнату в статус `"Available"`

### Статусы задач
- `Pending` - Ожидает назначения
- `In Progress` - В работе
- `Completed` - Завершена

---

## 👤 Гостевой доступ (Guest)

### Просмотр
- **GET** `/api/v1/guest/{token}` - Получить данные гостя по токену
  - Возвращает: информацию о бронировании, WiFi, контакты, инструкции, правила

### Операции
- **POST** `/api/v1/guest/{token}/checkout` - Обработать выезд гостя
  - Обновляет статус бронирования на `"Checked-out"`
  - Меняет статус комнаты на `"Dirty"`
  - Автоматически создает задачу уборки

---

## 💳 Платежи (Stripe)

### Создание сессии оплаты
- **POST** `/api/v1/stripe/create-checkout-session` - Создать Stripe Checkout сессию
  - Параметр: `booking_id`
  - Возвращает: `session_id` и `url` для редиректа
  - Привязывает `session_id` к бронированию

### Webhook
- **POST** `/api/v1/stripe/webhook` - Обработка событий от Stripe
  - Событие `checkout.session.completed`:
    - Обновляет статус бронирования на `"Confirmed"`
    - Сохраняет `payment_intent_id` и `amount_paid`
    - Отправляет email гостю и владельцу (в фоне)

---

## 🔐 Аутентификация (Auth)

### Вход/Выход
- **POST** `/api/v1/auth/login` - Вход в систему
  - Поля: `email`, `password`
  - Возвращает: `token`, `role`, `user`
- **POST** `/api/v1/auth/logout` - Выход из системы

**Примечание:** Сейчас используется заглушка (hardcoded credentials)

---

## 🌐 Frontend страницы

### Публичные страницы
- `/book` - Страница бронирования для гостей
  - Поиск доступных номеров по датам
  - Форма бронирования
  - Редирект на Stripe для оплаты
- `/booking/success` - Страница успешного бронирования
- `/booking/cancel` - Страница отмены бронирования
- `/guest/{token}` - Страница доступа гостя (по токену)

### Админ-панель
- `/admin` - Главная страница админки
  - Управление комнатами (CRUD)
  - Просмотр задач уборки
  - Просмотр бронирований
  - Фильтрация по статусам
  - Статистика

---

## 🔄 Автоматические процессы

### При создании бронирования
1. Проверка доступности номера
2. Валидация дат
3. Создание `guest_token`
4. Обновление статуса комнаты (если check-in сегодня/в прошлом → `"Occupied"`)

### При оплате через Stripe
1. Webhook получает событие `checkout.session.completed`
2. Статус бронирования → `"Confirmed"`
3. Сохранение данных платежа
4. Отправка email гостю (подтверждение)
5. Отправка email владельцу (уведомление)

### При выезде гостя
1. Статус бронирования → `"Checked-out"`
2. Статус комнаты → `"Dirty"`
3. Создание задачи уборки (приоритет: High)

### При завершении уборки
1. Статус задачи → `"Completed"`
2. Статус комнаты → `"Available"`

---

## 📊 Основные сущности

### Room (Комната)
- `id`, `number`, `category`, `status`, `price`, `capacity`
- `description`, `amenities` (JSON массив)

### Booking (Бронирование)
- `id`, `guest_name`, `guest_email`, `room_id`, `room_number`
- `check_in`, `check_out`, `status`, `notes`
- `stripe_session_id`, `stripe_payment_intent_id`, `amount_paid`
- `created_at`

### CleaningTask (Задача уборки)
- `id`, `room_id`, `room_number`, `status`, `priority`
- `assigned_to`, `assigned_to_name`, `notes`
- `created_at`, `completed_at`

### GuestToken (Токен гостя)
- `token`, `booking_id`, `room_id`, `room_number`, `guest_name`
- `check_in`, `check_out`, `is_valid`, `access_status`
- `wifi_ssid`, `wifi_password`, `contact_info` (JSON)
- `instructions` (JSON), `house_rules` (JSON)

---

## 🎯 Основные функции

### Для гостя
- ✅ Поиск доступных номеров по датам
- ✅ Просмотр цен и описаний
- ✅ Создание бронирования
- ✅ Оплата через Stripe
- ✅ Доступ к информации о бронировании по токену
- ✅ Выполнение checkout

### Для владельца/админа
- ✅ Управление комнатами (создание, редактирование, удаление)
- ✅ Просмотр всех бронирований
- ✅ Управление задачами уборки
- ✅ Назначение задач сотрудникам
- ✅ Изменение статусов комнат
- ✅ Просмотр статистики

---

## 🔗 Интеграции

### Stripe
- Создание Checkout сессий
- Обработка webhooks
- Подтверждение платежей

### Email (SMTP)
- Подтверждение бронирования гостю
- Уведомление владельцу о новом бронировании
- Настраивается через переменные окружения

---

## 📝 Примечания

- Все даты в формате ISO: `YYYY-MM-DDTHH:MM:SSZ`
- Статусы чувствительны к регистру (например, `"Available"` с заглавной)
- Проверка доступности исключает номера с пересекающимися бронированиями (`"Upcoming"` или `"Checked-in"`)
- Guest tokens автоматически истекают после даты выезда
