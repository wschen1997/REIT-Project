import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js";
import PopupModal from "../components/PopupModal.js"; // --- 1. IMPORT PopupModal

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// The component now accepts props from App.js
function PricingPage({ currentUser, userPlan }) {
  const navigate = useNavigate();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(""); // --- 2. ADD state for error messages

  // This useEffect remains completely unchanged.
  useEffect(() => {
    if (performance.getEntriesByType("navigation")[0]?.type === "back_forward") {
      setIsLoading(false);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      setShowSuccessPopup(true);
      window.history.replaceState({}, document.title, "/pricing");
    } else if (params.get("status") === "cancel") {
      setShowCancelPopup(true);
      window.history.replaceState({}, document.title, "/pricing");
    }
  }, []);

  // This function now uses the currentUser prop.
  const handleSubscribe = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    setErrorMessage(""); // --- 3. ADDED: Clear previous errors on a new attempt

    try {
      const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // --- 4. MODIFIED: Replaced alert() with a styled error message
        setErrorMessage(data.error || "Unable to create Stripe session. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      // --- 5. MODIFIED: Added a user-friendly error for network issues
      setErrorMessage("An unexpected error occurred. Please check your connection.");
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

        {/* --- 6. ADDED: The error message will render here when set --- */}
        {errorMessage && (
          <p className="error-message" style={{ marginTop: '20px' }}>
            {errorMessage}
          </p>
        )}

        {/* This button and its logic remain completely unchanged */}
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

      {/* --- 7. REPLACED: The old success popup is now the reusable PopupModal --- */}
      <PopupModal
        show={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
        title="Payment Successful!"
      >
        <p>You are now a premium subscriber. Thank you!</p>
      </PopupModal>

      {/* --- 8. REPLACED: The old cancel popup is now the reusable PopupModal --- */}
      <PopupModal
        show={showCancelPopup}
        onClose={() => setShowCancelPopup(false)}
        title="Payment Canceled"
      >
        <p>Your subscription was not completed.</p>
      </PopupModal>

      {isLoading && <Loading />}
      <BottomBanner />
    </div>
  );
}

export default PricingPage;