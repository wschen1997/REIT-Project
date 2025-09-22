import os
from dotenv import load_dotenv

dotenv_path = os.path.abspath(
    "C:/Users/wsche/OneDrive/桌面/Investment Research/Startup Project/Python Run/Credentials.env"
)
load_dotenv(dotenv_path)

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
from worker import generate_stability_analysis_task
from celery.result import AsyncResult
from google.cloud import firestore
import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore
import logging
import numpy as np

app = Flask(__name__)
app.logger.setLevel(logging.INFO)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "https://www.viserra-group.com"]}})

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
]

# The METRIC_CONFIG list stays the same as before

@app.route('/api/reits/advanced-filter', methods=['GET'])
def get_advanced_filtered_reits():
    """
    DEFINITIVE ENDPOINT V4.1 (Corrected): Fixes KeyError on merge by aligning
    column name case ('ticker' vs 'Ticker').
    """
    app.logger.info(f"Request received for SCALABLE PANDAS-BASED filter with args: {request.args}")
    args = request.args
    
    try:
        with db.engine.connect() as conn:
            # Step 1 & 2: Data fetching (No changes here)
            property_type = args.get('property_type')
            params = {}
            sql_tickers = "SELECT Ticker, Company_Name, Business_Description, Website FROM reit_business_data WHERE 1=1"
            if property_type:
                sql_tickers += " AND Property_Type LIKE :property_type"
                params['property_type'] = f"%{property_type}%"
            candidate_df = pd.read_sql(text(sql_tickers), conn, params=params)
            
            if candidate_df.empty:
                return jsonify({"reits": []})
            candidate_tickers = tuple(candidate_df['Ticker'].tolist())

            # This SQL query efficiently finds the most recent price for each ticker
            sql_prices = text("""
                WITH LatestPrices AS (
                    SELECT
                        ticker,
                        close_price,
                        ROW_NUMBER() OVER(PARTITION BY ticker ORDER BY date DESC) as rn
                    FROM reit_price_data
                    WHERE ticker IN :tickers
                )
                SELECT ticker, close_price FROM LatestPrices WHERE rn = 1
            """)
            price_df = pd.read_sql(sql_prices, conn, params={"tickers": candidate_tickers})

            # Convert the price data into a fast-lookup Series (like a dictionary)
            latest_prices = price_df.set_index('ticker')['close_price']

            line_items_to_fetch = set()
            for metric in METRIC_CONFIG:
                line_items_to_fetch.update(metric['line_items'])
            
            # THIS IS THE NEW, FUTURE-PROOF QUERY
            sql_financials = text("""
                (
                    SELECT ticker, TRIM(line_item) as line_item, fiscal_year, fiscal_quarter, value
                    FROM reit_income_statement
                    WHERE TRIM(line_item) IN :line_items AND ticker IN :tickers AND fiscal_quarter IS NOT NULL
                )
                UNION ALL
                (
                    SELECT ticker, TRIM(line_item) as line_item, fiscal_year, fiscal_quarter, value
                    FROM reit_industry_metrics
                    WHERE TRIM(line_item) IN :line_items AND ticker IN :tickers AND fiscal_quarter IS NOT NULL
                )
                UNION ALL
                (
                    SELECT ticker, TRIM(line_item) as line_item, fiscal_year, fiscal_quarter, value
                    FROM reit_balance_sheet
                    WHERE TRIM(line_item) IN :line_items AND ticker IN :tickers AND fiscal_quarter IS NOT NULL
                )
                UNION ALL
                (
                    SELECT ticker, TRIM(line_item) as line_item, fiscal_year, fiscal_quarter, value
                    FROM reit_cash_flow
                    WHERE TRIM(line_item) IN :line_items AND ticker IN :tickers AND fiscal_quarter IS NOT NULL
                )
            """)
            financials_df = pd.read_sql(sql_financials, conn, params={
                "line_items": tuple(line_items_to_fetch),
                "tickers": candidate_tickers
            })
            financials_df['value'] = financials_df['value'].replace(0, np.nan)

        # --- Step 3: Calculate Metrics Using the Configuration ---
        app.logger.info("--- STARTING METRIC CALCULATION ---")
        
        all_metrics_df = financials_df.groupby('ticker').apply(
            lambda group: calculate_metrics_for_ticker(group, latest_prices)
        )
        
        # --- FIX IS HERE ---
        # 1. Convert index ('ticker') to a column
        all_metrics_df = all_metrics_df.reset_index()
        # 2. RENAME the new 'ticker' column to 'Ticker' to match for the merge
        all_metrics_df = all_metrics_df.rename(columns={'ticker': 'Ticker'})
        
        app.logger.info("--- FINISHED METRIC CALCULATION ---")

        # --- Step 4: Merge, Filter, and Return ---
        final_df = pd.merge(candidate_df, all_metrics_df, on='Ticker', how='left')
        final_df = final_df.astype(object).where(pd.notna(final_df), None)
        
        filtered_df = final_df.copy()

        # Dynamic Filtering (No changes needed here)
        for metric_conf in METRIC_CONFIG:
            prefix = metric_conf['filter_prefix']
            metric_col = metric_conf['metric_name']
            
            min_val = args.get(f'min_{prefix}', type=float)
            max_val = args.get(f'max_{prefix}', type=float)
            
            if min_val is not None:
                filtered_df = filtered_df[filtered_df[metric_col].notna() & (filtered_df[metric_col] >= min_val)]
            if max_val is not None:
                filtered_df = filtered_df[filtered_df[metric_col].notna() & (filtered_df[metric_col] <= max_val)]

        # --- Step 5: Final Logging (No changes needed here) ---
        app.logger.info("--- VERIFICATION LOG (FINAL) ---")
        if filtered_df.empty:
            app.logger.info("No REITs matched the final criteria.")
        else:
            for index, row in filtered_df.iterrows():
                log_parts = [f"Ticker: {row['Ticker']:<8}"]
                for conf in METRIC_CONFIG:
                    col = conf['metric_name']
                    val = row[col]
                    
                    # Check the flag to decide on formatting
                    if val is not None:
                        if conf.get('is_percentage', False):
                            val_str = f"{val:.2%}" # Format as percentage
                        else:
                            val_str = f"{val:.2f}" # Format as float with 2 decimal places
                    else:
                        val_str = "N/A"

                    log_label = conf['metric_name'].replace('_', ' ').title()
                    log_parts.append(f"{log_label}: {val_str:<10}")
                app.logger.info(" | ".join(log_parts))

        app.logger.info("-----------------------------")
        
        # Get a list of all the metric column names from our config
        metric_columns = [conf['metric_name'] for conf in METRIC_CONFIG]
        
        # Define the base columns we always want to return
        base_columns = ['Ticker', 'Company_Name', 'Business_Description', 'Website']

        # Combine the lists and return all the necessary data
        reits_json = filtered_df[base_columns + metric_columns].to_dict('records')
        return jsonify({"reits": reits_json})

    except Exception as e:
        app.logger.error(f"Error in scalable pandas-based filter logic: {e}")
        traceback.print_exc()
        return jsonify({"error": "A database error occurred."}), 500

