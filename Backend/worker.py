# worker.py
import os
import requests
from celery import Celery
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# --- Load Environment Variables ---
# Try to load .env file from common locations
env_paths = [
    os.path.join(os.path.dirname(__file__), "..", ".env"),
    os.path.join(os.path.dirname(__file__), ".env"),
    os.path.expanduser("~/.env"),
]
for path in env_paths:
    if os.path.exists(path):
        load_dotenv(path)
        break

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
REDIS_URL = os.getenv("REDIS_URL")

# #region agent log
LOG_PATH = "/Users/liuyunchen/Development/REIT-Project/.cursor/debug.log"
import json
from datetime import datetime
def log_debug(session_id, run_id, hypothesis_id, location, message, data):
    entry = {
        "sessionId": session_id,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(datetime.now().timestamp() * 1000)
    }
    try:
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except:
        pass

log_debug("debug-session", "worker-init-1", "A", "worker.py:35", "Environment variables loaded", {
    "DB_USERNAME_set": DB_USERNAME is not None,
    "DB_PASSWORD_set": DB_PASSWORD is not None,
    "DB_HOST_set": DB_HOST is not None,
    "DB_PORT_value": DB_PORT,
    "DB_PORT_type": type(DB_PORT).__name__,
    "DB_NAME_set": DB_NAME is not None,
    "GEMINI_API_KEY_set": GEMINI_API_KEY is not None,
    "REDIS_URL_set": REDIS_URL is not None
})
# #endregion

# Validate DB_PORT - must be a valid integer or None
if DB_PORT is not None:
    try:
        DB_PORT = int(DB_PORT)
    except (ValueError, TypeError):
        # #region agent log
        log_debug("debug-session", "worker-init-1", "B", "worker.py:52", "DB_PORT validation failed", {
            "DB_PORT_raw": DB_PORT,
            "error": "Cannot convert to int"
        })
        # #endregion
        raise ValueError(f"DB_PORT must be a valid integer, got: {DB_PORT}")
else:
    # #region agent log
    log_debug("debug-session", "worker-init-1", "B", "worker.py:60", "DB_PORT is None", {})
    # #endregion
    raise ValueError("DB_PORT environment variable is not set")

# --- Initialize Celery ---
celery_app = Celery(
    "tasks",
    broker=f"{REDIS_URL}/0",
    backend=f"{REDIS_URL}/1"
)

# --- Database Engine ---
# #region agent log
log_debug("debug-session", "worker-init-1", "C", "worker.py:70", "Creating database engine", {
    "DB_HOST": DB_HOST,
    "DB_PORT": DB_PORT,
    "DB_NAME": DB_NAME,
    "DB_USERNAME_set": DB_USERNAME is not None,
    "connection_string_preview": f"mysql+pymysql://{DB_USERNAME}:***@{DB_HOST}:{DB_PORT}/{DB_NAME}"
})
# #endregion

try:
    engine = create_engine(
        f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
        connect_args={"ssl": {"fake_flag_to_enable": True}}
    )
    # #region agent log
    log_debug("debug-session", "worker-init-1", "C", "worker.py:80", "Database engine created successfully", {})
    # #endregion
except Exception as e:
    # #region agent log
    log_debug("debug-session", "worker-init-1", "C", "worker.py:83", "Database engine creation failed", {
        "error": str(e),
        "error_type": type(e).__name__
    })
    # #endregion
    raise

@celery_app.task(name="worker.generate_stability_analysis_task")
def generate_stability_analysis_task(ticker):
    """
    This background task now uses the improved liquidity tier and checks for inactive stocks.
    """
    try:
        # 1. Fetch all necessary data from the database
        with engine.connect() as conn:
            query = text("""
                SELECT * FROM reit_scoring_analysis WHERE Ticker = :ticker
            """)
            result = conn.execute(query, {"ticker": ticker}).fetchone()

        if not result:
            raise ValueError("No scoring data found for this ticker.")
            
        data = result._asdict()

        # Check for inactive trading volume
        if data.get('Average Volume', 0) < 1000:
            return {
                "status": "DELISTED",
                "message": "This security has negligible trading volume and may be delisted. It will be reviewed and removed from our database."
            }
        
        # Structure the data for the API call and the frontend
        scores = {k: v for k, v in data.items() if k.startswith('Z_Score_')}
        percentile_ranks = {
            'Volatility': data.get('P_Rank_Volatility'),
            'Return': data.get('P_Rank_Return'),
            'NegativeSkew': data.get('P_Rank_Skew'),
            'TailRisk': data.get('P_Rank_Kurtosis')
        }
        liquidity_tier = data.get('Liquidity_Tier', 'N/A')

        # 2. Construct Prompt (Now includes your custom instructions)
        prompt = f"""
        You are a savvy financial advisor explaining a REIT's risk profile to a smart but non-technical client.
        Your tone should be clear, direct, and insightful. Avoid jargon.
        Your goal is to explain what these scores mean for a potential investor in plain English.

        Here are the metrics for REIT ticker {ticker}, comparing it to its peers. A score near 0 is average.
        - Price Stability (Volatility): {scores['Z_Score_Std_Dev']:.2f} (A lower score means fewer price swings and is better)
        - Ease of Trading (Liquidity): This REIT has a '{liquidity_tier}' liquidity rating.
        - Historical Performance (Return): {scores['Z_Score_Return']:.2f} (A higher score is better)
        - Downside Protection (Negative Skew): {scores['Z_Score_Skew']:.2f} (A lower score means less risk of large, sudden drops and is better)
        - Extreme Event Risk (Kurtosis): {scores['Z_Score_Kurtosis']:.2f} (A lower score means less risk of rare, extreme price moves and is better)

        Based on these scores, please provide a 2-3 sentence summary analysis for an investor.
        DO NOT repeat the numerical Z-scores in your output.
        Focus on the practical implications. For example, instead of saying 'It has low volatility,' say 'Its stock price has been more stable than its peers.'
        Start by summarizing the main trade-off (the primary strength vs. the primary weakness).
        For liquidity, only mention it if the score is significantly low. Focus more on volitility, skewness, and kurtosis.
        Don't be overly positive; just state the facts. Negative judgments are fine if warranted.
        """

        # 3. Call Gemini API
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(api_url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
        
        api_response = response.json()
        if not api_response.get("candidates"):
            raise ValueError("AI response was blocked or empty.")
            
        explanation_text = api_response["candidates"][0]["content"]["parts"][0]["text"]

        # 4. Return the complete result object for the frontend
        return {
            "ticker": ticker,
            "percentile_ranks": percentile_ranks,
            "liquidity_tier": liquidity_tier,
            "explanation": explanation_text
        }
    except Exception as e:
        return {"error": str(e)}