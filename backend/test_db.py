from sqlalchemy import create_engine, text
from app.core.config import DATABASE_URL

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as connection:
        # Wrap raw SQL string in text()
        result = connection.execute(text("SELECT 1"))
        print("Database connection successful!", result.fetchone())
except Exception as e:
    print("Database connection failed:", e)
