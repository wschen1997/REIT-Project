import os
import requests
import pandas as pd
from dotenv import load_dotenv
import finnhub

# Load API credentials
dotenv_path = os.path.join(os.path.dirname(__file__), "Credentials.env")
load_dotenv(dotenv_path)
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")

# Initialize Finnhub client
finnhub_client = finnhub.Client(api_key=FINNHUB_API_KEY)

# Define stock ticker and date range
ticker = "WPC"

try:
    # Fetch news
    news_data = finnhub_client.company_news(ticker, _from="2025-01-01", to="2025-03-01")
    
    if news_data:
        # Convert to DataFrame and select columns
        df = pd.DataFrame(news_data)[["datetime", "headline", "summary", "source", "image", "url"]]

        # Convert timestamp to readable date format
        df["datetime"] = pd.to_datetime(df["datetime"], unit="s")

        # Function to fix missing/broken URLs
        def fix_url(row):
            if row["url"] and "finnhub.io/api/news?" not in row["url"]:
                return row["url"]  # Use valid URL
            elif row["source"] == "Yahoo":
                return f"https://finance.yahoo.com/search?q={row['headline'].replace(' ', '+')}"
            elif row["source"] == "SeekingAlpha":
                return f"https://seekingalpha.com/symbol/{ticker}/news"
            else:
                return ""  # Leave blank if no valid replacement

        # Apply function
        df["url"] = df.apply(fix_url, axis=1)

        # Debugging: Check if any URLs are still missing
        missing_urls = df[df["url"] == ""]
        if not missing_urls.empty:
            print("⚠️ Some articles are still missing URLs:")
            print(missing_urls[["headline", "source"]])

        # Print valid articles with URLs
        print("✅ Articles with Fixed URLs:")
        print(df[["datetime", "headline", "url", "source"]])

        # Save results
        df.to_csv("news_data_fixed.csv", index=False)
        print("News data saved to news_data_fixed.csv")

    else:
        print("No news found for the given ticker.")
except Exception as e:
    print(f"Error fetching news: {e}")
