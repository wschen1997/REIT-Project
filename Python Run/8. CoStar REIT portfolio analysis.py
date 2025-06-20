import os
import sys
import re
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ------------------------------------------------------------------
# 1) Load DB credentials from .env
# ------------------------------------------------------------------
script_dir = os.path.dirname(__file__)
dotenv_path = os.path.join(script_dir, "Credentials.env")
load_dotenv(dotenv_path)

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST     = os.getenv("DB_HOST")
DB_PORT     = os.getenv("DB_PORT")
DB_NAME     = os.getenv("DB_NAME")

# SQLAlchemy engine
environment_url = f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(environment_url, connect_args={"ssl": {"fake_flag_to_enable": True}})

# ------------------------------------------------------------------
# 2) Create analysis table if not exists
# ------------------------------------------------------------------
def create_analysis_table(table_name):
    ddl = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticker VARCHAR(10) NOT NULL,
        breakdown_type VARCHAR(50) NOT NULL,
        category VARCHAR(255) NOT NULL,
        rba_gla FLOAT NOT NULL,
        pct FLOAT NOT NULL,
        INDEX idx_ticker (ticker)
    );
    """
    with engine.connect() as conn:
        conn.execute(text(ddl))
    print(f"✅ Verified/created analysis table: {table_name}")

# ------------------------------------------------------------------
# 3) Fetch property data for ticker
# ------------------------------------------------------------------
if __name__ == "__main__":
    ticker = input("Enter REIT ticker to analyze: ").strip().upper()
    table_name = "reit_portfolio_analysis"

    # ensure analysis table exists
    create_analysis_table(table_name)

    # clear previous results for this ticker
    print(f"🗑️ Clearing old analysis for {ticker}...")
    try:
        with engine.begin() as conn: # Use engine.begin() for auto-committing transactions
            conn.execute(
                text(f"DELETE FROM {table_name} WHERE ticker = :ticker"), 
                {"ticker": ticker}
            )
        print(f"✅ Old analysis for {ticker} cleared successfully.")
    except Exception as e:
        print(f"❌ Error clearing old analysis data for {ticker}: {e}")
        sys.exit(1)

    # load properties
    query = text(
        "SELECT property_type, secondary_type, market, country, rba_gla "
        "FROM reit_properties WHERE ticker = :t"
    )
    df = pd.read_sql(query, engine, params={"t": ticker})
    if df.empty:
        print(f"❌ No property data found for {ticker}")
        sys.exit(1)

    # container for results
    results = []

    # breakdown 1: property_type
    df1 = df.dropna(subset=["property_type", "rba_gla"])
    grp1 = df1.groupby("property_type")["rba_gla"].sum().reset_index()
    total1 = grp1["rba_gla"].sum()
    for _, row in grp1.iterrows():
        results.append({
            "ticker": ticker,
            "breakdown_type": "property_type",
            "category": row["property_type"],
            "rba_gla": row["rba_gla"],
            "pct": row["rba_gla"] / total1
        })

    # breakdown 2: secondary_type
    df2 = df.dropna(subset=["secondary_type", "rba_gla"])
    grp2 = df2.groupby("secondary_type")["rba_gla"].sum().reset_index()
    total2 = grp2["rba_gla"].sum()
    for _, row in grp2.iterrows():
        results.append({
            "ticker": ticker,
            "breakdown_type": "secondary_type",
            "category": row["secondary_type"],
            "rba_gla": row["rba_gla"],
            "pct": row["rba_gla"] / total2
        })

    # breakdown 3: US state (domestic)
    df3 = df[(df["country"] == "United States")].dropna(subset=["market", "rba_gla"])
    # extract state code
    df3["state"] = df3["market"].apply(lambda m: m.split(",")[-1].strip() if isinstance(m, str) and "," in m else None)
    df3 = df3.dropna(subset=["state"])
    grp3 = df3.groupby("state")["rba_gla"].sum().reset_index()
    total3 = grp3["rba_gla"].sum()
    for _, row in grp3.iterrows():
        results.append({
            "ticker": ticker,
            "breakdown_type": "state",
            "category": row["state"],
            "rba_gla": row["rba_gla"],
            "pct": row["rba_gla"] / total3
        })

    # breakdown 4: international (by country)
    df4 = df.dropna(subset=["country", "rba_gla"])
    grp4 = df4.groupby("country")["rba_gla"].sum().reset_index()
    total4 = grp4["rba_gla"].sum()
    for _, row in grp4.iterrows():
        results.append({
            "ticker": ticker,
            "breakdown_type": "country",
            "category": row["country"],
            "rba_gla": row["rba_gla"],
            "pct": row["rba_gla"] / total4
        })

    # assemble and write back
    df_res = pd.DataFrame(results)
    df_res.to_sql(table_name, engine, if_exists="append", index=False)
    print(f"✅ Analysis inserted ({len(df_res)} rows) into {table_name}")