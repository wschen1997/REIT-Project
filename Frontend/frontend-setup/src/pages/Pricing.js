import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// The component now accepts props from App.js
function PricingPage({ currentUser, userPlan }) {
  const navigate = useNavigate();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // This useEffect is now MUCH simpler. It only handles the redirect from Stripe.
  useEffect(() => {
    if (performance.getEntriesByType("navigation")[0]?.type === "back_forward") {
      setIsLoading(false);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      setShowSuccessPopup(true);
      // Clean up the URL so the popup doesn't reappear on refresh
      window.history.replaceState({}, document.title, "/pricing");
    } else if (params.get("status") === "cancel") {
      setShowCancelPopup(true);
      window.history.replaceState({}, document.title, "/pricing");
    }
  }, []); // The dependency array is empty as it only needs to run once.

  // This function now uses the currentUser prop.
  const handleSubscribe = async () => {
    // If no user is logged in, redirect them to the login page.
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the current user's email to the backend to identify them
        body: JSON.stringify({ email: currentUser.email })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Unable to create Stripe session: " + (data.error || "Unknown error"));
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div style={{ padding: "80px 20px", textAlign: "center" }}>
        <h1 style={{ color: "#5A153D", fontSize: "2.5rem" }}>Unlock Premium Access</h1>
        <p style={{ fontSize: "1.2rem", color: "#333" }}>
          Upgrade to Premium for full access to all our analytical tools and data.
        </p>

        {/* This button now uses the userPlan prop */}
        <button
          onClick={handleSubscribe}
          disabled={isLoading || userPlan === 'premium'}
          onMouseEnter={(e) => {
            if (userPlan !== 'premium') {
              e.currentTarget.style.backgroundColor = "#faf0fb";
              e.currentTarget.style.color = "#5A153D";
            }
          }}
          onMouseLeave={(e) => {
             if (userPlan !== 'premium') {
               e.currentTarget.style.backgroundColor = "#5A153D";
               e.currentTarget.style.color = "#fff";
             }
          }}
          style={{
            backgroundColor: userPlan === 'premium' ? "#ccc" : "#5A153D",
            color: userPlan === 'premium' ? "#666" : "#fff",
            padding: "12px 28px",
            fontSize: "1.1rem",
            border: "none",
            borderRadius: "8px",
            cursor: userPlan === 'premium' ? "not-allowed" : "pointer",
            marginTop: "30px",
            transition: "background-color 0.2s, color 0.2s"
          }}
        >
          {userPlan === 'premium' ? 'You Are a Premium Member' : 'Subscribe Now'}
        </button>
      </div>

      {/* SUCCESS POPUP (This section is unchanged) */}
      {showSuccessPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "25px",
              borderRadius: "10px",
              textAlign: "center",
              width: "320px",
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ color: "#5A153D" }}>Payment Successful!</h3>
            <p style={{ color: "#333" }}>
              You are now a premium subscriber. Thank you!
            </p>
            <button
              onClick={() => setShowSuccessPopup(false)}
              style={{
                backgroundColor: "#5A153D",
                color: "white",
                padding: "10px 16px",
                border: "none",
                borderRadius: "6px",
                marginTop: "10px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* CANCEL POPUP (This section is unchanged) */}
      {showCancelPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "25px",
              borderRadius: "10px",
              textAlign: "center",
              width: "320px",
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ color: "#5A153D" }}>Payment Canceled</h3>
            <p style={{ color: "#333" }}>
              Your subscription was not completed.
            </p>
            <button
              onClick={() => setShowCancelPopup(false)}
              style={{
                backgroundColor: "#5A153D",
                color: "white",
                padding: "10px 16px",
                border: "none",
                borderRadius: "6px",
                marginTop: "10px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {isLoading && <Loading />}
      <BottomBanner />
    </div>
  );
}

export default PricingPage;