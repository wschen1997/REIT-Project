import os
import sys
import fitz  # PyMuPDF
import requests
import json
import openai
from dotenv import load_dotenv

# ──────────────────────────────────────────────────────────────────
# Helpers to scrub & validate the JSON  (STEP 1)
# ──────────────────────────────────────────────────────────────────
def _clean_pct(val: str) -> str:
    """Trim whitespace; ensure % sign sticks to the number."""
    return val.strip().replace(" %", "%")

def _dedupe_list(lst, key_fields):
    """Remove duplicates while preserving order."""
    seen = set()
    cleaned = []
    for item in lst:
        if not item:                       # skip empty dicts
            continue
        sig = tuple((k, item.get(k, "").strip()) for k in key_fields)
        if sig in seen:
            continue
        for k, v in item.items():
            if isinstance(v, str) and "%" in v:
                item[k] = _clean_pct(v)
        cleaned.append(item)
        seen.add(sig)
    return cleaned

def scrub_json(data: dict) -> dict:
    """Walk the JSON tree and clean common Gemini artefacts."""
    if "top_tenants" in data:
        data["top_tenants"]["items"] = _dedupe_list(
            data["top_tenants"]["items"], key_fields=["name"]
        )
    if "top_tenant_sectors" in data:
        data["top_tenant_sectors"]["items"] = _dedupe_list(
            data["top_tenant_sectors"]["items"], key_fields=["name"]
        )
    if "lease_type_breakdown" in data:
        data["lease_type_breakdown"]["items"] = _dedupe_list(
            data["lease_type_breakdown"]["items"], key_fields=["lease_type"]
        )
    # drop empty sections
    for section in list(data.keys()):
        if not data[section] or data[section] in ({}, [], ""):
            del data[section]
    return data

# ------------------------------------------------------------------
# 🔑 Load Gemini API Key from Credentials.env
# ------------------------------------------------------------------
print("Loading environment variables from Credentials.env...")
script_dir = os.path.dirname(__file__)
dotenv_path = os.path.join(script_dir, "Credentials.env")
load_dotenv(dotenv_path)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("❌ API Key not set! Please check the key in Credentials.env")
print("GEMINI_API_KEY loaded successfully.")

# ------------------------------------------------------------------
# Configure REIT ticker and base path
# ------------------------------------------------------------------
if len(sys.argv) > 1:
    ticker = sys.argv[1].strip().upper()
else:
    ticker = input("Enter REIT ticker: ").strip().upper()
print(f"Processing ticker: {ticker}")

base_dir = r"C:\Users\wsche\OneDrive\桌面\Investment Research\Startup Project\Asset Screening\Individual REIT Data"
pdf_path = os.path.join(base_dir, ticker, "Company Filings", f"{ticker} IP.pdf")
print(f"PDF path resolved to: {pdf_path}")
if not os.path.exists(pdf_path):
    raise FileNotFoundError(f"❌ PDF file not found at: {pdf_path}")

# ------------------------------------------------------------------
# Read PDF with page markers
# ------------------------------------------------------------------
print("Opening PDF and extracting text layer...")
doc = fitz.open(pdf_path)
full_text = ""
for page_num in range(len(doc)):
    page_text = doc.load_page(page_num).get_text()
    full_text += f"\n[PAGE {page_num + 1}]\n" + page_text
doc.close()
print(f"Extracted {len(full_text)} characters of text layer.")

# ------------------------------------------------------------------
# Combine text (OCR logic removed)
# ------------------------------------------------------------------
text = full_text
print(f"Combined text length: {len(text)} (text layer only).")

# ------------------------------------------------------------------
# Gemini Prompt with dynamic debt_metrics keys
# ------------------------------------------------------------------
print("Building LLM prompt...")
prompt = f"""
You are a data extraction agent. Given the REIT's investor presentation, produce a single JSON object with these sections. Follow the strict rules at the end.

1. "top_tenants" (eg. EY, Google):
   {{
     "source_page": number,          # include one for each section
     "metric": string,               # eg. "by % of Rent"
     "items": [
       {{ "name": string, "percentage": string }},
       # …
     ]
   }}

2. "asset_type_breakdown" (eg. Office, Retail):
   {{
     "source_page": number,
     "metric": string,               # eg. "by % of GLA"
     "items": {{
       "<AssetType>": {{ "percentage": string }},
       # …
     }}
   }}

3. "geographic_breakdown" (eg. US states or countries):
   {{
     "source_page": number,
     "metric": string,               # eg. "by % of NAV"
     "items": {{
       "<Region>": {{ "percentage": string }},
       # up to 10 regions, less is fine.
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

6. "lease_expiration":     
   {{
     "source_page": number,
     "metric": string,
     "items": [
       {{ "year": string, "percentage": string }},  # eg. "2025", "12%", "2035+", "20%"
       # …
     ]
   }}

7. "debt_maturity_schedule":     
   {{
     "source_page": number,
     "unit": string,                 # eg. "million"
     "items": [
       {{ "year": string, "amount": string }}, # eg. "2025", "12M", "2035+", "20M"
       # …
     ]
   }}

8. "top_tenant_sectors": (eg. financials, technology):
   {{
     "source_page": number,
     "metric": string,               # eg. "by % of Rent"
     "items": [
       {{ "name": string, "percentage": string }},
       # up to 10 sectors
     ]
   }}

9. "lease_details":   
   {{
     "source_page": number,
     "items": [
       {{ "weighted average lease term/WALT": string }}, 
     ]
   }}

Strict Rules:
• Include only data explicitly present. DO NOT invent and hellucinate data.
• Omit any section entirely if no data found. DO not reurn empty or null sections. 
• Return valid JSON only—no commentary or markdown fences.
• After extracting, triple-check all JSON keys and values. Correct any typos or line-break artifacts.
• If a key is accurate but could be more descriptive (e.g. `"Unsecured": "99%"` should be modified to `"Percentage of unsecured debt": "99%"`), rename it.
• Strip out any footnote markers (e.g. `"Net lease exposure4,5"` should be modified to `"Net lease exposure"`).   

---TEXT START---
{text}
---TEXT END---
"""
print(f"Prompt length: {len(prompt)} characters.")

# ------------------------------------------------------------------
# Call Gemini API
# ------------------------------------------------------------------
url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
headers = {"Content-Type": "application/json"}
payload = {"contents": [{"parts": [{"text": prompt}]}]}
response = requests.post(f"{url}?key={GEMINI_API_KEY}", headers=headers, json=payload)

# ------------------------------------------------------------------
# Output & robust JSON cleanup  (STEP 2)
# ------------------------------------------------------------------
if response.status_code == 200:
    raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    start = raw.find("{")
    end   = raw.rfind("}")
    clean = raw[start:end+1] if start != -1 and end != -1 else raw.strip().lstrip("```json").lstrip("```").strip()
    try:
        data, _ = json.JSONDecoder().raw_decode(clean)
        data    = scrub_json(data)                     # ← apply scrubber
        print("[LOG] Final sections:", list(data.keys()))
        print(json.dumps(data, indent=2, ensure_ascii=False))
        with open(f"{ticker}_extracted.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"[LOG] Saved cleaned JSON → {ticker}_extracted.json")
    except json.JSONDecodeError as e:
        print("❌ Invalid JSON:", e)
        print("Raw response:\n", raw[:800], "...\n")
else:
    print(f"❌ Error calling Gemini API: {response.status_code}\n{response.text}")
