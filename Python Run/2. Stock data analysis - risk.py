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
stability_data['Risk Score'] = (
    (2.0 * z_scores['Standard Deviation']) +
    (0.7 * z_scores['Skewness Adjustment']) +
    (0.5 * z_scores['Adjusted Kurtosis']) -
    (z_scores['Average Daily Return']) +
    (0.8 * z_scores['Illiquidity'])
) * stability_data['Data Length Factor']

# Compute Stability Percentile
stability_data['Risk Percentile'] = stability_data['Risk Score'].rank(pct=True, ascending=True) * 100
stability_data['Stability Percentile'] = 100 - stability_data['Risk Percentile']


# --- Add the key Z-score components to the final DataFrame ---
stability_data['Z_Score_Std_Dev'] = z_scores['Standard Deviation']
stability_data['Z_Score_Return'] = z_scores['Average Daily Return']
stability_data['Z_Score_Skew'] = z_scores['Skewness Adjustment'] 
stability_data['Z_Score_Kurtosis'] = z_scores['Adjusted Kurtosis']
stability_data['Z_Score_Illiquidity'] = z_scores['Illiquidity']


# --- NEW SECTION: Calculate Intuitive Percentile Ranks ---
print("✅ Calculating intuitive percentile ranks for all Z-score components...")
# For "higher is better" metrics, a higher rank is better.
stability_data['P_Rank_Return'] = stability_data['Z_Score_Return'].rank(pct=True).mul(100).round()

# For "lower is better" metrics, a lower value is better, so we invert the rank.
stability_data['P_Rank_Volatility'] = (1 - stability_data['Z_Score_Std_Dev'].rank(pct=True)).mul(100).round()
stability_data['P_Rank_Skew'] = (1 - stability_data['Z_Score_Skew'].rank(pct=True)).mul(100).round()
stability_data['P_Rank_Kurtosis'] = (1 - stability_data['Z_Score_Kurtosis'].rank(pct=True)).mul(100).round()
stability_data['P_Rank_Illiquidity'] = (1 - stability_data['Z_Score_Illiquidity'].rank(pct=True)).mul(100).round()
# --- END NEW SECTION ---


# --- Save final data to MySQL ---
try:
    # Using 'replace' is the simplest way to ensure the table schema is updated with the new columns.
    stability_data.to_sql('reit_scoring_analysis', con=engine, if_exists='replace', index=False)
    print("✅ Stability scores, Z-scores, and Percentile Ranks saved successfully to MySQL.")
except Exception as e:
    print(f"❌ Error saving final data to MySQL: {e}")


# --- Display Sample Data ---
print("\n--- Final Data Sample ---")
print(stability_data[['Ticker', 'Stability Percentile', 'P_Rank_Return', 'P_Rank_Volatility']].head())