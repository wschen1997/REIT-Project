import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../context/LoadingContext.js";
import PopupModal from "../components/PopupModal.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function PricingPage({ currentUser, userPlan }) {
  const navigate = useNavigate();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const { isLoading, setLoading: setIsLoading } = useLoading();
  const [errorMessage, setErrorMessage] = useState("");

  // --- This logic remains completely unchanged ---
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

  // --- This logic remains completely unchanged ---
  const handleSubscribe = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

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
        setErrorMessage(data.error || "Unable to create Stripe session. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMessage("An unexpected error occurred. Please check your connection.");
      console.error("Error:", err);
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="pricing-page-container">
        <h1 className="pricing-page-title">Unlock Premium Access</h1>
        <p className="pricing-page-subtitle">
          Upgrade to Premium for full access to all our analytical tools and data.
        </p>

        {errorMessage && (
          <p className="error-message" style={{ marginTop: '20px' }}>
            {errorMessage}
          </p>
        )}

        <button
          onClick={handleSubscribe}
          disabled={isLoading || userPlan === 'premium'}
          // Switched to using CSS classes for styling and hover effects
          className={`btn btn-primary pricing-subscribe-btn ${userPlan === 'premium' ? 'btn-disabled' : ''}`}
        >
          {userPlan === 'premium' ? 'You Are a Premium Member' : 'Subscribe Now'}
        </button>
      </div>

      <PopupModal
        show={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
        title="Payment Successful!"
      >
        <p>You are now a premium subscriber. Thank you!</p>
      </PopupModal>

      <PopupModal
        show={showCancelPopup}
        onClose={() => setShowCancelPopup(false)}
        title="Payment Canceled"
      >
        <p>Your subscription was not completed.</p>
      </PopupModal>

    </div>
  );
}

export default PricingPage;