"""hotelsim configuration from environment variables."""

import os

PMS_BASE_URL = os.getenv("PMS_BASE_URL", "http://localhost:8000/api/v1")
HOTEL_CODE = os.getenv("HOTELSIM_CODE", "GRAND_BISHKEK")
HOTEL_ID = int(os.getenv("HOTELSIM_HOTEL_ID", "1"))
HMAC_SECRET = os.getenv("HOTELSIM_HMAC_SECRET", "dev-hotel-hmac-secret")
SYNC_TOKEN = os.getenv("HOTELSIM_SYNC_TOKEN", "dev-hotel-sync-token")
DB_PATH = os.getenv("HOTELSIM_DB_PATH", "hotelsim.db")
