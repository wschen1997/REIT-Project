import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js";
// --- CHANGE #1: Import Clerk and Firestore tools ---
import { useUser } from "@clerk/clerk-react";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://1227.0.0.1:5000";

// --- CHANGE #2: Remove props from the component definition ---
function PricingPage() {
  const navigate = useNavigate();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- CHANGE #3: Get user from Clerk and create state for the plan ---
  const { user, isSignedIn, isLoaded } = useUser();
  const [userPlan, setUserPlan] = useState(null);

  // This useEffect handles the redirect back from Stripe. It is unchanged.
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

  // --- CHANGE #4: Add a new useEffect to fetch the user's plan from Firestore ---
  useEffect(() => {
    // Wait for Clerk to load the user
    if (!isLoaded) return;

    const fetchUserPlan = async () => {
      if (isSignedIn && user) {
        const userEmail = user.primaryEmailAddress.emailAddress;
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", userEmail));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          setUserPlan(userData.plan); // Set the plan from Firestore
        }
      }
    };
    fetchUserPlan();
  }, [isLoaded, isSignedIn, user]); // Rerun when user state changes

  // --- CHANGE #5: Update handleSubscribe to use the Clerk user ---
  const handleSubscribe = async () => {
    if (!isSignedIn) {
      navigate('/clerk-signin'); // Redirect to Clerk sign-in if not logged in
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the Clerk user's email to the backend
        body: JSON.stringify({ email: user.primaryEmailAddress.emailAddress })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Use a more user-friendly error display instead of alert()
        console.error("Stripe session error:", data.error);
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

        {/* This button now correctly uses the userPlan state fetched from Firestore */}
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