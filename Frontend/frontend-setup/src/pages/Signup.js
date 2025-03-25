import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.js";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js";
import { useAuth0 } from "@auth0/auth0-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function SignupOrPlanPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, loginWithRedirect } = useAuth0();

  const [plan, setPlan] = useState(null); // "free" or "premium"
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // If not logged in, prompt user to log in with Auth0
  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.1)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            overflowY: "auto"
          }}
          onClick={() => navigate("/")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "clamp(320px, 40%, 600px)",
              backgroundColor: "#fff",
              margin: "2rem auto",
              borderRadius: "12px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "3rem",
            }}
          >
            <h2 style={{ marginBottom: "1rem", fontSize: "1.8rem", color: "#333" }}>
              Welcome to Viserra Analytics
            </h2>
            <p style={{ color: "#666", marginBottom: "1.5rem" }}>
              Please log in or sign up with Auth0 to continue.
            </p>
            
            <button
              onClick={() => loginWithRedirect()}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#5A153D",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Continue with Auth0
            </button>
          </div>
        </div>
        <BottomBanner />
      </>
    );
  }

  // Once authenticated, let them pick free or premium
  const handlePlanClick = (selectedPlan) => {
    setPlan(selectedPlan);
    if (selectedPlan === "free") {
      // no Stripe
      navigate("/");
    } else if (selectedPlan === "premium") {
      handleSubscribe();
    }
  };

  // Stripe subscription
  const handleSubscribe = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Where to go after success/cancel
          success_url: "https://www.viserra-group.com?status=success",
          cancel_url: "https://www.viserra-group.com?status=cancel",
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Unable to create Stripe session.");
      }
    } catch (err) {
      setError("Checkout error. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      {isLoading && <Loading />}

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
          overflowY: "auto",
        }}
        onClick={() => navigate("/")}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "clamp(320px, 40%, 600px)",
            backgroundColor: "#fff",
            margin: "2rem auto",
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "3rem",
          }}
        >
          <h2 style={{ marginBottom: "1rem", fontSize: "1.8rem", color: "#333" }}>
            Choose Your Plan
          </h2>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            You are signed in as {user?.name || user?.email}.
          </p>

          {error && (
            <div
              style={{
                color: "red",
                marginBottom: "1rem",
                fontWeight: "bold",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "2rem" }}>
            <div
              onClick={() => handlePlanClick("free")}
              style={{
                border: plan === "free" ? "2px solid #5A153D" : "2px solid #ccc",
                borderRadius: "8px",
                padding: "1rem",
                cursor: "pointer",
              }}
            >
              <strong>Free</strong>
              <p style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                Basic REIT screening<br/>
                Access limited data
              </p>
            </div>
            
            <div
              onClick={() => handlePlanClick("premium")}
              style={{
                border: plan === "premium" ? "2px solid #5A153D" : "2px solid #ccc",
                borderRadius: "8px",
                padding: "1rem",
                cursor: "pointer",
              }}
            >
              <strong>Premium</strong>
              <p style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                Advanced screening<br/>
                Full data and analysis<br/>
                $5/month
              </p>
            </div>
          </div>
        </div>
      </div>
      <BottomBanner />
    </>
  );
}

export default SignupOrPlanPage;
