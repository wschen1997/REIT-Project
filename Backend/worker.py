# worker.py
import os
import requests
from celery import Celery
from sqlalchemy import create_engine, text

# --- Load Environment Variables ---
# We assume these are set in the execution environment (Render's Environment Group)
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
REDIS_URL = os.getenv("REDIS_URL")

# --- Initialize Celery ---
# The Celery app needs to know where the broker (Redis) and result backend (also Redis) are.
celery_app = Celery(
    "tasks",
    broker=f"{REDIS_URL}/0",
    backend=f"{REDIS_URL}/1"
)

# --- Database Engine ---
# Create a database engine for the worker to use.
engine = create_engine(
    f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={"ssl": {"fake_flag_to_enable": True}}
)

@celery_app.task(name="worker.generate_stability_analysis_task")
def generate_stability_analysis_task(ticker):
    """
    This background task now checks for inactive stocks before calling the AI.
    """
    try:
        # 1. Fetch all necessary data from the database
        with engine.connect() as conn:
            # --- MODIFIED SECTION: Updated SQL Query to include Average Volume ---
            query = text("""
                SELECT 
                    `Z_Score_Std_Dev`, `Z_Score_Return`, `Z_Score_Skew`, `Z_Score_Kurtosis`, `Z_Score_Illiquidity`,
                    `P_Rank_Volatility`, `P_Rank_Illiquidity`, `P_Rank_Return`, `P_Rank_Skew`, `P_Rank_Kurtosis`,
                    `Average Volume`
                FROM reit_scoring_analysis WHERE Ticker = :ticker
            """)
            # --- END MODIFIED SECTION ---
            result = conn.execute(query, {"ticker": ticker}).fetchone()

        if not result:
            raise ValueError("No scoring data found for this ticker.")
            
        data = result._asdict()

        # --- NEW: Check for inactive trading volume ---
        # If average volume is less than 1,000, we consider it inactive/delisted
        # and return a special status without calling the AI.
        if data.get('Average Volume', 0) < 1000:
            return {
                "status": "DELISTED",
                "message": "This security has negligible trading volume and may be delisted. It will be reviewed and removed from our database."
            }
        # --- END NEW CHECK ---

        # If the stock is active, proceed as normal...
        scores = {
            'Z_Score_Std_Dev': data['Z_Score_Std_Dev'],
            'Z_Score_Return': data['Z_Score_Return'],
            'Z_Score_Skew': data['Z_Score_Skew'],
            'Z_Score_Kurtosis': data['Z_Score_Kurtosis'],
            'Z_Score_Illiquidity': data['Z_Score_Illiquidity']
        }
        percentile_ranks = {
            'Volatility': data['P_Rank_Volatility'],
            'Illiquidity': data['P_Rank_Illiquidity'],
            'Return': data['P_Rank_Return'],
            'NegativeSkew': data['P_Rank_Skew'],
            'TailRisk': data['P_Rank_Kurtosis']
        }

        # 2. Construct Prompt (Unchanged)
        prompt = f"""
        You are a savvy financial advisor explaining a REIT's risk profile to a smart but non-technical client.
        Your tone should be clear, direct, and insightful. Avoid jargon.
        Your goal is to explain what these Z-scores mean for a potential investor in plain English.

        Here are the Z-scores for REIT ticker {ticker}, comparing it to its peers. A score near 0 is average.
        - Price Stability (Volatility): {scores['Z_Score_Std_Dev']:.2f} (A lower score means fewer price swings and is better)
        - Ease of Trading (Illiquidity): {scores['Z_Score_Illiquidity']:.2f} (A lower score means it's easier to trade and is better)
        - Historical Performance (Return): {scores['Z_Score_Return']:.2f} (A higher score is better)
        - Downside Protection (Negative Skew): {scores['Z_Score_Skew']:.2f} (A lower score means less risk of large, sudden drops and is better)
        - Extreme Event Risk (Kurtosis): {scores['Z_Score_Kurtosis']:.2f} (A lower score means less risk of rare, extreme price moves and is better)

        Based on these scores, please provide a 2-3 sentence summary analysis for an investor.
        DO NOT repeat the numerical Z-scores in your output.
        Focus on the practical implications. For example, instead of saying 'It has low volatility,' say 'Its stock price has been more stable than its peers.'
        For liquidity, only mention it if the score is significantly low. Focus more on volitility, skewness, and kurtosis.
        Don't be overly positive; just state the facts. Negative judgments are fine if warranted.
        Start by summarizing the main trade-off (the primary strength vs. the primary weakness).
        """

        # 3. Call Gemini API (Unchanged)
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(api_url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
        
        api_response = response.json()
        if not api_response.get("candidates"):
            raise ValueError("AI response was blocked or empty.")
            
        explanation_text = api_response["candidates"][0]["content"]["parts"][0]["text"]

        # 4. Return the complete result object
        return {
            "ticker": ticker,
            "z_scores": scores,
            "percentile_ranks": percentile_ranks,
            "explanation": explanation_text
        }
    except Exception as e:
        return {"error": str(e)}