import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text

# Database credentials
DB_USERNAME = "wsche"
DB_PASSWORD = "Tyreke1211"
DB_HOST = "127.0.0.1"
DB_NAME = "investment_data"

# Create database connection
engine = create_engine(f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}")

# --- Load REIT FFO Payout Data ---
try:
    with engine.connect() as conn:
        query = "SELECT * FROM reit_ffo_payout"
        ffo_data = pd.read_sql(query, conn)
        print("✅ REIT FFO Payout data loaded successfully.")
except Exception as e:
    print(f"❌ Error loading REIT FFO Payout data: {e}")
    exit()

# --- Load REIT Scoring Analysis Data ---
try:
    with engine.connect() as conn:
        query = "SELECT * FROM reit_scoring_analysis"
        scoring_data = pd.read_sql(query, conn)
        print("✅ REIT Scoring Analysis data loaded successfully.")
except Exception as e:
    print(f"❌ Error loading REIT Scoring Analysis data: {e}")
    exit()

# --- Standardize column names ---
if "Ticker" in scoring_data.columns:
    scoring_data.rename(columns={"Ticker": "ticker"}, inplace=True)

# Remove previous FFO_Payout_Score before merging
scoring_data.drop(columns=["FFO_Payout_Score"], errors="ignore", inplace=True)

# --- Preprocess FFO Data ---
ffo_data_long = ffo_data.melt(id_vars=["Years"], var_name="ticker", value_name="FFO_Payout")
ffo_data_long["ticker"] = ffo_data_long["ticker"].str.replace("_US_Equity", "", regex=True)

# Find the most recent year with data
valid_years = ffo_data_long.dropna(subset=["FFO_Payout"])["Years"]
latest_year = valid_years.max() if not valid_years.empty else ffo_data_long["Years"].max()

# Select the last 5 years dynamically
ffo_data_filtered = ffo_data_long[ffo_data_long["Years"] >= latest_year - 4]

# --- Define FFO Payout Score Calculation ---
def calculate_ffo_score(series):
    valid_values = series.dropna()
    if len(valid_values) == 0:
        return np.nan  # If no valid values, return NaN

    avg_payout = valid_values.mean()
    std_dev = valid_values.std(ddof=1)  # Match Excel's STDEV.S

    level_fit = max(1 - abs(avg_payout / 65 - 1), 0)
    # Evaluates how closely a REIT's average FFO payout aligns with the target 65% payout, which is considered sustainable.
    # avg_payout / 65: Normalizes the average payout relative to 65%.
    # Subtracting 1: Measures how far the payout is from the ideal 65%.
    # Abs: Ensures both overpayment (too high) and underpayment (too low) are penalized equally.
    # max(1 - abs(...), 0): Floors the score at 0 to avoid negative values.
    # If avg_payout = 65% → level_fit = 1 (perfect fit).
    # If avg_payout = 0% or 100% → level_fit = 0 (worst fit).
    # If avg_payout = 130% or 35% → level_fit ≈ 0.46 (moderate fit).
    # Negative payouts automatically receive a Level Fit of 0 because they are far from the 65% target.
    stability = 1 / (1 + std_dev) if not np.isnan(std_dev) else 0
    # Evaluates the stability of FFO payouts over the last five years.
    # The score is calculated as 1 / (1 + std_dev), ensuring higher stability scores for lower standard deviations.
    # If all values are NaN, std_dev becomes NaN, and stability is set to 0 (worst stability).
    return (0.6 * level_fit) + (0.4 * stability)

# Compute FFO Payout Scores
ffo_scores = ffo_data_filtered.groupby("ticker")["FFO_Payout"].apply(calculate_ffo_score).reset_index()
ffo_scores.rename(columns={"FFO_Payout": "FFO_Payout_Score"}, inplace=True)

# --- Merge FFO Payout Scores into REIT Scoring Analysis ---
final_data = scoring_data.merge(ffo_scores, on="ticker", how="left")

# --- Load REIT Business Data (FFO PS LTM) ---
try:
    with engine.connect() as conn:
        query = "SELECT Ticker, FFO_PS_Annualized FROM reit_business_data"
        ffo_ltm_data = pd.read_sql(query, conn)
        print("✅ REIT Business Data (LTM FFO PS) loaded successfully.")
except Exception as e:
    print(f"❌ Error loading REIT Business Data: {e}")
    exit()

# --- Load Latest REIT Stock Prices ---
try:
    with engine.connect() as conn:
        query = """
            SELECT ticker, close_price
            FROM reit_price_data
            WHERE date = (SELECT MAX(date) FROM reit_price_data)
        """
        price_data = pd.read_sql(query, conn)
        print("✅ Latest REIT stock prices loaded successfully.")
except Exception as e:
    print(f"❌ Error loading latest REIT stock prices: {e}")
    exit()

