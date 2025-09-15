import os
import sys
import re
import pandas as pd
import numpy as np
import hashlib
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ------------------------------------------------------------------
# 1) Load DB credentials & root folder from .env
# ------------------------------------------------------------------
script_dir = os.path.dirname(__file__)
dotenv_path = os.path.join(script_dir, "Credentials.env")
load_dotenv(dotenv_path)

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST     = os.getenv("DB_HOST")
DB_PORT     = os.getenv("DB_PORT")
DB_NAME     = os.getenv("DB_NAME")

root_folder = os.getenv("REIT_RAW_PROPERTIES_PATH")

# SQLAlchemy engine
engine = create_engine(
    f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={"ssl": {"fake_flag_to_enable": True}}
)

# ------------------------------------------------------------------
# 2) Create reit_properties table if not exists
#    Use a compact row_hash for uniqueness to avoid index-length limits
# ------------------------------------------------------------------
def create_reit_properties_table_if_not_exists(table_name):
    create_query = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        row_hash CHAR(32) NOT NULL,
        ticker VARCHAR(10) NOT NULL,
        address VARCHAR(255),
        property_type VARCHAR(255),
        secondary_type VARCHAR(255),
        rba_gla INT,
        city VARCHAR(255),
        market VARCHAR(255),
        country VARCHAR(255),
        last_sale_price FLOAT,
        year_built INT,
        asking_rent_per_year FLOAT,
        excel_row_index INT,
        UNIQUE KEY unique_property (row_hash)
    );
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(create_query))
        print(f"✅ Verified/created table: {table_name}")
    except Exception as e:
        print(f"❌ Error creating table {table_name}: {e}")
        sys.exit(1)

# ------------------------------------------------------------------
# 3) Parsing helpers for currency, ranges, and numerics
# ------------------------------------------------------------------
def parse_currency_to_float(val):
    if pd.isna(val):
        return None
    s = str(val).replace('$', '').replace(',', '').strip()
    if '-' in s:
        parts = [p.strip() for p in s.split('-')]
        s = parts[-1]
    try:
        return float(s)
    except ValueError:
        return None

# ------------------------------------------------------------------
# 4) Main ingestion logic
# ------------------------------------------------------------------
if __name__ == "__main__":
    # Enter REIT ticker to process
    ticker = "BXP"  # update as needed
    print(f"Processing property data for Ticker={ticker}...")

    # Locate Excel file (.xlsx or .xls) in "Properties" folder
    file_xlsx = os.path.join(root_folder, ticker, "Properties", f"{ticker} Properties.xlsx")
    file_xls  = os.path.join(root_folder, ticker, "Properties", f"{ticker} Properties.xls")
    if os.path.exists(file_xlsx):
        file_path = file_xlsx
    elif os.path.exists(file_xls):
        file_path = file_xls
    else:
        print("❌ No .xlsx or .xls file found for this REIT Properties.")
        print(f"Tried:\n  {file_xlsx}\n  {file_xls}")
        sys.exit(1)

    print(f"Using file: {file_path}")
    table_name = "reit_properties"
    create_reit_properties_table_if_not_exists(table_name)

    # Read the single-sheet Excel
    try:
        df = pd.read_excel(file_path, header=0)
    except Exception as e:
        print(f"❌ Error reading Excel file: {e}")
        sys.exit(1)

    # Clean and prepare
    df.columns = df.columns.str.strip()
    df.reset_index(inplace=True)
    df.rename(columns={"index": "excel_row_index"}, inplace=True)
    df.rename(columns={
        "Address": "address",
        "Type": "property_type",
        "Secondary Type": "secondary_type",
        "RBA/GLA": "rba_gla",
        "City": "city",
        "Market": "market",
        "Country": "country",
        "Last Sale Price": "last_sale_price",
        "Year Built": "year_built",
        "Asking Rent/yr": "asking_rent_per_year",
    }, inplace=True)

    # Parse numeric fields
    df['rba_gla'] = pd.to_numeric(df['rba_gla'].astype(str).str.replace(',', ''), errors='coerce')
    df['last_sale_price'] = df['last_sale_price'].apply(parse_currency_to_float)
    df['year_built'] = pd.to_numeric(df['year_built'], errors='coerce').astype('Int64')
    df['asking_rent_per_year'] = df['asking_rent_per_year'].apply(parse_currency_to_float)

    # Add ticker
    df['ticker'] = ticker

    # Select and reorder for insertion
    cols = [
        'ticker', 'address', 'property_type', 'secondary_type', 'rba_gla',
        'city', 'market', 'country', 'last_sale_price', 'year_built',
        'asking_rent_per_year', 'excel_row_index'
    ]
    df_to_insert = df[cols].copy()

    # Compute a compact MD5 hash of each row for uniqueness
    def compute_row_hash(row):
        concat = "|".join(str(row[c]) for c in cols)
        return hashlib.md5(concat.encode('utf-8')).hexdigest()

    df_to_insert['row_hash'] = df_to_insert.apply(compute_row_hash, axis=1)

    # Final column order: hash first
    insert_cols = ['row_hash'] + cols
    df_to_insert = df_to_insert[insert_cols]

    # ------------------------------------------------------------------
    # 5) Clear existing property data for this REIT before inserting new data
    # ------------------------------------------------------------------
    print(f"Clearing existing property entries for ticker '{ticker}'...")
    try:
        # Using engine.begin() as conn automatically handles transactions (commit/rollback)
        with engine.begin() as conn:
            delete_query = text("DELETE FROM reit_properties WHERE ticker = :ticker")
            conn.execute(delete_query, {"ticker": ticker})
        print(f"✅ Existing data for '{ticker}' cleared successfully.")
    except Exception as e:
        print(f"❌ Error clearing existing data for {ticker}: {e}")
        sys.exit(1)

    # Insert into MySQL
    try:
        df_to_insert.to_sql(table_name, con=engine, if_exists='append', index=False)
        print(f"✅ Inserted {len(df_to_insert)} rows into {table_name}")
    except Exception as e:
        print(f"❌ Error inserting into {table_name}: {e}")
        sys.exit(1)
