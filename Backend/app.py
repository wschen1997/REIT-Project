from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
from flask_cors import CORS
import os
from dotenv import load_dotenv

dotenv_path = os.path.abspath(
    "C:/Users/wsche/OneDrive/桌面/Investment Research/Startup Project/Python Run/Credentials.env"
)
load_dotenv(dotenv_path)

app = Flask(__name__)
CORS(app)

DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

DB_URL = f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

@app.route('/')
def index():
    return "REIT Screener API is running!"

@app.route('/api/reits', methods=['GET'])
def get_reits():
    """
    Filters REITs based on user selections and returns business details with additional scoring analysis.
    """

    selected_country = request.args.get('country', default=None, type=str)
    selected_property_type = request.args.get('property_type', default=None, type=str)
    selected_ticker = request.args.get('ticker', default=None, type=str)

    try:
        with db.engine.connect() as conn:
            query = "SELECT * FROM reit_business_data"
            business_data = pd.read_sql(query, conn)
    except Exception as e:
        app.logger.error(f"Error loading REIT business data: {e}")
        return jsonify({"error": "Failed to load REIT business data"}), 500

    if selected_country:
        business_data = business_data[business_data['Country_Region'] == selected_country]

    if selected_property_type:
        business_data = business_data[
            business_data['Property_Type'].str.contains(selected_property_type, case=False, na=False)
        ]

    if selected_ticker:
        business_data = business_data[business_data['Ticker'] == selected_ticker]

    if business_data.empty:
        return jsonify({"explanation": "No REITs match the selected criteria.", "reits": []})

    try:
        with db.engine.connect() as conn:
            risk_query = "SELECT * FROM reit_scoring_analysis"
            risk_data = pd.read_sql(risk_query, conn)
    except Exception as e:
        app.logger.error(f"Error loading scoring analysis data: {e}")
        return jsonify({"error": "Failed to load scoring analysis data"}), 500

    merged_data = pd.merge(business_data, risk_data, on="Ticker", how="inner")

    explanation = (
        f"Filtered REITs: Country - {selected_country}, "
        f"Property Type - {selected_property_type}, "
        f"Ticker - {selected_ticker}."
    )

    ### **Convert all non-JSON-safe values to proper types**
    def clean_json(value):
        if pd.isna(value):
            return None
        elif isinstance(value, (float, int)):
            return float(value) if not pd.isna(value) else None
        elif isinstance(value, str):
            return value.strip() if value.strip() else None
        return value

    merged_data = merged_data.applymap(clean_json)

    response = {
        "explanation": explanation,
        "reits": merged_data[
            [
                "Ticker",
                "Company_Name",
                "Business_Description",
                "Website",
                "Property_Type",
                "Numbers_Employee",
                "Year_Founded",
                "US_Investment_Regions",
                "Overseas_Investment",
                "Total_Real_Estate_Assets_M_",
                "5yr_FFO_Growth",
            ]
        ].to_dict(orient='records')
    }

    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)
