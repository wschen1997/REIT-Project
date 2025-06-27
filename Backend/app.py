from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
from sqlalchemy import text
from flask_cors import CORS
from datetime import datetime
import os
from dotenv import load_dotenv
import stripe
import bcrypt
import jwt
from datetime import timedelta
import json
import requests
import traceback
from Backend.worker import generate_stability_analysis_task
from celery.result import AsyncResult

# Explicitly load environment variables from the Credentials.env file
dotenv_path = os.path.abspath(
    "C:/Users/wsche/OneDrive/桌面/Investment Research/Startup Project/Python Run/Credentials.env"
)
load_dotenv(dotenv_path)

app = Flask(__name__)
CORS(app)

# get the stripe secret key from the environment variables
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

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
# OVERVIEW FINANCIAL DATA ENDPOINT (Last 6 quarters)
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
        if result.get("error"): # Handle cases where the task failed internally
             return jsonify({"status": "FAILURE", "error": result["error"]}), 200
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
    data = request.json or {}

    # If not provided by the frontend, default to these:
    success_url = data.get("success_url", "https://www.viserra-group.com/signup?status=success")
    cancel_url = data.get("cancel_url", "https://www.viserra-group.com/signup?status=cancel")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode='subscription',
            line_items=[{
                'price': 'price_1R5WryL1vfYfs767GYSqHKn0',  #Test Price ID
                'quantity': 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url
        )

        return jsonify({'url': session.url})

    except Exception as e:
        print("Stripe Error:", str(e))
        return jsonify({'error': str(e)}), 500

# -------------------------------------------------------------------------
# ====================== premium user registration ===================
# -------------------------------------------------------------------------
@app.route('/api/register-premium-user', methods=['POST'])
def register_premium_user():
    """
    This is called from the frontend AFTER payment succeeds to store premium user in Firestore.
    """
    from google.cloud import firestore
    import firebase_admin
    from firebase_admin import credentials, firestore as admin_firestore

    try:
        if not firebase_admin._apps:
            raw_cred = os.getenv("FIREBASE_SERVICE_ACCOUNT")
            if not raw_cred:
                print("🔥 Missing FIREBASE_SERVICE_ACCOUNT environment variable")
                return jsonify({"error": "Server misconfiguration: Firebase credentials missing."}), 500

            # Try parsing it
            cred_json = json.loads(raw_cred)
            print("✅ FIREBASE_SERVICE_ACCOUNT keys loaded:", list(cred_json.keys()))

            cred = credentials.Certificate(cred_json)
            firebase_admin.initialize_app(cred)

        db_fs = admin_firestore.client()

        data = request.get_json()
        email = data.get("email")
        username = data.get("username")
        plan = "premium"

        if not email or not username:
            print("Missing email or username in request body")
            return jsonify({"error": "Missing required fields"}), 400

        doc_ref = db_fs.collection("users").document(email)
        doc_ref.set({
            "email": email,
            "username": username,
            "plan": plan,
            "createdAt": datetime.utcnow().isoformat()
        })

        print(f"✅ Premium user created in Firestore: {email}")
        return jsonify({"message": "Premium user successfully registered."}), 200

    except Exception as e:
        print("🔥 Exception while registering premium user:", str(e))
        return jsonify({"error": f"Failed to save user: {str(e)}"}), 500

# -------------------------------------------------------------------------
# =========================== Peer Scatter ENDPOINTS ==============================
# -------------------------------------------------------------------------

@app.route("/api/peer-scatter", methods=["GET"])
def get_peer_scatter():
    """
    Returns peer scatter data for all REITs whose Property_Type includes the requested property type.
    The endpoint expects a query parameter 'property_type'.
    It returns an array of objects: { "ticker": <Ticker>, "x": <Stability Percentile>, "y": <Fundamental Percentile> }
    """
    property_type = request.args.get("property_type")
    if not property_type:
        return jsonify({"error": "property_type parameter is required"}), 400

    try:
        with db.engine.connect() as conn:
            # Query business data to get tickers matching the property type (using a LIKE query)
            query_business = text("""
                SELECT Ticker
                FROM reit_business_data
                WHERE Property_Type LIKE :prop
            """)
            business_df = pd.read_sql(query_business, conn, params={"prop": f"%{property_type}%"})
            
            if business_df.empty:
                return jsonify([])  # No REITs found for this property type

            # Get unique tickers
            tickers = tuple(business_df["Ticker"].unique())
            # Ensure tickers is a tuple (if only one, force a tuple with a trailing comma)
            if len(tickers) == 1:
                tickers = (tickers[0],)

            # Query scoring analysis data for these tickers
            query_scoring = text("""
                SELECT Ticker, `Stability Percentile` AS stability, `Fundamental_Percentile` AS fundamental
                FROM reit_scoring_analysis
                WHERE Ticker IN :tickers
            """)
            scoring_df = pd.read_sql(query_scoring, conn, params={"tickers": tickers})

            # Build the output list
            result = []
            for _, row in scoring_df.iterrows():
                if row["stability"] is not None and row["fundamental"] is not None:
                    result.append({
                        "ticker": row["Ticker"],
                        "x": float(row["stability"]),
                        "y": float(row["fundamental"])
                    })
            return jsonify(result)
    except Exception as e:
        app.logger.error("Error in get_peer_scatter: " + str(e))
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------------------
# ====================== REC ENDPOINTS ===============================
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
