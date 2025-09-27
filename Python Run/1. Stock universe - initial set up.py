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
DB_PORT = os.getenv("DB_PORT")        
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
print(f"--- SCRIPT IS USING KEY: {FMP_API_KEY} ---")
# File paths (loaded from environment variables)
reit_list_path = os.getenv("REIT_LIST_PATH")

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
    cleaned_price_data.to_sql('reit_price_data', con=engine, if_exists='append', index=False, chunksize=2000, method='multi')
    print("✅ New REIT price data inserted successfully into MySQL.")
except Exception as e:
    print(f"❌ Error inserting price data into MySQL: {e}")

# -------------------- INSERT BUSINESS DATA --------------------
try:
    reit_data.to_sql('reit_business_data', con=engine, if_exists='replace', index=False)
    print("✅ New REIT business data inserted successfully into MySQL.")
except Exception as e:
    print(f"❌ Error inserting business data into MySQL: {e}")
