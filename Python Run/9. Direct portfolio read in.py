import os
import sys
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text


def create_reit_portfolio_table_if_not_exists(engine, table_name):
    create_query = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticker VARCHAR(10) NOT NULL,
        breakdown_type VARCHAR(50),
        category VARCHAR(255),
        rba_gla BIGINT,
        pct FLOAT,
        source VARCHAR(512) NULL,
        basis  TEXT        NULL,
        UNIQUE KEY unique_entry (ticker, breakdown_type, category)
    );
    """
    with engine.connect() as conn:
        conn.execute(text(create_query))


if __name__ == "__main__":
    # Load environment variables
    script_dir = os.path.dirname(__file__)
    load_dotenv(os.path.join(script_dir, "Credentials.env"))

    DB_USERNAME = os.getenv("DB_USERNAME")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST     = os.getenv("DB_HOST")
    DB_PORT     = os.getenv("DB_PORT")
    DB_NAME     = os.getenv("DB_NAME")
    root_folder = os.getenv("REIT_RAW_PORTFOLIO_PATH")

    # Prompt for ticker
    ticker = input("Enter REIT ticker: ").strip().upper()

    # Setup database connection
    engine = create_engine(
        f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
        connect_args={"ssl": {"fake_flag_to_enable": True}}
    )

    table_name = "reit_portfolio_analysis"
    create_reit_portfolio_table_if_not_exists(engine, table_name)

    # Delete existing data for this ticker
    with engine.connect() as conn:
        conn.execute(text(f"DELETE FROM {table_name} WHERE ticker = :ticker"), {"ticker": ticker})
        print(f"✅ Cleared existing records for ticker {ticker}")

    # Locate the Excel file
    file_xlsx = os.path.join(root_folder, ticker, "Portfolio", f"{ticker} Portfolio.xlsx")
    file_xls  = os.path.join(root_folder, ticker, "Portfolio", f"{ticker} Portfolio.xls")
    if os.path.exists(file_xlsx):
        file_path = file_xlsx
    elif os.path.exists(file_xls):
        file_path = file_xls
    else:
        print("❌ No 'REIT Portfolio' spreadsheet found for this ticker.")
        print(f"Tried:\n  {file_xlsx}\n  {file_xls}")
        sys.exit(1)

    print(f"Using file: {file_path}")

    # Read data
    try:
        df = pd.read_excel(file_path, header=0)
    except Exception as e:
        print(f"❌ Error reading Excel file: {e}")
        sys.exit(1)

    # Normalize column names
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(" ", "_", regex=False)
    )

    # Add ticker column
    df["ticker"] = ticker

    # Select relevant columns
    expected_cols = ["ticker", "breakdown_type", "category", "rba_gla", "pct","source", "basis"]
    df_to_insert = df[expected_cols].copy()

    # Insert into DB
    try:
        df_to_insert.to_sql(table_name, con=engine, if_exists="append", index=False)
        print(f"✅ Inserted {len(df_to_insert)} rows into {table_name}")
    except Exception as e:
        print(f"❌ Error inserting into {table_name}: {e}")
        sys.exit(1)