# --- HELPER FUNCTION (with FutureWarning fix) ---
def calculate_metrics_for_ticker(group, prices_series):
    """
    Takes a DataFrame for a single ticker and calculates all metrics
    defined in METRIC_CONFIG.
    """
    ticker = group['ticker'].iloc[0]
    price = prices_series.get(ticker)
    group = group.sort_values(by=['fiscal_year', 'fiscal_quarter'], ascending=True)

    def _period_index(df):
        if df.empty:
            return pd.PeriodIndex([], freq='Q-DEC')
        # FIX for FutureWarning
        return pd.PeriodIndex.from_fields(
            year=df['fiscal_year'].astype(int),
            quarter=df['fiscal_quarter'].astype(int),
            freq='Q'
        )

    # ... The rest of the helper function is identical ...
    all_periods = pd.PeriodIndex([], freq='Q-DEC')
    if not group.empty:
        valid_periods = group.dropna(subset=['fiscal_year', 'fiscal_quarter'])
        if not valid_periods.empty:
            all_periods = _period_index(valid_periods)

    if len(all_periods) == 0:
        return pd.Series({conf['metric_name']: None for conf in METRIC_CONFIG})

    start_period = all_periods.min()
    end_period = all_periods.max()
    master_index = pd.period_range(start=start_period, end=end_period, freq='Q')

    series_cache = {}
    def get_series_on_master(line_item):
        if line_item in series_cache:
            return series_cache[line_item]
        
        df_part = group[group['line_item'] == line_item].drop_duplicates(
            subset=['fiscal_year', 'fiscal_quarter'], keep='last'
        )
        if df_part.empty:
            s = pd.Series(index=master_index, dtype='float64')
        else:
            s = pd.Series(df_part['value'].values, index=_period_index(df_part))
        series_cache[line_item] = s.reindex(master_index)
        return series_cache[line_item]

    calculated_metrics = {}
    for conf in METRIC_CONFIG:
        metric_name = conf['metric_name']
        calc_type = conf['calculation_type']
        line_items = conf['line_items']

        if calc_type == 'ttm_margin':
            numerator_series = get_series_on_master(line_items[0])
            denominator_series = get_series_on_master(line_items[1])
            
            ttm_num = numerator_series.rolling(window=4, min_periods=4).sum().iloc[-1]
            ttm_den = denominator_series.rolling(window=4, min_periods=4).sum().iloc[-1]
            
            if pd.notna(ttm_den) and ttm_den != 0 and pd.notna(ttm_num):
                calculated_metrics[metric_name] = ttm_num / ttm_den
            else:
                calculated_metrics[metric_name] = None
        
        elif calc_type == 'avg_yoy_growth':
            series = get_series_on_master(line_items[0])
            
            if len(series) < 8:
                calculated_metrics[metric_name] = None
                continue

            yoy_growths = series.pct_change(periods=4, fill_method=None)
            last_4_growths = yoy_growths.tail(4)
            
            if last_4_growths.isnull().any():
                calculated_metrics[metric_name] = None
            else:
                calculated_metrics[metric_name] = float(last_4_growths.mean())
        
        
        elif calc_type == 'ttm_ratio':
            numerator_series = get_series_on_master(line_items[0])
            denominator_series = get_series_on_master(line_items[1])
            
            ttm_num = numerator_series.rolling(window=4, min_periods=4).sum().iloc[-1]
            ttm_den = denominator_series.rolling(window=4, min_periods=4).sum().iloc[-1]
            
            if pd.notna(ttm_den) and ttm_den != 0 and pd.notna(ttm_num):
                # For Interest Coverage, we want the raw ratio, not a percentage
                calculated_metrics[metric_name] = ttm_num / abs(ttm_den) # Use abs() for interest expense
            else:
                calculated_metrics[metric_name] = None

        elif calc_type == 'latest_ratio':
            # Get the complete, time-aware series for both line items
            numerator_series = get_series_on_master(line_items[0])
            denominator_series = get_series_on_master(line_items[1])
            
            # Get the last reported non-null value for each
            latest_num = numerator_series.dropna().iloc[-1] if not numerator_series.dropna().empty else None
            latest_den = denominator_series.dropna().iloc[-1] if not denominator_series.dropna().empty else None
            
            # Calculate the ratio if both values exist and the denominator is not zero
            if latest_den is not None and latest_den != 0 and latest_num is not None:
                calculated_metrics[metric_name] = latest_num / latest_den
            else:
                calculated_metrics[metric_name] = None

        elif calc_type == 'latest_value':
            # Get the complete, time-aware series for the single line item
            series = get_series_on_master(line_items[0])
            
            # Get the last reported non-null value
            latest_value = series.dropna().iloc[-1] if not series.dropna().empty else None
            
            # Store the value
            calculated_metrics[metric_name] = latest_value

        elif calc_type == 'price_to_ttm_value':
            # Check if we have a valid price for this ticker
            if price is None or pd.isna(price):
                calculated_metrics[metric_name] = None
                continue

            # Get the series for the denominator (e.g., Basic EPS or FFO per Share)
            denominator_series = get_series_on_master(line_items[0])

            # Calculate the Trailing Twelve Month (TTM) sum of the denominator
            ttm_den = denominator_series.rolling(window=4, min_periods=4).sum().iloc[-1]

            # Calculate the final ratio, ensuring the denominator is positive
            if pd.notna(ttm_den) and ttm_den > 0:
                calculated_metrics[metric_name] = price / ttm_den
            else:
                calculated_metrics[metric_name] = None

    app.logger.info(f"--- Processing Ticker: {ticker} ---")
    rev_series_log = get_series_on_master('Total Revenue')
    op_series_log = get_series_on_master('Operating Income')
    ffo_series_log = get_series_on_master('FFO')
    
    rev_yoy_log = rev_series_log.pct_change(periods=4, fill_method=None).tail(4)
    ffo_yoy_log = ffo_series_log.pct_change(periods=4, fill_method=None).tail(4)

    app.logger.info(f"[{ticker}] Raw Revenue points for TTM: {rev_series_log.tail(4).tolist()}")
    app.logger.info(f"[{ticker}] Raw OpIncome points for TTM: {op_series_log.tail(4).tolist()}")
    app.logger.info(f"[{ticker}] Individual Revenue YoY Growths for Avg: {[f'{x:.2%}' if pd.notna(x) else 'N/A' for x in rev_yoy_log]}")
    app.logger.info(f"[{ticker}] Individual FFO YoY Growths for Avg: {[f'{x:.2%}' if pd.notna(x) else 'N/A' for x in ffo_yoy_log]}")
    
    return pd.Series(calculated_metrics)