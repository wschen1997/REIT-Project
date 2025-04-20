import os
import sys
import fitz  # PyMuPDF
import requests
import json
from dotenv import load_dotenv
from PIL import Image
import pytesseract
import io

# ------------------------------------------------------------------
# 🔑 Load Gemini API Key from Credentials.env
# ------------------------------------------------------------------
script_dir = os.path.dirname(__file__)
dotenv_path = os.path.join(script_dir, "Credentials.env")
load_dotenv(dotenv_path)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("❌ API Key not set! Please check the key in Credentials.env")

# ------------------------------------------------------------------
# Configure Tesseract executable location
# ------------------------------------------------------------------
# Point pytesseract at the installed tesseract.exe
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ------------------------------------------------------------------
# Configure REIT ticker and base path
# ------------------------------------------------------------------
if len(sys.argv) > 1:
    ticker = sys.argv[1].strip().upper()
else:
    ticker = input("Enter REIT ticker: ").strip().upper()

base_dir = r"C:\Users\wsche\OneDrive\桌面\Investment Research\Startup Project\Asset Screening\Individual REIT Data"
pdf_path = os.path.join(base_dir, ticker, "Company Filings", f"{ticker} IP.pdf")
if not os.path.exists(pdf_path):
    raise FileNotFoundError(f"❌ PDF file not found at: {pdf_path}")

# ------------------------------------------------------------------
# Read PDF with page markers
# ------------------------------------------------------------------
doc = fitz.open(pdf_path)
full_text = ""
for page_num in range(len(doc)):
    page_text = doc.load_page(page_num).get_text()
    full_text += f"\n[PAGE {page_num + 1}]\n" + page_text

# ------------------------------------------------------------------
# OCR on chart pages for Lease Expirations and Debt Maturities
# ------------------------------------------------------------------
KEYWORDS = ["lease expir", "debt matur"]
ocr_text = ""
for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    page_txt_lower = page.get_text().lower()
    if any(kw in page_txt_lower for kw in KEYWORDS):
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        ocr_result = pytesseract.image_to_string(img)
        ocr_text += f"\n[OCR PAGE {page_num + 1}]\n{ocr_result}"

doc.close()
text = full_text + "\n" + ocr_text
print(f"Extracted text length: {len(text)} (from {ticker})")

# ------------------------------------------------------------------
# Gemini Prompt with dynamic debt_metrics keys
# ------------------------------------------------------------------
prompt = f"""
You are a data extraction agent. Given the REIT's investor presentation, produce a single JSON object with these sections.

1. "top_tenants" (eg. EY, Google):
   {{
     "source_page": number,          # include one for each section
     "metric": string,               # eg. "% of Rent"
     "items": [
       {{ "name": string, "percentage": string }},
       # up to 10 tenants
     ]
   }}

2. "asset_type_breakdown" (eg. Office, Retail):
   {{
     "source_page": number,
     "metric": string,               # eg. "% of GLA"
     "items": {{
       "<AssetType>": {{ "percentage": string }},
       # …
     }}
   }}

3. "geographic_breakdown" (eg. US states or countries):
   {{
     "source_page": number,
     "metric": string,               # eg. "% of NAV"
     "items": {{
       "<Region>": {{ "percentage": string }},
       # …
     }}
   }}

4. "lease_type_breakdown":
   {{
     "source_page": number,
     "metric": string,
     "items": [
       {{ "lease_type": string, "percentage": string }},  # eg. "Triple Net, Modified Gross"
       # …
     ]
   }}

5. "debt_metrics":
   {{
     "source_page": number,
     "items": {{
       "<DebtRatioName>": "<value>",  # eg. "5.4x"
       # …
     }}
   }}

6. "lease_expiration":     # Only include bars with explicit numeric labels from the bar chart under "Lease Expirations"
   {{
     "source_page": number,
     "metric": string,
     "items": [
       {{ "year": string, "percentage": string }},  # eg. "2025", "12%"
       # …
     ]
   }}

7. "debt_maturity_schedule":     # Only include bars with explicit numeric labels; ignore empty ticks or revolvers
   {{
     "source_page": number,
     "unit": string,                 # eg. "million"
     "items": [
       {{ "year": string, "amount": string }},
       # …
     ]
   }}

Strict Rules:
- Include only data explicitly present. DO NOT invent.
- Omit any section entirely if no data found.
- Return valid JSON only—no commentary or markdown fences.
- After extracting, triple‑check all JSON keys and correct any typos or line‑break artifacts.
- If any data point is technically accurate but could be more descriptive (e.g. `"Unsecured": "99%"` → `"Percentage of unsecured debt": "99%"`), rename it.
- Strip out any footnote markers or stray artifacts (e.g. `"Triple net lease exposure4,5"` → `"Triple net lease exposure"`).
- For any chart‑based section, only extract data points that display an explicit numeric label.

---TEXT START---
{text}
---TEXT END---
"""

# ------------------------------------------------------------------
# Call Gemini API
# ------------------------------------------------------------------
url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
headers = {"Content-Type": "application/json"}
payload = {"contents": [{"parts": [{"text": prompt}]}]}
response = requests.post(f"{url}?key={GEMINI_API_KEY}", headers=headers, json=payload)

# ------------------------------------------------------------------
# Output & robust JSON cleanup
# ------------------------------------------------------------------
if response.status_code == 200:
    raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    start = raw.find("{")
    end = raw.rfind("}")
    clean = raw[start:end+1] if start != -1 and end != -1 else raw.strip().lstrip("```json").lstrip("```").strip()
    try:
        data, _ = json.JSONDecoder().raw_decode(clean)
        print("✅ Valid JSON keys:", list(data.keys()))
        print(json.dumps(data, indent=2))
    except json.JSONDecodeError as e:
        print("❌ Invalid JSON:", e)
        print("Cleaned response:\n", clean)
else:
    print(f"❌ Error {response.status_code}:\n{response.text}")
