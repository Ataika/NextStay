import psycopg2
import uuid
import random
from datetime import datetime, timedelta

# Коннект к базе (внешний порт 5433)
conn = psycopg2.connect(
    host="localhost",
    port=5433,
    database="nextstay_db_v2",
    user="admin",
    password="nextstay_secure_pass"
) 
cursor = conn.cursor()

def simulate_booking():
    # Берем случайную комнату
    cursor.execute("SELECT room_id, tenant_id, price_per_night FROM rooms LIMIT 1")
    room = cursor.fetchone()
    if not room: return "Сначала добавь комнаты!"

    room_id, tenant_id, price = room
    
    # Создаем клиента
    client_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO clients (client_id, tenant_id, first_name, email) VALUES (%s, %s, %s, %s)",
        (client_id, tenant_id, "Guest_" + str(random.randint(1, 1000)), "test@mail.com")
    )

    # Создаем бронь
    check_in = datetime.now() + timedelta(days=random.randint(1, 5))
    check_out = check_in + timedelta(days=random.randint(1, 3))
    
    cursor.execute(
        "INSERT INTO bookings (room_id, tenant_id, client_id, check_in, check_out, total_price, status) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (room_id, tenant_id, client_id, check_in, check_out, price * 2, 'confirmed')
    )
    conn.commit()
    print(f"✅ Симуляция: Создана бронь для комнаты {room_id}")

if __name__ == "__main__":
    simulate_booking()
    conn.close()
