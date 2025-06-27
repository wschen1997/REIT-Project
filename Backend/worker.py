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
    This is the background task that does the heavy lifting.
    It's the same logic that used to be in the Flask route.
    """
    try:
        # 1. Fetch Z-Scores from Database
        with engine.connect() as conn:
            query = text("""
                SELECT `Z_Score_Std_Dev`, `Z_Score_Return`, `Z_Score_Skew`, `Z_Score_Kurtosis`, `Z_Score_Illiquidity`
                FROM reit_scoring_analysis WHERE Ticker = :ticker
            """)
            result = conn.execute(query, {"ticker": ticker}).fetchone()

        if not result:
            raise ValueError("No scoring data found for this ticker.")
            
        scores = {k: (v if v is not None else 0.0) for k, v in result._mapping.items()}

        # 2. Construct Prompt
        prompt = f"""
        Analyze the Stability Score components for the REIT with ticker {ticker}.
        The components are Z-scores, where a higher score means more of that factor.
        - Volatility (Standard Deviation Z-score): {scores['Z_Score_Std_Dev']:.2f} (Higher is riskier)
        - Illiquidity Z-score: {scores['Z_Score_Illiquidity']:.2f} (Higher is riskier)
        - Return Z-score: {scores['Z_Score_Return']:.2f} (Higher is better)
        - Negative Skew Z-score: {scores['Z_Score_Skew']:.2f} (Higher is riskier)
        - Tail Risk (Kurtosis Z-score): {scores['Z_Score_Kurtosis']:.2f} (Higher is riskier)

        Based on these Z-scores, write a brief, one-paragraph analysis (around 50-70 words) for a financial analyst. 
        Start by stating the primary driver of its risk profile.
        Mention at least one positive and one negative contributing factor.
        """

        # 3. Call Gemini API
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(api_url, headers=headers, json=payload, timeout=90) # Added a 90s timeout
        response.raise_for_status()
        
        api_response = response.json()
        if not api_response.get("candidates"):
            raise ValueError("AI response was blocked or empty.")
            
        explanation_text = api_response["candidates"][0]["content"]["parts"][0]["text"]

        # 4. Return the complete result object
        return {
            "ticker": ticker,
            "z_scores": scores,
            "explanation": explanation_text
        }
    except Exception as e:
        # If any step fails, the task will be marked as a FAILURE
        # and this exception will be stored as the result.
        return {"error": str(e)}