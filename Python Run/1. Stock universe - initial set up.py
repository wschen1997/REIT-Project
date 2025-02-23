import pandas as pd
import requests
import numpy as np
from datetime import datetime, timedelta
import time
import re
from sqlalchemy import create_engine, text
from sqlalchemy.types import Integer, Float
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

# -------------------- CONFIGURATION --------------------
# Load environment variables from Credentials.env
dotenv_path = os.path.join(os.path.dirname(__file__), "Credentials.env")
load_dotenv(dotenv_path)

# Database credentials from environment variables
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")         # <-- Add PORT from .env
DB_NAME = os.getenv("DB_NAME")

# Create database connection with SSL forced
engine = create_engine(
    f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={
        "ssl": {
            "fake_flag_to_enable": True
        }
    }
)

# API Key for Financial Modeling Prep (FMP)
FMP_API_KEY = os.getenv("FMP_API_KEY")

# File paths (loaded from environment variables)
reit_list_path = os.getenv("REIT_LIST_PATH")
ffo_payout_path = os.getenv("FFO_PAYOUT_PATH")
financial_display_path = os.getenv("FINANCIAL_DISPLAY_PATH")

# -------------------- LOAD REIT UNIVERSE --------------------
try:
    reit_data = pd.read_csv(reit_list_path)
    
    def clean_column_name(col_name):
        col_name = col_name.strip()
        col_name = re.sub(r'[^\w]', '_', col_name)
        col_name = re.sub(r'_+', '_', col_name)
        return col_name

    reit_data.columns = [clean_column_name(col) for col in reit_data.columns]
    tickers = reit_data['Ticker'].dropna().astype(str).tolist()  # Ensure tickers are strings
    print("✅ REIT data loaded and sanitized successfully.")
except Exception as e:
    print(f"❌ Error loading REIT list: {e}")
    exit()

# -------------------- FETCH PRICE & VOLUME FROM FMP --------------------
end_date = datetime.now().strftime('%Y-%m-%d')
start_date = (datetime.now() - timedelta(days=5 * 365)).strftime('%Y-%m-%d')

def fetch_ticker_data_fmp(ticker):
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{ticker}?apikey={FMP_API_KEY}"
    try:
        print(f"🔄 Fetching data for {ticker} from FMP...")
        response = requests.get(url)
        try:
            data = response.json()
        except ValueError:
            print(f"❌ Non-JSON response for {ticker}. Skipping.")
            return pd.DataFrame()
        
        if not isinstance(data, dict) or "historical" not in data:
            print(f"❌ No data found for {ticker}. Skipping.")
            return pd.DataFrame()
        
        df = pd.DataFrame(data["historical"])
        df = df[['date', 'close', 'volume']]
        df['ticker'] = ticker  # Add ticker column
        return df
    except Exception as e:
        print(f"❌ Error fetching data for {ticker}: {e}")
        return pd.DataFrame()

# -------------------- FETCH & STORE PRICE DATA --------------------
cleaned_price_data = pd.DataFrame()
for ticker in tickers:
    ticker_data = fetch_ticker_data_fmp(ticker)
    if not ticker_data.empty:
        cleaned_price_data = pd.concat([cleaned_price_data, ticker_data], ignore_index=True)
    time.sleep(0.02)  # Small delay to avoid rate limits

if cleaned_price_data.empty:
    print("❌ No data fetched. Exiting.")
    exit()

# -------------------- SQL DATABASE SETUP --------------------
drop_price_table_query = "DROP TABLE IF EXISTS reit_price_data;"
create_price_table_query = (
    "CREATE TABLE reit_price_data ("
    "date DATE NOT NULL, "
    "ticker VARCHAR(10) NOT NULL, "
    "close_price FLOAT NOT NULL, "
    "volume FLOAT, "
    "PRIMARY KEY (date, ticker)"
    ");"
)

# Build business table creation query explicitly
business_columns = ""
for col in reit_data.columns:
    if col:
        business_columns += f"{col} VARCHAR(255), "
business_columns = business_columns.rstrip(", ")
create_business_table_query = f"CREATE TABLE IF NOT EXISTS reit_business_data ({business_columns});"

try:
    with engine.connect() as conn:
        print("Dropping existing reit_price_data table (if any)...")
        conn.execute(text(drop_price_table_query))
        print("Creating new reit_price_data table...")
        conn.execute(text(create_price_table_query))
        print("Verifying/creating reit_business_data table...")
        conn.execute(text(create_business_table_query))
        print("✅ SQL Tables created successfully.")
except Exception as e:
    print(f"❌ Error setting up tables: {e}")
    exit()

# -------------------- INSERT PRICE DATA --------------------
cleaned_price_data.rename(columns={'date': 'date', 'ticker': 'ticker', 'close': 'close_price', 'volume': 'volume'}, inplace=True)
cleaned_price_data.drop_duplicates(subset=['date', 'ticker'], keep='last', inplace=True)
try:
    cleaned_price_data.to_sql('reit_price_data', con=engine, if_exists='append', index=False)
    print("✅ New REIT price data inserted successfully into MySQL.")
except Exception as e:
    print(f"❌ Error inserting price data into MySQL: {e}")

# -------------------- INSERT BUSINESS DATA --------------------
try:
    reit_data.to_sql('reit_business_data', con=engine, if_exists='replace', index=False)
    print("✅ New REIT business data inserted successfully into MySQL.")