# --- Standardize Column Names for Merging ---
ffo_ltm_data.rename(columns={"Ticker": "ticker"}, inplace=True)

# --- Merge LTM FFO PS with Latest Price ---
ffo_yield_data = ffo_ltm_data.merge(price_data, on="ticker", how="left")

# Compute FFO Yield
ffo_yield_data["FFO_Yield"] = ffo_yield_data["FFO_PS_Annualized"] / ffo_yield_data["close_price"]
ffo_yield_data["FFO_Yield"].replace([np.inf, -np.inf], np.nan, inplace=True)

# --- Merge FFO Yield into REIT Scoring Analysis ---
if "FFO_Yield" in final_data.columns:
    final_data.drop(columns=["FFO_Yield"], inplace=True)

final_data = final_data.merge(ffo_yield_data[["ticker", "FFO_Yield"]], on="ticker", how="left")

# --- Remove any existing FFO_Yield_Z column before merging ---
if "FFO_Yield_Z" in final_data.columns:
    final_data.drop(columns=["FFO_Yield_Z"], inplace=True)

# --- Calculate Z-score for FFO Yield ---
ffo_yield_data["FFO_Yield_Z"] = (ffo_yield_data["FFO_Yield"] - ffo_yield_data["FFO_Yield"].mean()) / ffo_yield_data["FFO_Yield"].std()

# --- Merge FFO_Yield_Z into REIT Scoring Analysis ---
# FFO Payout was already scaled to 0-1, so no need to scale again with Z-score.
final_data = final_data.merge(ffo_yield_data[["ticker", "FFO_Yield_Z"]], on="ticker", how="left")

# --- Load REIT Business Data (5-Year FFO Growth) ---
try:
    with engine.connect() as conn:
        query = "SELECT Ticker, 5YR_FFO_Growth FROM reit_business_data"
        ffo_growth_data = pd.read_sql(query, conn)
        print("✅ REIT Business Data (5-Year FFO Growth) loaded successfully.")
except Exception as e:
    print(f"❌ Error loading REIT Business Data: {e}")
    exit()

# --- Standardize Column Names for Merging ---
ffo_growth_data.rename(columns={"Ticker": "ticker"}, inplace=True)

# --- Drop missing values before calculating Z-score ---
ffo_growth_data.dropna(subset=["5YR_FFO_Growth"], inplace=True)

# --- Calculate Z-score for 5-Year FFO Growth ---
ffo_growth_data["5YR_FFO_Growth_Z"] = (ffo_growth_data["5YR_FFO_Growth"] - ffo_growth_data["5YR_FFO_Growth"].mean()) / ffo_growth_data["5YR_FFO_Growth"].std()

# Handle potential infinite or NaN values
ffo_growth_data["5YR_FFO_Growth_Z"].replace([np.inf, -np.inf], np.nan, inplace=True)

# --- Merge 5-Year FFO Growth Z-score into REIT Scoring Analysis ---
if "5YR_FFO_Growth_Z" in final_data.columns:
    final_data.drop(columns=["5YR_FFO_Growth_Z"], inplace=True)

final_data = final_data.merge(ffo_growth_data[["ticker", "5YR_FFO_Growth_Z"]], on="ticker", how="left")

# --- Remove any existing Fundamental Score column before merging ---
if "Fundamental_Score" in final_data.columns:
    final_data.drop(columns=["Fundamental_Score"], inplace=True)

# --- Define Weights for Fundamental Score Components ---
w1, w2, w3 = 1/3, 1/3, 1/3  # Adjust weightings if needed

# --- Calculate the Fundamental Score ---
final_data["Fundamental_Score"] = (
    (w1 * final_data["FFO_Payout_Score"]) +
    (w2 * final_data["FFO_Yield_Z"]) +
    (w3 * final_data["5YR_FFO_Growth_Z"])
)

# Handle NaN values (in case any stocks are missing some components)
final_data["Fundamental_Score"].fillna(0, inplace=True)

# -- Remove any existing Fundamental_Percentile column --
if "Fundamental_Percentile" in final_data.columns:
    final_data.drop(columns=["Fundamental_Percentile"], inplace=True)

# -- Create a new Fundamental_Percentile column (0-100) --
final_data["Fundamental_Percentile"] = final_data["Fundamental_Score"].rank(method="average", pct=True) * 100

# --- Rename 'ticker' back to 'Ticker' before saving ---
final_data.rename(columns={"ticker": "Ticker"}, inplace=True)

# --- Save Updated REIT Scoring Analysis Back to MySQL ---
try:
    with engine.connect() as conn:
        final_data.to_sql("reit_scoring_analysis", con=conn, if_exists="replace", index=False)
        print("✅ REIT Scoring Analysis updated successfully with FFO_Payout_Score, FFO_Yield, and FFO_Yield_Z.")
except Exception as e:
    print(f"❌ Error saving updated REIT Scoring Analysis to MySQL: {e}")

