import os
from dotenv import load_dotenv

# Try to load .env file from common locations
env_paths = [
    os.path.join(os.path.dirname(__file__), "..", ".env"),
    os.path.join(os.path.dirname(__file__), ".env"),
    os.path.expanduser("~/.env"),
    # Keep the original path as a fallback (though it won't exist on Mac)
    os.path.abspath("C:/Users/wsche/OneDrive/桌面/Investment Research/Startup Project/Python Run/Credentials.env"),
]
for path in env_paths:
    if os.path.exists(path):
        load_dotenv(path)
        break

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
from sqlalchemy import text
from flask_cors import CORS
from datetime import datetime
import stripe
import bcrypt
import jwt
from datetime import timedelta
import json
import requests
import traceback
import time
from itertools import product
from worker import generate_stability_analysis_task
from celery.result import AsyncResult
from google.cloud import firestore
import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore
import logging
import numpy as np
from flask_limiter import Limiter

app = Flask(__name__)
app.logger.setLevel(logging.INFO)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "https://www.viserra-group.com"]}})

# --- RATE LIMITING ---
def get_user_ip():
    # Get the user's real IP address, even when behind Render's proxy
    if request.headers.getlist("X-Forwarded-For"):
       return request.headers.getlist("X-Forwarded-For")[0]
    else:
       return request.remote_addr

limiter = Limiter(
    key_func=get_user_ip,
    app=app,
    default_limits=["200 per day", "50 per hour"] # General limits for all routes
)

# get the stripe secret key from the environment variables
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Load secret key for JWT auth (Log in and Sign up)
app.config['SECRET_KEY'] = os.getenv("APP_SECRET_KEY")

# Database credentials from environment variables
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# Validate DB_PORT - must be a valid integer
if DB_PORT is not None:
    try:
        DB_PORT = int(DB_PORT)
    except (ValueError, TypeError):
        raise ValueError(f"DB_PORT must be a valid integer, got: {DB_PORT}")
else:
    raise ValueError("DB_PORT environment variable is not set")

# Construct the database connection string
DB_URL = f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Apply the same SSL forced connection logic
app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "connect_args": {
        "ssl": {
            "fake_flag_to_enable": True  # Ensures SSL connection
        }
    }
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy with the updated configuration
db = SQLAlchemy(app)

# -------------------------------------------------------------------------
# =========================== REIT ENDPOINTS ==============================
# -------------------------------------------------------------------------
@app.route('/')
def index():
    return "REIT Screener API is running!"

# -------------------------------------------------------------------------
# =========================== REIT ENDPOINTS ==============================
# -------------------------------------------------------------------------
@app.route('/api/reits', methods=['GET'])
def get_reits():
    """
    Filters REITs based on user-selected preferences:
    - Country (from 'Country_Region' in reit_business_data)
    - Property Type (from 'Property_Type' in reit_business_data; supports multiple categories)
    - Ticker (if ticker=?)
    - min_avg_return (for Average Annual Return)
    - search (partial ticker match for real-time suggestions)

    Merges with scoring analysis data from reit_scoring_analysis.
    Returns relevant business data plus new fields (Numbers_Employee, Year_Founded, etc.).
    """

    # Get user selections from request parameters
    selected_country = request.args.get('country', default=None, type=str)
    selected_property_type = request.args.get('property_type', default=None, type=str)
    selected_ticker = request.args.get('ticker', default=None, type=str)
    min_avg_return = request.args.get('min_avg_return', default=None, type=float)

    # NEW: Real-time search parameter
    search_term = request.args.get('search', default=None, type=str)
    app.logger.info("Search term received: %s", search_term)
    
    # Load REIT business data from MySQL
    try:
        with db.engine.connect() as conn:
            query = "SELECT * FROM reit_business_data"
            business_data = pd.read_sql(query, conn)
            app.logger.info(f"Total REITs loaded from business data: {business_data.shape[0]}")
    except Exception as e:
        app.logger.error(f"Error loading REIT business data: {e}")
        return jsonify({"error": "Failed to load REIT business data"}), 500

    # Apply filters if present
    if selected_country:
        business_data = business_data[business_data['Country_Region'] == selected_country]
    if selected_property_type:
        business_data = business_data[
            business_data['Property_Type'].str.contains(selected_property_type, case=False, na=False)
        ]
    if selected_ticker:
        business_data = business_data[business_data['Ticker'] == selected_ticker]

    # NEW: If a search term is provided, filter by Ticker startswith (case-insensitive)
    if search_term:
        if 'Ticker' in business_data.columns:
            app.logger.info("Ticker column sample: %s", business_data['Ticker'].head().to_dict())
        else:
            app.logger.error("Ticker column missing in business_data")
        try:
            business_data = business_data[
                business_data['Ticker'].notna() &
                business_data['Ticker'].astype(str).str.lower().str.startswith(search_term.lower(), na=False)
            ]
            app.logger.info("After search filter, business_data shape: %s", business_data.shape)
        except Exception as e:
            app.logger.error("Error filtering by search term: %s", e)
            return jsonify({"error": "Error filtering by search term"}), 500

    app.logger.info(
        f"Filtered REITs after country/property/ticker/search selection: {business_data.shape[0]}"
    )

    if business_data.empty:
        return jsonify({"explanation": "No REITs match the selected criteria.", "reits": []})

    # Load scoring analysis data from MySQL
    try:
        with db.engine.connect() as conn:
            risk_query = "SELECT * FROM reit_scoring_analysis"
            risk_data = pd.read_sql(risk_query, conn)
            app.logger.info(f"Total REITs loaded from scoring analysis: {risk_data.shape[0]}")
    except Exception as e:
        app.logger.error(f"Error loading scoring analysis data: {e}")
        return jsonify({"error": "Failed to load scoring analysis data"}), 500

    # Merge business data with scoring analysis data using the 'Ticker' column
    merged_data = pd.merge(business_data, risk_data, on="Ticker", how="inner")
    app.logger.info(
        f"Total REITs after merging business and scoring analysis data: {merged_data.shape[0]}"
    )

    # Apply Average Annual Return filter
    if min_avg_return is not None:
        merged_data = merged_data[merged_data['Average Annual Return'] > min_avg_return]
        app.logger.info(
            f"Filtered REITs with Average Annual Return greater than {min_avg_return}: {merged_data.shape[0]}"
        )

    # Replace NaN values with None for better JSON serialization
    merged_data = merged_data.astype(object).where(pd.notna(merged_data), None)

    # We won't sort; display in original order
    data_to_display = merged_data

    explanation = (
        f"Filtered REITs: Minimum Annual Annual Return - {min_avg_return}, "
        f"Filtered REITs: Country - {selected_country}, "
        f"Property Type - {selected_property_type}, "
        f"Ticker - {selected_ticker}."
    )

    response = {
        "explanation": explanation,
        "reits": data_to_display[
            [
                "Ticker",
                "Company_Name",
                "Business_Description",
                "Website",
                "Numbers_Employee",
                "Target_Price",
                "Year_Founded",
                "US_Investment_Regions",
                "Overseas_Investment",
                "Property_Type",
                "Total_Real_Estate_Assets_M_",
                "5yr_FFO_Growth",
            ]
        ].to_dict(orient='records')
    }

    return jsonify(response)

