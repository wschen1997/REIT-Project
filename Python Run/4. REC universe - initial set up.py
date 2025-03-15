# Load_REC_Data.py

import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.types import Integer, Float
import re

# ---------------------------------------------------------
# 1) LOAD ENVIRONMENT VARIABLES & CONFIGURE DB CONNECTION
# ---------------------------------------------------------
# Note: Assumes "Credentials.env" is in the same directory,
#       or update the path below as needed.
dotenv_path = os.path.join(os.path.dirname(__file__), "Credentials.env")
load_dotenv(dotenv_path)

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# REC file paths from environment variables
REC_LIST_PATH = os.getenv("REC_LIST_PATH")
REC_RETURN_PATH = os.getenv("REC_RETURN_PATH")
REC_DISTRIBUTION_PATH = os.getenv("REC_DISTRIBUTION_PATH")
REC_NAV_PATH = os.getenv("REC_NAV_PATH")

# Create a forced-SSL database connection
engine = create_engine(
    f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={
        "ssl": {
            "fake_flag_to_enable": True
        }
    }
)

# ---------------------------------------------------------
# 2) DEFINE UTILITY FUNCTION FOR COLUMN NAME SANITIZATION
# ---------------------------------------------------------
def clean_column_name(col_name):
    """
    Strip leading/trailing whitespace,
    replace non-alphanumeric with underscore,
    collapse multiple underscores into one.
    """
    col_name = col_name.strip()
    col_name = re.sub(r"[^\w]+", "_", col_name)
    col_name = re.sub(r"_+", "_", col_name)
    return col_name

# ---------------------------------------------------------
# 3) HELPER: READ & SANITIZE A CSV FILE
# ---------------------------------------------------------
def read_and_clean_csv(file_path, date_columns=None, numeric_columns=None):
    """
    - Reads a CSV into a DataFrame.
    - Sanitizes column names.
    - Replaces placeholders ("NA", "Inf", "-Inf", "") with NaN.
    - Converts date_columns to datetime (if any).
    - Converts numeric_columns to numeric (if any).
    - If no specific columns are provided, tries to infer numeric columns from all columns except date_columns.
    """
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
        return pd.DataFrame()

    # Sanitize column names
    df.columns = [clean_column_name(col) for col in df.columns]

    # Replace placeholder values with NaN
    df.replace(["NA", "Inf", "-Inf", ""], np.nan, inplace=True)

    # If user specified date columns, convert them to datetime
    if date_columns:
        for dc in date_columns:
            if dc in df.columns:
                df[dc] = pd.to_datetime(df[dc], errors="coerce")

    # If user specified numeric columns, convert them
    if numeric_columns:
        for nc in numeric_columns:
            if nc in df.columns:
                df[nc] = pd.to_numeric(df[nc], errors="coerce")
    else:
        # Otherwise, try to convert all non-date columns to numeric
        possible_numeric_cols = df.columns.difference(date_columns or [])
        for col in possible_numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="ignore")  # "ignore" means leave alone if not convertible

    return df

# ---------------------------------------------------------
# 4) CREATE / REPLACE TABLE AND INSERT DATA
# ---------------------------------------------------------
def create_or_replace_table(df, table_name):
    """
    - Creates (or replaces) a table using df.to_sql(..., if_exists='replace').
    - For flexible schema, we rely on to_sql’s automatic handling, or
      you can build a manual CREATE TABLE if you prefer stricter control.
    """
    if df.empty:
        print(f"⚠️ No data to insert for {table_name}. Skipping.")
        return

    try:
        df.to_sql(
            table_name,
            con=engine,
            if_exists='replace',  # Replace table if it already exists
            index=False
        )
        print(f"✅ Data inserted successfully into table: {table_name}")
    except Exception as e:
        print(f"❌ Error inserting data into {table_name}: {e}")

# ---------------------------------------------------------
# 5) MAIN LOGIC FOR LOADING REC CSVs INTO MYSQL
# ---------------------------------------------------------
def main():
    print("=== STARTING REC DATA LOAD ===")

    # -------------------- LOAD 'REC Universe' --------------------
    rec_universe_df = read_and_clean_csv(REC_LIST_PATH)
    create_or_replace_table(rec_universe_df, "rec_universe")

    # -------------------- LOAD 'REC Total Return' ----------------
    rec_return_df = read_and_clean_csv(REC_RETURN_PATH)
    create_or_replace_table(rec_return_df, "rec_total_return")

    # -------------------- LOAD 'REC Distribution Yield' ----------
    rec_distribution_df = read_and_clean_csv(REC_DISTRIBUTION_PATH)
    create_or_replace_table(rec_distribution_df, "rec_distribution_yield")

    # -------------------- LOAD 'REC NAV Growth' ------------------
    rec_nav_df = read_and_clean_csv(REC_NAV_PATH)
    create_or_replace_table(rec_nav_df, "rec_nav_growth")

    print("=== ALL REC DATA LOADED SUCCESSFULLY ===")


if __name__ == "__main__":
    main()
