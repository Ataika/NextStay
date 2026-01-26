import os
from dotenv import load_dotenv

load_dotenv()

# Используем DATABASE_URL напрямую, если он установлен (для Docker)
# Иначе строим из отдельных переменных
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Строим URL из отдельных переменных
    postgres_user = os.getenv('POSTGRES_USER', 'postgres')
    postgres_password = os.getenv('POSTGRES_PASSWORD', 'postgres')
    postgres_host = os.getenv('POSTGRES_HOST', 'localhost')
    postgres_port = os.getenv('POSTGRES_PORT', '5432')
    postgres_db = os.getenv('POSTGRES_DB', 'nextstay')
    
    DATABASE_URL = (
        f"postgresql://{postgres_user}:"
        f"{postgres_password}@"
        f"{postgres_host}:"
        f"{postgres_port}/"
        f"{postgres_db}"
    )