# -------------------------------------------------------------------------
# QUARTERLY STATEMENTS ENDPOINT (Income Statement, Balance Sheet, Cash Flow)
# -------------------------------------------------------------------------
@app.route("/api/reits/<string:ticker>/statements/quarterly", methods=['GET'])
def get_quarterly_statements(ticker):
    """
    Fetches quarterly financial statements for a given ticker from one of:
      reit_income_statement (Income Statement)
      reit_balance_sheet   (Balance Sheet)
      reit_cash_flow       (Cash Flow)
      reit_industry_metrics (Industry Specific)

    Usage example:
      GET /api/reits/WPC/statements/quarterly?type=is
        => returns Income Statement rows for WPC

      Optional query params:
        limit      -> # of rows to limit (e.g. ?limit=100)
        from_year  -> min year to filter
        to_year    -> max year to filter
    """
    statement_type = request.args.get("type", "is").lower()
    limit = request.args.get("limit", default=None, type=int)
    from_year = request.args.get("from_year", default=None, type=int)
    to_year = request.args.get("to_year", default=None, type=int)

    # Map type -> table name
    table_map = {
        "is": "reit_income_statement",
        "bs": "reit_balance_sheet",
        "cf": "reit_cash_flow",
        "industry": "reit_industry_metrics",
    }

    table_name = table_map.get(statement_type)
    if not table_name:
        return jsonify({"error": "Invalid 'type' parameter. Must be one of is|bs|cf|industry."}), 400

    # Build the base SELECT and WHERE
    sql = f"""
        SELECT
            line_item,
            fiscal_year,
            fiscal_quarter,
            value,
            excel_row_index
        FROM {table_name}
        WHERE ticker = :ticker
    """
    params = {"ticker": ticker}

    # Dynamically add any filters
    if from_year is not None:
        sql += " AND fiscal_year >= :from_year"
        params["from_year"] = from_year

    if to_year is not None:
        sql += " AND fiscal_year <= :to_year"
        params["to_year"] = to_year

    # Add ORDER BY last (after WHERE conditions)
    sql += " ORDER BY excel_row_index ASC, fiscal_year ASC, fiscal_quarter ASC"

    # Optionally limit the number of rows
    if limit is not None:
        sql += " LIMIT :limit"
        params["limit"] = limit

    try:
        with db.engine.connect() as conn:
            df = pd.read_sql(text(sql), conn, params=params)
    except Exception as e:
        app.logger.error(f"Error fetching quarterly statements for {ticker}: {e}")
        return jsonify({"error": "Failed to load statements"}), 500

    if df.empty:
        return jsonify({"message": f"No {statement_type.upper()} data found for ticker '{ticker}'"}), 200

    # Convert the 'fiscal_quarter' column to None where blank
    df["fiscal_quarter"] = df["fiscal_quarter"].astype(object).where(pd.notna(df["fiscal_quarter"]), None)

    records = df.to_dict(orient="records")

    return jsonify({
        "ticker": ticker,
        "statement_type": statement_type,
        "rows": records
    })

# -------------------------------------------------------------------------
# PORTFOLIO ANALYSIS ENDPOINT 
# -------------------------------------------------------------------------
@app.route("/api/reits/<string:ticker>/breakdowns", methods=['GET'])
def get_portfolio_breakdowns(ticker):
    """
    Returns portfolio breakdowns by property_type, secondary_type, US state, and country.
    Each entry has: category, rba_gla, pct (fraction of total), data source, and calc basis.
    """
    try:
        with db.engine.connect() as conn:
            df = pd.read_sql(text("""
                SELECT breakdown_type
                     , category
                     , rba_gla
                     , pct
                     , source
                     , basis
                  FROM reit_portfolio_analysis
                 WHERE ticker = :ticker
                 ORDER BY 
                   FIELD(breakdown_type,
                         'property_type',
                         'secondary_type',
                         'state',
                         'country'),
                   pct DESC
            """), conn, params={"ticker": ticker})
    except Exception as e:
        app.logger.error(f"Error loading portfolio breakdowns for {ticker}: {e}")
        return jsonify({"error": "Failed to load breakdowns"}), 500

    if df.empty:
        return jsonify({"message": f"No breakdowns found for ticker '{ticker}'"}), 200

    # pivot into four lists, now including source & basis
    result = {}
    for btype in ["property_type", "secondary_type", "state", "country"]:
        sub = df[df["breakdown_type"] == btype][
            ["category", "rba_gla", "pct", "source", "basis"]
        ]
        result[btype] = sub.to_dict(orient="records")

    return jsonify({"ticker": ticker, "breakdowns": result}), 200

