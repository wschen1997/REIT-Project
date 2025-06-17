import os
import sys
import re
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, Table, MetaData
from sqlalchemy.dialects.mysql import insert

# ------------------------------------------------------------------
# 1) Load DB credentials from env
# ------------------------------------------------------------------
# Assumes the script is in a directory and Credentials.env is in the same directory.
# If your script is elsewhere, you might need to adjust the path logic.
try:
    script_dir = os.path.dirname(os.path.realpath(__file__))
except NameError:
    # This fallback is useful for interactive environments like Jupyter
    script_dir = os.getcwd()

dotenv_path = os.path.join(script_dir, "Credentials.env")
load_dotenv(dotenv_path)

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

engine = create_engine(
    f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={"ssl": {"fake_flag_to_enable": True}} # Note: for production, use proper SSL config
)

# ------------------------------------------------------------------
# 2) Prepare the user inputs: Ticker & file path
# ------------------------------------------------------------------
ticker = "JBGS"  # Update REIT you want to process
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
# ------------------------------------------------------------------
def create_reit_table_if_not_exists(table_name):
    """
    Creates the specified table if it doesn't already exist.
    The unique key on (ticker, line_item, fiscal_year, fiscal_quarter) is
    crucial for the upsert logic to work correctly.
    """
    create_query = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticker VARCHAR(10) NOT NULL,
        line_item VARCHAR(255) NOT NULL,
        fiscal_year INT NOT NULL,
        fiscal_quarter INT NULL,
        value DOUBLE,
        excel_row_index INT,
        UNIQUE KEY unique_row (ticker, line_item, fiscal_year, fiscal_quarter)
    );
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(create_query))
            conn.commit()
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
# ------------------------------------------------------------------
def parse_year_quarter(col_name: str):
    """
    Extracts a 4-digit year and a quarter (Q1-Q4) from a column header string.
    Returns (year, quarter) or (None, None) if not found.
    """
    # Find a 4-digit year
    y_match = re.search(r'(19\d{2}|20\d{2})', col_name)
    if not y_match:
        return (None, None)
    year = int(y_match.group(1))

    # Look for "Q1", "Q2", "Q3", or "Q4"
    q_match = re.search(r'Q([1-4])', col_name, flags=re.IGNORECASE)
    if q_match:
        quarter = int(q_match.group(1))
    else:
        quarter = None  # No quarter found

    return (year, quarter)

# ------------------------------------------------------------------
# 5) Function to process a single sheet & UPSERT data
#    MODIFIED: Replaced to_sql() with a robust upsert function.
# ------------------------------------------------------------------
def process_financial_sheet(df_raw, sheet_name, ticker):
    """
    Processes a raw DataFrame from an Excel sheet and upserts the data
    into the corresponding database table.
    """
    table_name = statement_tables[sheet_name]

    df = df_raw.copy()
    df.reset_index(inplace=True)
    df.rename(columns={"index": "excel_row_index"}, inplace=True)

    # Identify line item column vs. data (year) columns
    year_cols = []
    line_item_col = None
    for col in df.columns:
        if re.search(r'(19\d{2}|20\d{2})', str(col)):
            year_cols.append(col)
        elif col not in ["excel_row_index"] and not line_item_col:
            line_item_col = col

    if not line_item_col:
        # Fallback to the first column if detection fails
        line_item_col = df.columns[0]
    
    df.rename(columns={line_item_col: "line_item"}, inplace=True)

    # Data cleaning
    df.replace(["-", "--", "---"], np.nan, inplace=True)
    df.dropna(subset=["line_item"], inplace=True)
    for yc in year_cols:
        df[yc] = pd.to_numeric(df[yc], errors="coerce")

    # Melt dataframe from wide to long format
    df_melted = df.melt(
        id_vars=["excel_row_index", "line_item"],
        value_vars=year_cols,
        var_name="raw_column",
        value_name="value"
    )

    # Parse year and quarter from the raw column header
    df_melted[["fiscal_year", "fiscal_quarter"]] = df_melted["raw_column"].apply(
        lambda x: pd.Series(parse_year_quarter(str(x)))
    )

    # Clean up final dataframe
    df_melted.drop(columns=["raw_column"], inplace=True)
    df_melted["ticker"] = ticker
    df_melted.dropna(subset=["fiscal_year", "value"], inplace=True) # Rows without a year or value are unusable
    df_melted["fiscal_year"] = df_melted["fiscal_year"].astype(int)
    
    # Ensure fiscal_quarter is integer or None (nullable integer)
    df_melted['fiscal_quarter'] = df_melted['fiscal_quarter'].astype('Int64')


    # Reorder columns to match DB table for clarity
    df_melted = df_melted[[
        "ticker",
        "line_item",
        "fiscal_year",
        "fiscal_quarter",
        "value",
        "excel_row_index"
    ]]
    
    if df_melted.empty:
        print(f"ℹ️ No valid data found to process for sheet '{sheet_name}'.")
        return

    # --- UPSERT into MySQL ---
    # This block handles both inserting new rows and updating existing ones
    # if a duplicate is found, based on the `unique_row` key in the table.
    
    # Convert dataframe to a list of dictionaries for insertion
    data_to_insert = df_melted.to_dict(orient='records')
    
    try:
        # Use SQLAlchemy Core to build the upsert statement
        meta = MetaData()
        reit_table = Table(table_name, meta, autoload_with=engine)
        
        stmt = insert(reit_table).values(data_to_insert)
        
        # Define which columns to update if a duplicate key is found
        upsert_stmt = stmt.on_duplicate_key_update(
            value=stmt.inserted.value,
            excel_row_index=stmt.inserted.excel_row_index
        )
        
        # Execute the statement
        with engine.connect() as conn:
            result = conn.execute(upsert_stmt)
            conn.commit()
            # In MySQL, rowcount is 1 for an insert, 2 for an update.
            # So we just print the number of rows we intended to process.
            print(f"✅ Processed {len(data_to_insert)} rows for {table_name}.")

    except Exception as e:
        print(f"❌ Error upserting data into {table_name}: {e}")


# ------------------------------------------------------------------
# 6) Read the Excel’s multiple sheets and process them
# ------------------------------------------------------------------
wanted_sheets = [
    "Income Statement",
    "Balance Sheet",
    "Cash Flow",
    "Industry Specific"
]

print(f"\nReading Excel: {file_path} ...")
try:
    xlsx_dict = pd.read_excel(file_path, sheet_name=None, header=0)
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

print("\n✅ Done processing all sheets for ticker:", ticker)