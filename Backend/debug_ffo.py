# debug_ffo.py

import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# 1. SETUP - Connect to the same database as your app
# ----------------------------------------------------------------
print("--- SCRIPT SETUP ---")
try:
    # This path assumes the script is in the same folder as your .env file's location reference
    dotenv_path = os.path.abspath("C:/Users/wsche/OneDrive/桌面/Investment Research/Startup Project/Python Run/Credentials.env")
    load_dotenv(dotenv_path)
    print("✅ Loaded database credentials.")
except Exception as e:
    print(f"❌ Could not load .env file: {e}")
    exit()

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

try:
    engine = create_engine(
        f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
        connect_args={"ssl": {"fake_flag_to_enable": True}}
    )
    print("✅ Database engine created.")
except Exception as e:
    print(f"❌ Could not create database engine: {e}")
    exit()

# The specific ticker and line item we want to investigate
TICKER_TO_DEBUG = "BNL"
LINE_ITEM_TO_DEBUG = "FFO"
print(f"🎯 Debugging '{LINE_ITEM_TO_DEBUG}' for ticker '{TICKER_TO_DEBUG}'...\n")


# 2. FETCH RAW DATA - Get the exact same data the API uses
# ----------------------------------------------------------------
sql_query = text("""
    SELECT fiscal_year, fiscal_quarter, value
    FROM reit_industry_metrics
    WHERE ticker = :ticker AND line_item = :line_item
    ORDER BY fiscal_year, fiscal_quarter
""")

with engine.connect() as conn:
    df_raw = pd.read_sql(sql_query, conn, params={"ticker": TICKER_TO_DEBUG, "line_item": LINE_ITEM_TO_DEBUG})

print(f"--- STEP 1: RAW '{LINE_ITEM_TO_DEBUG}' DATA FOR {TICKER_TO_DEBUG} ---")
print(df_raw)
print("-" * 50)


# 3. REPLICATE THE CALCULATION - Step-by-step
# ----------------------------------------------------------------
if not df_raw.empty:
    # Create the time-series index, just like the API does
    df_raw['period'] = pd.PeriodIndex.from_fields(year=df_raw['fiscal_year'], quarter=df_raw['fiscal_quarter'], freq='Q')
    
    # Create a clean Series with the time period as the index
    ffo_series = df_raw.set_index('period')['value']
    
    print(f"--- STEP 2: TIME-SERIES DATA FOR {TICKER_TO_DEBUG} ---")
    print(ffo_series)
    print("-" * 50)
    
    # Calculate the Year-over-Year growth for ALL periods
    yoy_growths = ffo_series.pct_change(periods=4)
    
    print(f"--- STEP 3: INDIVIDUAL YOY GROWTHS (This is what we need!) ---")
    # We combine the original value and the calculated growth for easy viewing
    debug_df = pd.DataFrame({'FFO_Value': ffo_series, 'YoY_Growth': yoy_growths})
    print(debug_df)
    print("-" * 50)
    
    # Isolate the last 4 growth periods that are being averaged
    last_4_growths = yoy_growths.tail(4)
    
    print(f"--- STEP 4: LAST 4 QUARTERS USED FOR AVERAGING ---")
    print(last_4_growths)
    print("-" * 50)
    
    # Calculate the final average
    final_average = last_4_growths.mean()
    
    print(f"--- STEP 5: FINAL CALCULATED AVERAGE ---")
    print(f"{final_average:.4f} (or {final_average:.2%})")
    print("-" * 50)

else:
    print(f"❌ No '{LINE_ITEM_TO_DEBUG}' data found for ticker {TICKER_TO_DEBUG}.")