# -------------------------------------------------------------------------
# OVERVIEW FINANCIAL DATA ENDPOINT
# -------------------------------------------------------------------------
def convert_date_to_quarter(date_obj):
    """
    Convert a datetime (e.g., 2024-03-31) to a string like Q1 '24.
    """
    if pd.isna(date_obj) or not isinstance(date_obj, (datetime, pd.Timestamp)):
        return None
    quarter = (date_obj.month - 1) // 3 + 1
    year_short = str(date_obj.year)[-2:]
    return f"Q{quarter} '{year_short}"


def build_col_name(ticker_prefix, metric):
    """
    Build a column name like "GIPR_US_Equity_FFO_PS".
    """
    return f"{ticker_prefix}_{metric}"


@app.route("/api/reits/<ticker>/financials", methods=['GET'])
def get_financials(ticker):
    """
    Returns up to 6 most recent quarterly data points for FFO_PS, DVD, and NOI_PS.
    Optionally (if include_scores=true is passed), also returns
    stability_percentile and fundamental_percentile.
    """
    include_scores = request.args.get('include_scores', 'false').lower() == 'true'

    # 1) Define the financial line items we want to fetch
    line_items_to_fetch = [
        'Dividends per Share',  # From Income Statement
        'FFO',                  # From Industry Metrics
        'FFO / Total Revenue %' # From Industry Metrics
    ]

    # 2) Build and execute the SQL query to fetch the data in long format
    # We use UNION ALL to combine results from two different tables efficiently.
    sql_query = text("""
        SELECT fiscal_year, fiscal_quarter, line_item, value
        FROM reit_income_statement
        WHERE ticker = :ticker AND line_item = 'Dividends per Share' AND fiscal_quarter IS NOT NULL
        UNION ALL
        SELECT fiscal_year, fiscal_quarter, line_item, value
        FROM reit_industry_metrics
        WHERE ticker = :ticker AND line_item IN ('FFO', 'FFO / Total Revenue %') AND fiscal_quarter IS NOT NULL
        ORDER BY fiscal_year, fiscal_quarter
    """)

    try:
        with db.engine.connect() as conn:
            df = pd.read_sql(sql_query, conn, params={"ticker": ticker})

        if df.empty:
            # If no data, prepare an empty response but still fetch scores later
            results = []
        else:
            # 3) Pivot the data from long to wide format
            # This makes it easier to create the JSON object for each time period.
            pivoted_df = df.pivot_table(
                index=['fiscal_year', 'fiscal_quarter'],
                columns='line_item',
                values='value'
            ).reset_index()

            # 4) Take the last 26 quarters for the overview chart
            pivoted_df = pivoted_df.tail(26)

            # Sanitize column names for JSON compatibility (replace spaces and %)
            pivoted_df.rename(columns={
                'Dividends per Share': 'dividends_per_share',
                'FFO': 'ffo',
                'FFO / Total Revenue %': 'ffo_per_revenue_pct'
            }, inplace=True)

            # 5) Format the data into the JSON structure the frontend expects
            results = []
            for _, row in pivoted_df.iterrows():
                # Re-create the "Q1 '23" style quarter label
                year_short = str(int(row['fiscal_year']))[-2:]
                quarter_label = f"Q{int(row['fiscal_quarter'])} '{year_short}"

                row_obj = {
                    "quarter": quarter_label,
                }
                
                # Add each metric if it exists in the row, otherwise add None
                row_obj["dividends_per_share"] = float(row['dividends_per_share']) if pd.notna(row.get('dividends_per_share')) else None
                row_obj["ffo"] = float(row['ffo']) if pd.notna(row.get('ffo')) else None
                row_obj["ffo_per_revenue_pct"] = float(row['ffo_per_revenue_pct']) if pd.notna(row.get('ffo_per_revenue_pct')) else None
                
                results.append(row_obj)
                
    except Exception as e:
        app.logger.error(f"Error fetching real-time financial data for {ticker}: {e}")
        return jsonify({"error": "Failed to load financial overview data"}), 500

    if include_scores:
        # Look up scoring analysis
        try:
            with db.engine.connect() as conn:
                scoring_query = f"SELECT * FROM reit_scoring_analysis WHERE Ticker = '{ticker}'"
                scoring_data = pd.read_sql(scoring_query, conn)
        except Exception as e:
            app.logger.error(f"Error loading scoring analysis for ticker {ticker}: {e}")
            scoring_data = pd.DataFrame()

        if not scoring_data.empty:
            scoring_row = scoring_data.iloc[0]
            stability_score = scoring_row.get("Stability Percentile", None)
            fundamental_score = scoring_row.get("Fundamental_Percentile", None)
        else:
            stability_score = None
            fundamental_score = None

        response = {
            "quarterly_data": results,
            "stability_percentile": stability_score,
            "fundamental_percentile": fundamental_score
        }
        return jsonify(response), 200
    else:
        # Return only the array of quarterly data for backward compatibility
        return jsonify(results), 200


class EmailSignup(db.Model):
    __tablename__ = "email_signups"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    interest = db.Column(db.Enum("REITs", "Crowdfunding", "Both"), nullable=False)
    feedback = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    def __init__(self, email, interest, feedback=None):
        self.email = email
        self.interest = interest
        self.feedback = feedback


