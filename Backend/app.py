from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
from flask_cors import CORS
from datetime import datetime
import os
from dotenv import load_dotenv

# Explicitly load environment variables
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

DB_URL = f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "connect_args": {
        "ssl": {
            "fake_flag_to_enable": True  # Ensures SSL connection
        }
    }
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

@app.route('/')
def index():
    return "REIT Screener API is running!"

@app.route('/api/reits', methods=['GET'])
def get_reits():
    selected_country = request.args.get('country', default=None, type=str)
    selected_property_type = request.args.get('property_type', default=None, type=str)
    selected_ticker = request.args.get('ticker', default=None, type=str)

    try:
        with db.engine.connect() as conn:
            query = "SELECT * FROM reit_business_data"
            business_data = pd.read_sql(query, conn)
    except Exception as e:
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
        return jsonify({"error": "Failed to load scoring analysis data"}), 500

    merged_data = pd.merge(business_data, risk_data, on="Ticker", how="inner")

    def clean_nan_values(obj):
        return obj.where(pd.notna(obj), None)  # Convert NaN values to None

    cleaned_data = merged_data.apply(clean_nan_values)

    explanation = (
        f"Filtered REITs: Country - {selected_country}, "
        f"Property Type - {selected_property_type}, "
        f"Ticker - {selected_ticker}."
    )

    response = {
        "explanation": explanation,
        "reits": cleaned_data[
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
