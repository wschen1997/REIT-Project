import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

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

# --- Load REIT Price Data for Stability Score ---
try:
    with engine.connect() as conn:
        query = "SELECT * FROM reit_price_data"
        data = pd.read_sql(query, conn)
        print("✅ REIT price data loaded successfully.")
except Exception as e:
    print(f"❌ Error loading REIT price data: {e}")
    exit()

# Ensure 'date' column is in datetime format and sort
try:
    data['date'] = pd.to_datetime(data['date'])
    data.sort_values(by=['ticker', 'date'], inplace=True)
except Exception as e:
    print(f"❌ Error processing 'date' column: {e}")
    exit()

# Calculate daily returns
data['Daily Return'] = data.groupby('ticker')['close_price'].pct_change()

# 2) Define function for Stability Score
def calculate_stability(group):
    ticker = group['ticker'].iloc[0]
    
    # Price-based metrics
    avg_return = group['Daily Return'].mean()
    avg_annual_return = avg_return * 252  # Approx annual trading days
    std_dev = group['Daily Return'].std()
    skewness = group['Daily Return'].skew()
    kurtosis = group['Daily Return'].kurt()
    
    # Volume-based metric: average volume
    # (Consider median, or average dollar-volume, etc., if you prefer)
    avg_volume = group['volume'].mean()
    
    data_length = len(group)
    
    return pd.Series({
        'Ticker': ticker,
        'Average Daily Return': avg_return,
        'Average Annual Return': avg_annual_return,
        'Standard Deviation': std_dev,
        'Skewness': skewness,
        'Kurtosis': kurtosis,
        'Average Volume': avg_volume,
        'Data Length': data_length
    })

# 3) Group by ticker and apply the stability calculation
stability_data = data.groupby('ticker', group_keys=False).apply(calculate_stability)

# 4) Compute Z-scores for main risk metrics
#    We'll add 'Average Volume' below
z_scores = stability_data[['Average Daily Return', 'Standard Deviation', 'Skewness']].apply(
    lambda x: (x - x.mean()) / x.std()
)

# Adjust kurtosis & skewness
stability_data['Adjusted Kurtosis'] = abs(stability_data['Kurtosis'] - 3)
z_scores['Adjusted Kurtosis'] = (
    (stability_data['Adjusted Kurtosis'] - stability_data['Adjusted Kurtosis'].mean())
    / stability_data['Adjusted Kurtosis'].std()
)

# Convert positive skew to negative (so positive skew = lower risk)
z_scores['Skewness Adjustment'] = z_scores['Skewness'].apply(lambda x: x if x < 0 else -x)

# 5) Add Volume Z-score to penalize illiquidity
#    Higher volume => lower risk, so we invert the sign
#    i.e., "Illiquidity Z" = -Z(average volume)
#    so that if volume is high => volume Z is large => illiquidity Z is negative => reduces risk
z_scores['Volume'] = (
    (stability_data['Average Volume'] - stability_data['Average Volume'].mean())
    / stability_data['Average Volume'].std()
)
z_scores['Illiquidity'] = -z_scores['Volume']

# 6) Normalize data length factor
stability_data['Data Length Factor'] = (
    stability_data['Data Length'] / stability_data['Data Length'].max()
)

# 7) Compute Risk Score
#    We add a new term for illiquidity. Example weight: 1.0
#    You can adjust it up or down to emphasize or de-emphasize liquidity in the overall risk.
stability_data['Risk Score'] = (
    (2.0 * z_scores['Standard Deviation']) +
    (0.7 * z_scores['Skewness Adjustment']) +
    (0.5 * z_scores['Adjusted Kurtosis']) -
    (z_scores['Average Daily Return']) +
    (0.8 * z_scores['Illiquidity'])  # Weighted illiquidity factor
) * stability_data['Data Length Factor']

# Compute Stability Percentile
stability_data['Risk Percentile'] = stability_data['Risk Score'].rank(pct=True, ascending=True) * 100
stability_data['Stability Percentile'] = 100 - stability_data['Risk Percentile']

# --- Check if `reit_scoring_analysis` table exists ---
try:
    with engine.connect() as conn:
        result = conn.execute(text("SHOW TABLES LIKE 'reit_scoring_analysis'"))
        table_exists = result.fetchone() is not None
except Exception as e:
    print(f"❌ Error checking if table exists: {e}")
    exit()

# --- If table exists, clear existing data ---
if table_exists:
    try:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM reit_scoring_analysis;"))
            print("✅ Existing reit_scoring_analysis data cleared.")
    except Exception as e:
        print(f"❌ Error clearing reit_scoring_analysis table: {e}")
        exit()
else:
    print("ℹ️ Table 'reit_scoring_analysis' does not exist yet. It will be created.")

# --- Save Stability Percentile Data to MySQL (Replaces `reit_scoring_analysis`) ---
try:
    with engine.connect() as conn:
        stability_data.to_sql('reit_scoring_analysis', con=engine, if_exists='replace', index=False)
        print("✅ Stability scores saved successfully to MySQL (reit_scoring_analysis).")
except Exception as e:
    print(f"❌ Error saving stability scores to MySQL: {e}")

# --- Display Sample Data ---
print(stability_data.head())
