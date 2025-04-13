import os
import sys
import re
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ------------------------------------------------------------------
# 1) Load DB credentials from env
# ------------------------------------------------------------------
script_dir = os.path.dirname(__file__)
dotenv_path = os.path.join(script_dir, "Credentials.env")
load_dotenv(dotenv_path)

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

engine = create_engine(
    f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={"ssl": {"fake_flag_to_enable": True}}
)

# ------------------------------------------------------------------
# 2) Prepare the user inputs: Ticker & file path
# ------------------------------------------------------------------
ticker = "ESS"  # Update REIT you want to process
print(f"Processing data for Ticker={ticker}...")

root_folder = os.getenv("REIT_RAW_FINANCIALS_PATH")
xlsx_file_name = f"{ticker} Financials.xlsx"
xls_file_name = f"{ticker} Financials.xls"

file_path_xlsx = os.path.join(root_folder, ticker, "Financials", xlsx_file_name)
file_path_xls = os.path.join(root_folder, ticker, "Financials", xls_file_name)

if os.path.exists(file_path_xlsx):
    file_path = file_path_xlsx
elif os.path.exists(file_path_xls):
    file_path = file_path_xls
else:
    print("❌ No .xlsx or .xls file found for this REIT.\n"
          f"Tried:\n  {file_path_xlsx}\n  {file_path_xls}")
    sys.exit(1)

print(f"Using file: {file_path}")

# ------------------------------------------------------------------
# 3) Helper: Create or verify each statement table
#    We'll store data in row-based format with an additional
#    'fiscal_quarter' column. The unique constraint is now
#    (ticker, line_item, fiscal_year, fiscal_quarter).
#    ADDED: excel_row_index INT for preserving row order.
# ------------------------------------------------------------------
def create_reit_table_if_not_exists(table_name):
    create_query = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticker VARCHAR(10) NOT NULL,
        line_item VARCHAR(255) NOT NULL,
        fiscal_year INT NOT NULL,
        fiscal_quarter INT NULL,
        value FLOAT,
        excel_row_index INT,
        UNIQUE KEY unique_row (ticker, line_item, fiscal_year, fiscal_quarter)
    );
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(create_query))
        print(f"✅ Verified/created table: {table_name}")
    except Exception as e:
        print(f"❌ Error creating table {table_name}: {e}")
        sys.exit(1)

statement_tables = {
    "Income Statement": "reit_income_statement",
    "Balance Sheet": "reit_balance_sheet",
    "Cash Flow": "reit_cash_flow",
    "Industry Specific": "reit_industry_metrics",
}

for sheet_name, table_name in statement_tables.items():
    create_reit_table_if_not_exists(table_name)

# ------------------------------------------------------------------
# 4) Quarter/Year parsing
#    We'll look for a 4-digit year and "Q1","Q2","Q3","Q4" in
#    the column name. If no quarter is found, defaults to None.
# ------------------------------------------------------------------
def parse_year_quarter(col_name: str):
    """
    Example column strings might be:
      "Reclassified\n3 months\nQ1\nMar-31-2015"
      "3 months Q2 Jun-30-2016"
      "12 months Dec-31-2015"
    We'll extract the 4-digit year + quarter (if present).
    Returns (year, quarter) or (None, None) if not found.
    """
    # Find a 4-digit year
    y_match = re.search(r'(19\d{2}|20\d{2})', col_name)
    if not y_match:
        return (None, None)
    year = int(y_match.group(1))

    # Look for "Q1", "Q2", "Q3", or "Q4"
    q_match = re.search(r'(Q[1-4])', col_name, flags=re.IGNORECASE)
    if q_match:
        # e.g. "Q1" -> quarter=1
        quarter_str = q_match.group(1).upper()
        quarter = int(quarter_str[1])
    else:
        # if no quarter found, we can store None or default to 4, etc.
        quarter = None

    return (year, quarter)

# ------------------------------------------------------------------
# 5) Function to process a single sheet (DataFrame) & insert
#    ADDED: preserve original Excel row order via excel_row_index.
# ------------------------------------------------------------------
def process_financial_sheet(df_raw, sheet_name, ticker):
    table_name = statement_tables[sheet_name]

    df = df_raw.copy()

    # Preserve original Excel row order:
    df.reset_index(inplace=True)  # moves the current index to a column called 'index'
    df.rename(columns={"index": "excel_row_index"}, inplace=True)

    # Identify which column is line_item vs. which are value columns
    year_cols = []
    line_item_col = None

    for col in df.columns:
        if re.search(r'(19\d{2}|20\d{2})', str(col)):
            year_cols.append(col)
        else:
            if col not in ["excel_row_index"] and not line_item_col:
                line_item_col = col

    if not line_item_col:
        line_item_col = df.columns[0]

    # Rename that column to "line_item"
    df.rename(columns={line_item_col: "line_item"}, inplace=True)

    # Convert "-" or other placeholders to NaN
    df.replace("-", np.nan, inplace=True)
    df.infer_objects(copy=False)

    # Drop rows that have no line_item
    df.dropna(subset=["line_item"], inplace=True)

    # Convert each year col to numeric if possible
    for yc in year_cols:
        df[yc] = pd.to_numeric(df[yc], errors="coerce")

    # Melt into long form, including excel_row_index in id_vars
    df_melted = df.melt(
        id_vars=["excel_row_index", "line_item"],
        value_vars=year_cols,
        var_name="raw_column",
        value_name="value"
    )

    # Parse out (year, quarter)
    df_melted["year_quarter"] = df_melted["raw_column"].apply(lambda x: parse_year_quarter(str(x)))
    df_melted["fiscal_year"] = df_melted["year_quarter"].apply(lambda x: x[0])
    df_melted["fiscal_quarter"] = df_melted["year_quarter"].apply(lambda x: x[1])
    df_melted.drop(columns=["raw_column", "year_quarter"], inplace=True)

    # Add ticker
    df_melted["ticker"] = ticker

    # Drop rows missing a year (no year => can't store them)
    df_melted.dropna(subset=["fiscal_year"], inplace=True)
    df_melted["fiscal_year"] = df_melted["fiscal_year"].astype(int)

    # Reorder columns to include excel_row_index
    df_melted = df_melted[[
        "ticker",
        "line_item",
        "fiscal_year",
        "fiscal_quarter",
        "value",
        "excel_row_index"
    ]]

    # Insert into MySQL
    try:
        df_melted.to_sql(table_name, con=engine, if_exists='append', index=False)
        print(f"✅ Inserted {len(df_melted)} rows into {table_name}")
    except Exception as e:
        print(f"❌ Error inserting into {table_name}: {e}")

# ------------------------------------------------------------------
# 6) Read the Excel’s multiple sheets
# ------------------------------------------------------------------
wanted_sheets = [
    "Income Statement",
    "Balance Sheet",
    "Cash Flow",
    "Industry Specific"
]

print(f"Reading Excel: {file_path} ...")
try:
    xlsx_dict = pd.read_excel(file_path, sheet_name=None)
except Exception as e:
    print(f"❌ Error reading Excel file: {e}")
    sys.exit(1)

for sheet in wanted_sheets:
    if sheet in xlsx_dict:
        print(f"🔎 Processing sheet '{sheet}'...")
        df_sheet = xlsx_dict[sheet]
        process_financial_sheet(df_sheet, sheet, ticker)
    else:
        print(f"⚠️ Sheet '{sheet}' not found; skipping.")

print("✅ Done processing all sheets for ticker:", ticker) 