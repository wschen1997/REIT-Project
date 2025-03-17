from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
from flask_cors import CORS
from datetime import datetime
import os
from dotenv import load_dotenv

# Explicitly load environment variables from the Credentials.env file
dotenv_path = os.path.abspath(
    "C:/Users/wsche/OneDrive/桌面/Investment Research/Startup Project/Python Run/Credentials.env"
)
load_dotenv(dotenv_path)

app = Flask(__name__)
CORS(app)

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
# FINANCIAL DATA ENDPOINT (Last 6 quarters) - optionally includes scoring info
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

    # 1) Load the financial display table
    try:
        with db.engine.connect() as conn:
            fd_data = pd.read_sql("SELECT * FROM reit_financial_display", conn)
    except Exception as e:
        app.logger.error(f"Error loading reit_financial_display: {e}")
        return jsonify({"error": "Failed to load financial display data"}), 500

    if fd_data.empty:
        return jsonify({"error": "Financial display table is empty"}), 404

    # 2) Build ticker prefix (e.g., "GIPR_US_Equity")
    ticker_prefix = f"{ticker}_US_Equity"

    # Build column names
    ffo_col = build_col_name(ticker_prefix, "FFO_PS")
    dvd_col = build_col_name(ticker_prefix, "DVD")
    noi_col = build_col_name(ticker_prefix, "NOI_PS")

    existing_cols = fd_data.columns.tolist()
    has_ffo = ffo_col in existing_cols
    has_dvd = dvd_col in existing_cols
    has_noi = noi_col in existing_cols

    if not any([has_ffo, has_dvd, has_noi]):
        return jsonify({"message": f"No financial data found for ticker '{ticker}'"}), 200

    # 3) Keep only needed columns: "Dates" + available metric columns
    selected_cols = ["Dates"]
    if has_ffo:
        selected_cols.append(ffo_col)
    if has_dvd:
        selected_cols.append(dvd_col)
    if has_noi:
        selected_cols.append(noi_col)

    filtered = fd_data[selected_cols].copy()
    metric_cols = [c for c in selected_cols if c != "Dates"]
    filtered.dropna(how='all', subset=metric_cols, inplace=True)

    if filtered.empty:
        return jsonify({"message": f"No non-null financial data found for ticker '{ticker}'"}), 200

    filtered["Dates"] = pd.to_datetime(filtered["Dates"], errors="coerce")
    filtered.sort_values(by="Dates", ascending=False, inplace=True)
    filtered = filtered.head(6)
    filtered.sort_values(by="Dates", ascending=True, inplace=True)
    filtered["Quarter"] = filtered["Dates"].apply(convert_date_to_quarter)

    results = []
    for _, row in filtered.iterrows():
        row_obj = {
            "quarter": row["Quarter"],
            "date": row["Dates"].strftime("%Y-%m-%d") if not pd.isna(row["Dates"]) else None,
        }
        if has_ffo:
            row_obj["ffo_ps"] = float(row[ffo_col]) if not pd.isna(row[ffo_col]) else None
        if has_dvd:
            row_obj["dvd"] = float(row[dvd_col]) if not pd.isna(row[dvd_col]) else None
        if has_noi:
            row_obj["noi_ps"] = float(row[noi_col]) if not pd.isna(row[noi_col]) else None

        results.append(row_obj)

    if not results:
        return jsonify({"message": f"No valid data for ticker '{ticker}'"}), 200

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
# ====================== NEW: REC ENDPOINTS ===============================
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
