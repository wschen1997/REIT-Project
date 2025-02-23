import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables explicitly
dotenv_path = os.path.abspath("C:/Users/wsche/OneDrive/桌面/Investment Research/Startup Project/Python Run/Credentials.env")
load_dotenv(dotenv_path)

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# Force SSL for pymysql
engine = create_engine(
    f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={
        "ssl": {
            "fake_flag_to_enable": True  # triggers SSL
        }
    }
)

# Test the connection
with engine.connect() as conn:
    rows = conn.execute(text("SELECT @@version")).fetchone()
    print("MySQL version:", rows[0])