except Exception as e:
    print(f"❌ Error inserting business data into MySQL: {e}")

# -------------------- LOAD & INSERT FFO PAYOUT DATA --------------------
try:
    ffo_payout_data = pd.read_csv(ffo_payout_path, dtype=str, keep_default_na=False)
    ffo_payout_data["Years"] = pd.to_numeric(ffo_payout_data["Years"], errors="coerce").dropna().astype(int)
    ffo_payout_data.replace(["NA", "Inf", "-Inf", ""], np.nan, inplace=True)
    for col in ffo_payout_data.columns[1:]:
        ffo_payout_data[col] = pd.to_numeric(ffo_payout_data[col], errors="coerce")
    # Sanitize column names for FFO payout data
    def clean_column_name(col_name):
        col_name = col_name.strip()
        col_name = re.sub(r'[^\w]', '_', col_name)
        col_name = re.sub(r'_+', '_', col_name)
        return col_name
    ffo_payout_data.columns = [clean_column_name(col) for col in ffo_payout_data.columns]
    print("✅ REIT FFO Payout data loaded and sanitized successfully.")
except Exception as e:
    print(f"❌ Error loading REIT FFO Payout list: {e}")
    exit()

# Build FFO payout table creation query explicitly
ffo_columns = ""
for col in ffo_payout_data.columns:
    if col != "Years" and col:
        ffo_columns += f"{col} FLOAT, "
ffo_columns = ffo_columns.rstrip(", ")
if ffo_columns:
    create_ffo_payout_table_query = f"CREATE TABLE IF NOT EXISTS reit_ffo_payout (Years INT NOT NULL, {ffo_columns});"
else:
    create_ffo_payout_table_query = "CREATE TABLE IF NOT EXISTS reit_ffo_payout (Years INT NOT NULL);"

try:
    with engine.connect() as conn:
        conn.execute(text(create_ffo_payout_table_query))
        print("✅ REIT FFO Payout table created successfully.")
except Exception as e:
    print(f"❌ Error creating FFO Payout table: {e}")
    exit()

try:
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM reit_ffo_payout;"))
        print("✅ Existing REIT FFO Payout data cleared.")
except Exception as e:
    print(f"❌ Error clearing FFO Payout data: {e}")
    exit()

try:
    ffo_payout_data.to_sql(
        'reit_ffo_payout',
        con=engine,
        if_exists='replace',
        index=False,
        dtype={'Years': Integer()}
    )
    print("✅ New REIT FFO Payout data inserted successfully into MySQL.")
except Exception as e:
    print(f"❌ Error inserting FFO Payout data into MySQL: {e}")

# -------------------- LOAD & INSERT FINANCIAL DISPLAY DATA --------------------
try:
    # Read CSV and skip any columns that start with 'Unnamed' if desired,
    # or keep them (they may appear due to extra delimiters)
    df_fd = pd.read_csv(financial_display_path)
    
    # Sanitize all column names
    def clean_column_name(col_name):
        col_name = col_name.strip()
        # Replace any non-alphanumeric characters (including colon) with an underscore
        col_name = re.sub(r'[^\w]+', '_', col_name)
        return col_name

    df_fd.columns = [clean_column_name(c) for c in df_fd.columns]

    # Ensure first column is "Dates"
    if df_fd.columns[0] != "Dates":
        df_fd.rename(columns={df_fd.columns[0]: "Dates"}, inplace=True)
    
    # Replace placeholder values
    df_fd.replace(["NA", "Inf", "-Inf", ""], np.nan, inplace=True)
    
    # Convert "Dates" to datetime
    df_fd["Dates"] = pd.to_datetime(df_fd["Dates"], errors="coerce")
    
    # Convert all other columns to numeric
    for col in df_fd.columns.drop("Dates"):
        df_fd[col] = pd.to_numeric(df_fd[col], errors="coerce")
    
    print("✅ REIT Financial Display data loaded and sanitized successfully.")
except Exception as e:
    print(f"❌ Error loading REIT Financial Display: {e}")
    exit()

# Build Financial Display table creation query explicitly
fd_columns = ""
for col in df_fd.columns:
    if col != "Dates" and col:
        fd_columns += f"{col} FLOAT, "
fd_columns = fd_columns.rstrip(", ")
if fd_columns:
    create_financial_display_table_query = f"CREATE TABLE IF NOT EXISTS reit_financial_display (Dates DATE, {fd_columns});"
else:
    create_financial_display_table_query = "CREATE TABLE IF NOT EXISTS reit_financial_display (Dates DATE);"

print("Financial Display Table Query:")
print(create_financial_display_table_query)

try:
    with engine.connect() as conn:
        conn.execute(text(create_financial_display_table_query))
        print("✅ REIT Financial Display table created successfully.")
except Exception as e:
    print(f"❌ Error creating Financial Display table: {e}")
    exit()

try:
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM reit_financial_display;"))
        print("✅ Existing REIT Financial Display data cleared.")
except Exception as e:
    print(f"❌ Error clearing Financial Display data: {e}")
    exit()

# Use if_exists='replace' to ensure the table is recreated with the current DataFrame schema
try:
    df_fd.to_sql(
        'reit_financial_display',
        con=engine,
        if_exists='replace',  # Recreate the table so its schema matches the DataFrame
        index=False
    )
    print("✅ New REIT Financial Display data inserted successfully into MySQL.")
except Exception as e:
    print(f"❌ Error inserting Financial Display data into MySQL: {e}")
