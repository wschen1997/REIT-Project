import requests

url = "http://127.0.0.1:5000/api/register"
payload = {
    "email": "testuser@example.com",
    "password": "supersecure"
}

response = requests.post(url, json=payload)

print("Status code:", response.status_code)
try:
    print("Response JSON:", response.json())
except:
    print("Raw Response:", response.text)
