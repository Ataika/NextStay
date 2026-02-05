from app.core.config import DATABASE_URL
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

<<<<<<< HEAD
# Lazy connection - does not connect to the database when the engine is created
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5}  # Timeout connection to the database
)
=======
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
>>>>>>> dev

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
