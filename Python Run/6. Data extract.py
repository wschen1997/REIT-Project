import os
import fitz  # PyMuPDF
import requests

# ------------------------------------------------------------------
# 🔑 Hardcoded Gemini API Key (TEMP)
# ------------------------------------------------------------------
GEMINI_API_KEY = "AIzaSyA4KpgwYObXYGogrnnzjclNdGKO63GItGI"  # Replace with your actual key

if not GEMINI_API_KEY:
    raise ValueError("❌ API Key not set! Please check the key.")

# ------------------------------------------------------------------
# 📄 PDF Path (WPC Q4 Presentation)
# ------------------------------------------------------------------
pdf_path = r"C:\Users\wsche\OneDrive\桌面\Investment Research\Startup Project\Asset Screening\Individual REIT Data\WPC\Company Filings\10K.pdf"

if not os.path.exists(pdf_path):
    raise FileNotFoundError(f"❌ PDF file not found at: {pdf_path}")

# ------------------------------------------------------------------
# 📖 Read First 5 Pages of PDF
# ------------------------------------------------------------------
doc = fitz.open(pdf_path)
text = ""
for page_num in range(min(5, len(doc))):
    text += doc.load_page(page_num).get_text()
doc.close()

# ------------------------------------------------------------------
# 🧠 Gemini Prompt
# ------------------------------------------------------------------
prompt = f"""
You are analyzing an investor presentation from WPC REIT.

Please extract and return the following in clean JSON format:

1. The REIT's top 10 tenants and their respective percentages (if available).
2. The percentage breakdown of their real estate asset types (e.g., Office, Retail, Industrial).

Only include what's explicitly mentioned in the text.

---TEXT START---
{text}
---TEXT END---
"""

# ------------------------------------------------------------------
# 🌐 Call Gemini 2.0 Flash API
# ------------------------------------------------------------------
url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
headers = { "Content-Type": "application/json" }
payload = {
    "contents": [
        {
            "parts": [
                {"text": prompt}
            ]
        }
    ]
}

response = requests.post(f"{url}?key={GEMINI_API_KEY}", headers=headers, json=payload)

# ------------------------------------------------------------------
# 📤 Output
# ------------------------------------------------------------------
if response.status_code == 200:
    reply = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    print("✅ Gemini output:\n")
    print(reply)
else:
    print(f"❌ Error {response.status_code}:\n{response.text}")