@app.route("/api/signup", methods=["POST"])
def signup():
    """Handles new email signups and stores them in the MySQL database."""
    data = request.json
    email = data.get("email")
    interest = data.get("interest")
    feedback = data.get("feedback", None)  # Optional field

    if not email or not interest:
        return jsonify({"error": "Missing required fields"}), 400

    # Check if email already exists
    existing_entry = db.session.execute(
        db.select(EmailSignup).filter_by(email=email)
    ).scalar_one_or_none()

    if existing_entry:
        return jsonify({"error": "Email already exists in database"}), 409

    try:
        # Insert new record using SQLAlchemy ORM
        new_signup = EmailSignup(email=email, interest=interest, feedback=feedback)
        db.session.add(new_signup)
        db.session.commit()

        return jsonify({"message": "Signup successful!"}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

class ContactMessage(db.Model):
    __tablename__ = "contact_messages"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    def __init__(self, first_name, last_name, email, message):
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.message = message

@app.route("/api/contact", methods=["POST"])
def contact():
    """
    Handles new contact form submissions and stores them in the contact_messages table.
    """
    data = request.json
    first_name = data.get("firstName")
    last_name = data.get("lastName")
    email = data.get("email")
    message = data.get("message")

    # Basic validation
    if not all([first_name, last_name, email, message]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        new_contact = ContactMessage(
            first_name=first_name,
            last_name=last_name,
            email=email,
            message=message
        )
        db.session.add(new_contact)
        db.session.commit()

        return jsonify({"message": "Contact message received!"}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/api/reits/<string:ticker>/price", methods=['GET'])
def get_price_data(ticker):
    """
    Returns all historical close_price and volume for the specified ticker.
    """
    try:
        with db.engine.connect() as conn:
            sql_query = f"""
                SELECT date, close_price, volume
                FROM reit_price_data
                WHERE ticker = '{ticker}'
                ORDER BY date ASC
            """
            df_price = pd.read_sql(sql_query, conn)

        if df_price.empty:
            return jsonify({"message": f"No price data found for ticker '{ticker}'"}), 200

        # Convert to JSON-safe types
        df_price["date"] = df_price["date"].astype(str)
        df_price["close_price"] = df_price["close_price"].astype(float)
        df_price["volume"] = df_price["volume"].astype(float)

        price_records = df_price.to_dict(orient='records')
        return jsonify({
            "ticker": ticker,
            "price_data": price_records
        }), 200

    except Exception as e:
        app.logger.error(f"Error fetching price data for {ticker}: {e}")
        return jsonify({"error": "Failed to load price data"}), 500


# -------------------------------------------------------------------------
# ====================== SCORING AND LLM ENDPOINTS ===============================
# -------------------------------------------------------------------------

# endpoint to START the analysis job
@app.route("/api/reits/<string:ticker>/start-analysis", methods=['POST'])
def start_stability_analysis(ticker):
    """
    Starts the stability analysis task in the background.
    Immediately returns a task ID.
    """
    task = generate_stability_analysis_task.delay(ticker)
    return jsonify({"task_id": task.id}), 202

# endpoint to CHECK THE STATUS and GET THE RESULT of the analysis job
@app.route("/api/reits/analysis-result/<string:task_id>", methods=['GET'])
def get_analysis_result(task_id):
    """
    Checks the status of a background task.
    Returns the result if the task is complete.
    """
    task_result = AsyncResult(task_id, app=generate_stability_analysis_task.app)

    if task_result.successful():
        result = task_result.get()
        
        # NEW: Check for our custom "DELISTED" status from the worker
        if result.get("status") == "DELISTED":
            return jsonify(result), 200
        
        # Existing check for other internal errors
        if result.get("error"):
            return jsonify({"status": "FAILURE", "error": result["error"]}), 200
        
        # If no errors, it's a success
        return jsonify({
            "status": "SUCCESS",
            "result": result
        }), 200
        
    elif task_result.failed():
        return jsonify({
            "status": "FAILURE",
            "error": str(task_result.info) # Get the exception info
        }), 200
        
    else:
        # Task is still pending or in another state
        return jsonify({"status": "PENDING"}), 202

# -------------------------------------------------------------------------
# ====================== Stripe ENDPOINTS ===============================
# -------------------------------------------------------------------------

@app.route('/api/create-checkout-session', methods=['POST'])
def create_checkout_session():
    # Determine the domain dynamically based on the environment
    if os.environ.get('FLASK_ENV') == 'production':
        YOUR_DOMAIN = 'https://www.viserra-group.com'
    else:
        YOUR_DOMAIN = 'http://localhost:3000'

    data = request.json or {}
    user_email = data.get("email")

    if not user_email:
        return jsonify({'error': 'User email is required to create a session.'}), 400

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode='subscription',
            line_items=[{
                'price': 'price_1R5WryL1vfYfs767GYSqHKn0',  # Your Premium Plan Price ID
                'quantity': 1,
            }],
            client_reference_id=user_email,
            # Use an f-string to build the URL with the correct domain
            success_url=f"{YOUR_DOMAIN}/pricing?status=success",
            cancel_url=f"{YOUR_DOMAIN}/pricing?status=cancel"
        )
        return jsonify({'url': session.url})
    except Exception as e:
        print("Stripe Error:", str(e))
        return jsonify({'error': str(e)}), 500


@app.route('/api/stripe-webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        return 'Invalid payload', 400
    except stripe.error.SignatureVerificationError as e:
        return 'Invalid signature', 400

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_email = session.get('client_reference_id')

        if not user_email:
            print("🔥 Webhook error: No client_reference_id in session.")
            return "Webhook Error: Missing user identifier", 400

        try:
            if not firebase_admin._apps:
                raw_cred = os.getenv("FIREBASE_SERVICE_ACCOUNT")
                cred_json = json.loads(raw_cred)
                cred = credentials.Certificate(cred_json)
                firebase_admin.initialize_app(cred)
            
            db_fs = admin_firestore.client()
            users_ref = db_fs.collection("users")
            query = users_ref.where("email", "==", user_email).limit(1)
            docs = query.stream()
            user_doc = next(docs, None)

            if user_doc:
                user_doc.reference.update({"plan": "premium"})
                print(f"✅ Successfully upgraded user {user_email} to premium.")
            else:
                print(f"🔥 Webhook error: User not found with email {user_email}.")
        except Exception as e:
            print(f"🔥 Firebase update error in webhook: {e}")
            return "Server error during user update", 500

    return 'Success', 200


# -------------------------------------------------------------------------
# =========================== ADVANCED FILTER ENDPOINT ==============================
# -------------------------------------------------------------------------

# THIS IS THE NEW CONFIGURATION OBJECT - THE "CONTROL PANEL" FOR ALL METRICS
METRIC_CONFIG = [
    {
        'metric_name': 'operating_margin',
        'calculation_type': 'ttm_margin',
        'line_items': ['Operating Income', 'Total Revenue'], # Numerator, Denominator
        'filter_prefix': 'operating_margin',
        'is_percentage': True 
    },
    {
        'metric_name': 'avg_revenue_yoy_growth',
        'calculation_type': 'avg_yoy_growth',
        'line_items': ['Total Revenue'],
        'filter_prefix': 'revenue_growth',
        'is_percentage': True 
    },
    {
        'metric_name': 'avg_ffo_yoy_growth',
        'calculation_type': 'avg_yoy_growth',
        'line_items': ['FFO'],
        'filter_prefix': 'ffo_growth',
        'is_percentage': True 
    },
    {
        'metric_name': 'interest_coverage_ratio',
        'calculation_type': 'ttm_ratio',
        'line_items': ['EBIT', 'Interest Expense, Total'], # Numerator, Denominator
        'filter_prefix': 'interest_coverage' ,
        'is_percentage': False
    },
    {
        'metric_name': 'debt_to_asset_ratio',
        'calculation_type': 'latest_ratio', # Using our new type for Balance Sheet items
        'line_items': ['Total Debt', 'Total Assets'], # Numerator, Denominator
        'filter_prefix': 'debt_to_asset',
        'is_percentage': False
    },
    {
        'metric_name': 'ffo_payout_ratio',
        'calculation_type': 'latest_value',
        'line_items': ['FFO Payout Ratio'],
        'filter_prefix': 'ffo_payout_ratio',
        'is_percentage': True
    },
    {
        'metric_name': 'pe_ratio',
        'calculation_type': 'price_to_ttm_value', # A new type for P/E and P/FFO
        'line_items': ['Basic EPS'],
        'filter_prefix': 'pe_ratio',
        'is_percentage': False
    },
    {
        'metric_name': 'pffo_ratio',
        'calculation_type': 'price_to_ttm_value',
        'line_items': ['FFO per Share (Basic)'],
        'filter_prefix': 'pffo_ratio',
        'is_percentage': False
    },
    {
        'metric_name': 'ffo_to_revenue_ratio',
        'calculation_type': 'latest_value',         # Reusing this simple type
        'line_items': ['FFO / Total Revenue %'],
        'filter_prefix': 'ffo_to_revenue',
        'is_percentage': True
    },
    {
        'metric_name': 'net_debt_to_ebitda',
        'calculation_type': 'latest_to_ttm_ratio',  # Our new hybrid type
        'line_items': ['Net Debt', 'EBITDA'],       # Numerator, Denominator
        'filter_prefix': 'net_debt_to_ebitda',
        'is_percentage': False
    },
]

# HELPER FUNCTION - NAN Handling
def strict_avg_growth(s):
    """
    Calculates the mean of the last 4 data points in a series,
    but ONLY if all 4 points are valid (not NaN). Otherwise, returns NaN.
    This exactly replicates the original strict logic.
    """
    # Get the last 4 values from the growth series for a given ticker
    last_4 = s.tail(4)
    
    # The crucial check: are all 4 values present and valid?
    if len(last_4) == 4 and last_4.notna().all():
        # If yes, calculate and return the mean
        app.logger.info(f"Ticker: {s.name:<8} | Using 4 valid growth rates for avg: {[f'{x:.2%}' for x in last_4]}")
        return last_4.mean()
    else:
        # If no, log the invalid data and return NaN
        app.logger.info(f"Ticker: {s.name:<8} | Skipping avg because of incomplete data: {[f'{x:.2%}' if pd.notna(x) else 'NaN' for x in last_4]}")
        return np.nan

# The METRIC_CONFIG list stays the same as before
@app.route('/api/reits/advanced-filter', methods=['GET'])
def get_advanced_filtered_reits():
    """
    DEFINITIVE ENDPOINT V5.1 (VECTORIZED + PROFILING): Adds performance
    logging to pinpoint bottlenecks.
    """
    # --- PROFILING SETUP ---
    start_time = time.time()
    last_step_time = start_time
    
    app.logger.info(f"Request received for VECTORIZED filter with args: {request.args}")
    args = request.args

    try:
        with db.engine.connect() as conn:
            # --- Step 1: Fetch candidate tickers and latest prices ---
            sql_tickers = "SELECT Ticker, Company_Name, Business_Description, Website FROM reit_business_data"
            candidate_df = pd.read_sql(text(sql_tickers), conn)
            
            if candidate_df.empty:
                return jsonify({"reits": []})
            candidate_tickers = tuple(candidate_df['Ticker'].tolist())

            sql_prices = text("""
                WITH LatestPrices AS (
                    SELECT ticker, close_price, ROW_NUMBER() OVER(PARTITION BY ticker ORDER BY date DESC) as rn
                    FROM reit_price_data WHERE ticker IN :tickers
                )
                SELECT ticker, close_price FROM LatestPrices WHERE rn = 1
            """)
            price_df = pd.read_sql(sql_prices, conn, params={"tickers": candidate_tickers})
            latest_prices = price_df.set_index('ticker')['close_price']
            
            # --- PROFILING LOG 1 ---
            current_time = time.time()
            app.logger.info(f"[PERF_LOG] Step 1: Fetched {len(candidate_tickers)} candidate tickers and prices took {current_time - last_step_time:.4f} seconds.")
            last_step_time = current_time

            # --- Step 2: Fetch all necessary financial data (The "Mega-Query") ---
            line_items_to_fetch = tuple({item for metric in METRIC_CONFIG for item in metric['line_items']})
            
            sql_financials = text("""
                (SELECT ticker, TRIM(line_item) as line_item, fiscal_year, fiscal_quarter, value FROM reit_income_statement WHERE TRIM(line_item) IN :line_items AND ticker IN :tickers AND fiscal_quarter IS NOT NULL)
                UNION ALL
                (SELECT ticker, TRIM(line_item) as line_item, fiscal_year, fiscal_quarter, value FROM reit_industry_metrics WHERE TRIM(line_item) IN :line_items AND ticker IN :tickers AND fiscal_quarter IS NOT NULL)
                UNION ALL
                (SELECT ticker, TRIM(line_item) as line_item, fiscal_year, fiscal_quarter, value FROM reit_balance_sheet WHERE TRIM(line_item) IN :line_items AND ticker IN :tickers AND fiscal_quarter IS NOT NULL)
                UNION ALL
                (SELECT ticker, TRIM(line_item) as line_item, fiscal_year, fiscal_quarter, value FROM reit_cash_flow WHERE TRIM(line_item) IN :line_items AND ticker IN :tickers AND fiscal_quarter IS NOT NULL)
            """)
            financials_df = pd.read_sql(sql_financials, conn, params={"line_items": line_items_to_fetch, "tickers": candidate_tickers})
            financials_df['value'] = financials_df['value'].replace(0, np.nan)

            if financials_df.empty:
                return jsonify({"reits": []})
            
            # --- PROFILING LOG 2 ---
            current_time = time.time()
            app.logger.info(f"[PERF_LOG] Step 2: Fetched {len(financials_df)} financial data rows (Mega-Query) took {current_time - last_step_time:.4f} seconds.")
            last_step_time = current_time

            # --- Step 3: Pivot the DataFrame ---
            financials_df['period'] = pd.PeriodIndex.from_fields(year=financials_df['fiscal_year'], quarter=financials_df['fiscal_quarter'], freq='Q')
            pivoted_df = financials_df.pivot_table(index=['ticker', 'period'], columns='line_item', values='value').sort_index()

            # --- PROFILING LOG 3 ---
            current_time = time.time()
            app.logger.info(f"[PERF_LOG] Step 3: Pivoted financial data took {current_time - last_step_time:.4f} seconds.")
            last_step_time = current_time

            # --- Step 4: Calculate all metrics ---
            metrics_df = pd.DataFrame(index=pivoted_df.index.get_level_values('ticker').unique())
            for conf in METRIC_CONFIG:
                # (The calculation logic remains the same)
                metric_name = conf['metric_name']
                calc_type = conf['calculation_type']
                line_items = conf['line_items']
                try:
                    if calc_type in ['ttm_margin', 'ttm_ratio']:
                        num_series = pivoted_df[line_items[0]]
                        den_series = pivoted_df[line_items[1]]
                        ttm_num = num_series.groupby('ticker').rolling(window=4, min_periods=4).sum().droplevel(0)
                        ttm_den = den_series.groupby('ticker').rolling(window=4, min_periods=4).sum().droplevel(0)
                        if metric_name == 'interest_coverage_ratio': ttm_den = abs(ttm_den)
                        metric_series = (ttm_num / ttm_den)
                        metrics_df[metric_name] = metric_series.groupby('ticker').last()
                    elif calc_type == 'avg_yoy_growth':
                        series = pivoted_df[line_items[0]]
                        # Step A: Calculate YoY growth correctly.
                        yoy_growth = series.groupby('ticker').pct_change(periods=4, fill_method=None)                       
                        # Step B: Apply our strict averaging function to each ticker's growth series.
                        avg_growth = yoy_growth.groupby('ticker').apply(strict_avg_growth)                     
                        metrics_df[metric_name] = avg_growth
                    elif calc_type == 'latest_ratio':
                        latest_num = pivoted_df[line_items[0]].groupby('ticker').last()
                        latest_den = pivoted_df[line_items[1]].groupby('ticker').last()
                        metrics_df[metric_name] = latest_num / latest_den
                    elif calc_type == 'latest_value':
                        metrics_df[metric_name] = pivoted_df[line_items[0]].groupby('ticker').last()
                    elif calc_type == 'price_to_ttm_value':
                        den_series = pivoted_df[line_items[0]]
                        ttm_den = den_series.groupby('ticker').rolling(window=4, min_periods=4).sum().droplevel(0).groupby('ticker').last()
                        ttm_den = ttm_den[ttm_den > 0] 
                        metrics_df[metric_name] = latest_prices.div(ttm_den).reindex(metrics_df.index)
                    elif calc_type == 'latest_to_ttm_ratio':
                        latest_num = pivoted_df[line_items[0]].groupby('ticker').last()
                        ttm_den = pivoted_df[line_items[1]].groupby('ticker').rolling(window=4, min_periods=4).sum().droplevel(0).groupby('ticker').last()
                        metrics_df[metric_name] = latest_num / ttm_den
                except KeyError as e:
                    metrics_df[metric_name] = np.nan

            # --- PROFILING LOG 4 ---
            current_time = time.time()
            app.logger.info(f"[PERF_LOG] Step 4: Vectorized metric calculations took {current_time - last_step_time:.4f} seconds.")
            last_step_time = current_time
            
            # --- Step 5: Merge, Filter, and Return ---
            metrics_df = metrics_df.reset_index().rename(columns={'ticker': 'Ticker'})
            final_df = pd.merge(candidate_df, metrics_df, on='Ticker', how='left')
            
            # NAN Handling and Filtering - For MVP, we drop any company missing ANY metric
            metric_columns = [conf['metric_name'] for conf in METRIC_CONFIG]
            app.logger.info(f"Checking data quality for {len(final_df)} companies before NaN filter...")
            final_df.dropna(subset=metric_columns, inplace=True)
            app.logger.info(f"{len(final_df)} companies survived the global data quality filter.")
            
            final_df = final_df.astype(object).where(pd.notna(final_df), None)
            filtered_df = final_df.copy()

            for metric_conf in METRIC_CONFIG:
                prefix = metric_conf['filter_prefix']
                metric_col = metric_conf['metric_name']
                min_val = args.get(f'min_{prefix}', type=float)
                max_val = args.get(f'max_{prefix}', type=float)
                if min_val is not None:
                    filtered_df = filtered_df[filtered_df[metric_col].notna() & (filtered_df[metric_col] >= min_val)]
                if max_val is not None:
                    filtered_df = filtered_df[filtered_df[metric_col].notna() & (filtered_df[metric_col] <= max_val)]

            # verification log
            app.logger.info("--- VERIFICATION LOG (FINAL) ---")
            if filtered_df.empty:
                app.logger.info("No REITs matched the final criteria.")
            else:
                for index, row in filtered_df.iterrows():
                    log_parts = [f"Ticker: {row['Ticker']:<8}"]
                    for conf in METRIC_CONFIG:
                        col = conf['metric_name']
                        val = row[col]
                        
                        if val is not None:
                            if conf.get('is_percentage', False):
                                val_str = f"{val:.2%}" # Format as percentage
                            else:
                                val_str = f"{val:.2f}" # Format as float
                        else:
                            val_str = "N/A"

                        log_label = conf['metric_name'].replace('_', ' ').title()
                        log_parts.append(f"{log_label}: {val_str:<10}")
                    app.logger.info(" | ".join(log_parts))
            app.logger.info("-----------------------------")

            metric_columns = [conf['metric_name'] for conf in METRIC_CONFIG]
            base_columns = ['Ticker', 'Company_Name', 'Business_Description', 'Website']
            reits_json = filtered_df[base_columns + metric_columns].to_dict('records')
            
            # --- PROFILING LOG 5 ---
            current_time = time.time()
            app.logger.info(f"[PERF_LOG] Step 5: Final merge, filter, and response prep took {current_time - last_step_time:.4f} seconds.")
            app.logger.info(f"[PERF_LOG] TOTAL TIME for endpoint: {current_time - start_time:.4f} seconds.")

            return jsonify({"reits": reits_json})

    except Exception as e:
        app.logger.error(f"Error in VECTORIZED filter logic: {e}")
        traceback.print_exc()
        return jsonify({"error": "A database error occurred."}), 500

# -------------------------------------------------------------------------
# =========================== LLM FILTER ENDPOINT =============================
# -------------------------------------------------------------------------

def translate_query_to_filters(user_query):
    """
    Builds a detailed prompt, calls the Gemini API, and parses the JSON response.
    """
    # The System Prompt is our instruction manual for the LLM.
    # It lists every available filter and gives the LLM rules to follow.
    system_prompt = f"""
    You are an expert financial analyst AI. Your task is to translate a user's natural language query into a structured JSON object.

    RULES:
    1. You MUST ONLY respond with a valid JSON object. The root of the object must contain two keys: "explanation" (a string) and "filters" (an object).
    2. The "explanation" should be a brief, friendly, one-paragraph summary of why you chose the generated filters based on the user's query.
    3. Prioritize the user's most important criteria for the "filters" object. You MUST generate 3 to 4 filters in total.
    4. For numeric ranges in the "filters" object, use your financial knowledge to set reasonable min/max values. For example, "high growth" might mean a minimum of 8% (0.08).
    5. The filter names in the "filters" object must be one of the following: min_operating_margin, max_operating_margin, min_revenue_growth, max_revenue_growth, min_ffo_growth, max_ffo_growth, min_interest_coverage, max_interest_coverage, min_debt_to_asset, max_debt_to_asset, min_payout_ratio, max_payout_ratio, min_ffo_payout_ratio, max_ffo_payout_ratio, min_pe_ratio, max_pe_ratio, min_pffo_ratio, max_pffo_ratio, min_ffo_to_revenue, max_ffo_to_revenue, min_net_debt_to_ebitda, max_net_debt_to_ebitda.
    6. Do not be overly restrictive. The goal is to return a manageable list of companies, not zero results.

    EXAMPLE:
    User Query: "Show me some safe apartment buildings with decent returns."
    Your JSON Response:
    {{
      "explanation": "Certainly. To find 'safe' investments, I've applied a maximum Debt to Asset ratio to screen for companies with low leverage. For 'decent returns,' I've added a minimum FFO growth rate.",
      "filters": {{
        "max_debt_to_asset": 0.5,
        "min_ffo_growth": 0.03
      }}
    }}

    USER QUERY:
    "{user_query}"
    """

    # Call Gemini API (similar to your worker)
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set")
    model = "gemini-2.5-flash"
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"role": "user","parts": [{"text": system_prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
        }
    }


    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        # This is the crucial part. It prints the detailed error message from Google.
        app.logger.error("!!!!!!!!!! GOOGLE API ERROR RESPONSE !!!!!!!!!!")
        app.logger.error(f"HTTP Status Code: {e.response.status_code}")
        app.logger.error(f"--- RESPONSE BODY FROM GOOGLE ---")
        app.logger.error(e.response.json()) # This logs the detailed error JSON
        app.logger.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        raise # Re-raise the exception so the overall process still fails as intended

    api_response = response.json()
    if not api_response.get("candidates"):
        raise ValueError("AI response was blocked or empty.")
    
    # The response should be a clean JSON string, which we parse and return
    json_text = api_response["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(json_text)

@app.route('/api/llm-filter', methods=['POST'])
@limiter.limit("10 per hour; 30 per day") # Rate limit to prevent abuse
def generate_llm_filter():
    """
    Receives a natural language query and uses an LLM to translate it
    into a JSON object of filter parameters.
    """
    data = request.json
    query = data.get("query")

    if not query:
        return jsonify({"error": "Query text is required."}), 400

    try:
        # We will create this 'translate_query_to_filters' function next
        filters_json = translate_query_to_filters(query)
        return jsonify(filters_json)
    except Exception as e:
        app.logger.error(f"Error in LLM filter generation: {e}")
        traceback.print_exc()
        return jsonify({"error": "Failed to generate filters from query."}), 500
    


# -------------------------------------------------------------------------
# ====================== Crowdfunding ENDPOINTS ===============================
# -------------------------------------------------------------------------
@app.route('/api/rec/universe', methods=['GET'])
def get_rec_universe():
    """
    Returns a list of all Real Estate Crowdfunding vehicles 
    with basic info from the 'rec_universe' table.
    """
    try:
        with db.engine.connect() as conn:
            query = "SELECT * FROM rec_universe"
            universe_df = pd.read_sql(query, conn)
    except Exception as e:
        app.logger.error(f"Error loading REC universe data: {e}")
        return jsonify({"error": "Failed to load REC Universe data"}), 500

    if universe_df.empty:
        return jsonify({"message": "No REC vehicles found.", "rec_universe": []}), 200

    # Replace NaN values with None for safe JSON serialization
    universe_df = universe_df.astype(object).where(pd.notna(universe_df), None)

    # Convert DataFrame to a list of dicts
    rec_universe_list = universe_df.to_dict(orient='records')
    return jsonify({"rec_universe": rec_universe_list}), 200


@app.route("/api/rec/<string:investment_vehicle>/performance", methods=['GET'])
def get_rec_performance(investment_vehicle):
    """
    Returns time-series data (e.g., total return, NAV growth, distribution yield)
    for the specified REC vehicle. The actual DB columns may have underscores
    instead of spaces, so we automatically replace spaces with underscores 
    before looking for the column.
    """

    # 1) Convert spaces to underscores to match your DB column naming convention
    col_name = investment_vehicle.replace(' ', '_')

    try:
        with db.engine.connect() as conn:
            # Load each table
            df_return = pd.read_sql("SELECT * FROM rec_total_return", conn)
            df_distribution = pd.read_sql("SELECT * FROM rec_distribution_yield", conn)
            df_nav = pd.read_sql("SELECT * FROM rec_nav_growth", conn)
    except Exception as e:
        app.logger.error(f"Error loading REC time-series tables: {e}")
        return jsonify({"error": "Failed to load one or more REC tables"}), 500

    if df_return.empty and df_distribution.empty and df_nav.empty:
        return jsonify({"message": "No time-series data available for any vehicle."}), 200

    data_out = {
        "vehicle": investment_vehicle, 
        "total_return": [],
        "distribution_yield": [],
        "nav_growth": []
    }

    def extract_series(df_wide, column):
        """ 
        Convert wide-format DF into a list of {date, value}, 
        stripping '%' if found and converting to float.
        """
        if df_wide.empty or column not in df_wide.columns:
            return []
        df_wide = df_wide.copy()

        # Convert 'Dates' to datetime
        df_wide['Dates'] = pd.to_datetime(df_wide['Dates'], errors="coerce")

        # Keep only date + the single vehicle column, drop NA
        df_wide = df_wide[['Dates', column]].dropna(subset=[column])

        # Strip '%' and convert to float
        df_wide[column] = (
            df_wide[column]
            .astype(str)
            .apply(pd.to_numeric, errors='coerce')
        )
        df_wide.dropna(subset=[column], inplace=True)

        # Sort by date ascending
        df_wide.sort_values(by='Dates', inplace=True)

        results = []
        for _, row in df_wide.iterrows():
            results.append({
                "date": row['Dates'].strftime('%Y-%m-%d') if not pd.isna(row['Dates']) else None,
                "value": row[column]
            })
        return results

    # Extract from each table
    data_out["total_return"] = extract_series(df_return, col_name)
    data_out["distribution_yield"] = extract_series(df_distribution, col_name)
    data_out["nav_growth"] = extract_series(df_nav, col_name)

    # If all are empty, no match
    if not data_out["total_return"] and not data_out["distribution_yield"] and not data_out["nav_growth"]:
        return jsonify({"message": f"No timeseries data found for vehicle '{investment_vehicle}'"}), 200

    return jsonify(data_out), 200


if __name__ == '__main__':
    app.run(debug=True)