from fastapi import FastAPI
import psycopg2
import os

app = FastAPI()

# Простая проверка связи с базой
@app.get("/")
def read_root():
    try:
        conn = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB", "nexstay"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres"),
            host="db" # Название сервиса из docker-compose
        )
        return {"status": "online", "database": "connected", "architect": "Atay"}
    except Exception as e:
        return {"status": "online", "database": "error", "details": str(e)}

@app.get("/health")
def health():
    return {"status": "healthy"}
