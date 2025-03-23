import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "../components/Header.js";
import BottomBanner from "../components/BottomBanner.js";

// Adjust for your environment
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const Signup = () => {
  const navigate = useNavigate();

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [plan, setPlan] = useState("free");

  // UI / state
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 1) On mount, check if the URL indicates a Stripe checkout result
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const status = query.get("status");
    // If user just returned from Stripe with "?status=success"
    if (status === "success") {
      // Retrieve the pending data from localStorage
      const pendingData = localStorage.getItem("pendingSignupData");
      if (pendingData) {
        const { email, password } = JSON.parse(pendingData);
        // Register user with plan = "premium"
        finishPremiumSignup(email, password);
      }
    } else if (status === "cancel") {
      setError("Payment was canceled. Please try again or choose Free plan.");
    }
  }, []);

  // 2) Function to finalize Premium signup
  const finishPremiumSignup = async (userEmail, userPassword) => {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await axios.post(`${API_BASE_URL}/api/register`, {
        email: userEmail,
        password: userPassword,
        plan: "premium",
      });
      setSuccessMessage("Signup success! You are now Premium.");
      // Clear the local storage so we don't re-signup on refresh
      localStorage.removeItem("pendingSignupData");
      // Optionally, redirect to login after short delay
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  // 3) Handle the normal "Sign Up" button click
  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (password !== confirmPwd) {
      setError("Passwords do not match");
      return;
    }

    if (plan === "free") {
      // Immediately register user as free
      try {
        setIsLoading(true);
        const response = await axios.post(`${API_BASE_URL}/api/register`, {
          email,
          password,
          plan: "free",
        });
        setSuccessMessage(response.data.message || "Signup success!");
        // After short delay, go to Login
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      } catch (err) {
        setError(err.response?.data?.error || "Signup failed");
      } finally {
        setIsLoading(false);
      }
    } else {
      // plan === "premium" -> run Stripe checkout first
      startPremiumCheckout();
    }
  };

  // 4) Start Premium checkout: store user data, create Stripe session, redirect
  const startPremiumCheckout = async () => {
    setIsLoading(true);
    // Save the user data so we can do final registration after successful payment
    localStorage.setItem(
      "pendingSignupData",
      JSON.stringify({ email, password })
    );
    try {
      // Create a special checkout session with success/cancel pointing to /signup
      const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // You can pass different success/cancel URLs if needed
          success_url: "http://www.viserra-group.com/signup?status=success",
          cancel_url: "http://www.viserra-group.com/signup?status=cancel",
        }),
      });
      const data = await response.json();
      if (data.url) {
        // Redirect to Stripe
        window.location.href = data.url;
      } else {
        setError("Unable to create Stripe session. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Checkout error. Please try again.");
      setIsLoading(false);
    }
  };

  // OPTIONAL: Make .App background transparent so blur is visible
  useEffect(() => {
    const appDiv = document.querySelector(".App");
    if (appDiv) {
      appDiv.style.background = "transparent";
      appDiv.style.boxShadow = "none";
      appDiv.style.margin = "0";
      appDiv.style.padding = "0";
    }
    return () => {
      if (appDiv) {
        appDiv.style.background = "white";
        appDiv.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.1)";
        appDiv.style.margin = "40px auto";
        appDiv.style.padding = "30px";
      }
    };
  }, []);

  return (
    <>
      <Header />

      {/* Full-page overlay with blur */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 9999,
          overflowY: "auto", // so we can scroll if form is too tall
        }}
        onClick={() => navigate("/")}
      >
        {/* White box (stopPropagation so clicks inside won't go home) */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "clamp(320px, 40%, 600px)",
            backgroundColor: "#fff",
            margin: "2rem auto 4rem auto", // extra bottom margin
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "center",
            padding: "3rem",
            maxHeight: "90vh",     // doesn't extend all the way down
            overflowY: "auto",     // if content is taller, scroll
          }}
        >
          <form
            onSubmit={handleSignup}
            style={{
              width: "100%",
              maxWidth: "500px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2
              style={{
                marginBottom: "1rem",
                fontSize: "1.8rem",
                color: "#333",
              }}
            >
              Create your account
            </h2>

            <p style={{ color: "#666", marginBottom: "1.5rem" }}>
              Join Viserra Analytics today.
            </p>

            <label
              style={{
                marginBottom: "0.3rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                marginBottom: "1rem",
                padding: "0.6rem 0.9rem",
                fontSize: "1rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />

            <label
              style={{
                marginBottom: "0.3rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="Choose a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                marginBottom: "1rem",
                padding: "0.6rem 0.9rem",
                fontSize: "1rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />

            <label
              style={{
                marginBottom: "0.3rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
              style={{
                marginBottom: "1rem",
                padding: "0.6rem 0.9rem",
                fontSize: "1rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />

            <label
              style={{
                marginBottom: "0.5rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              Choose Your Plan
            </label>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                marginBottom: "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  flex: "1 1 45%",
                  border:
                    plan === "free"
                      ? "2px solid #5A153D"
                      : "2px solid #ccc",
                  borderRadius: "8px",
                  padding: "1rem",
                  cursor: "pointer",
                  transition: "border-color 0.3s ease",
                }}
                onClick={() => setPlan("free")}
              >
                <input
                  type="radio"
                  name="plan"
                  value="free"
                  checked={plan === "free"}
                  onChange={() => setPlan("free")}
                  style={{ marginRight: "0.5rem" }}
                />
                <strong>Free</strong>
                <p
                  style={{
                    marginTop: "0.5rem",
                    color: "#666",
                    fontSize: "0.9rem",
                  }}
                >
                  Basic REIT screening <br />
                  Access limited data
                </p>
              </div>

              <div
                style={{
                  flex: "1 1 45%",
                  border:
                    plan === "premium"
                      ? "2px solid #5A153D"
                      : "2px solid #ccc",
                  borderRadius: "8px",
                  padding: "1rem",
                  cursor: "pointer",
                  transition: "border-color 0.3s ease",
                }}
                onClick={() => setPlan("premium")}
              >
                <input
                  type="radio"
                  name="plan"
                  value="premium"
                  checked={plan === "premium"}
                  onChange={() => setPlan("premium")}
                  style={{ marginRight: "0.5rem" }}
                />
                <strong>Premium</strong>
                <p
                  style={{
                    marginTop: "0.5rem",
                    color: "#666",
                    fontSize: "0.9rem",
                  }}
                >
                  Advanced screening <br />
                  Full data and analysis <br />
                  Only $5/month
                </p>
              </div>
            </div>

            {/* Display error or success */}
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
            {successMessage && (
              <div
                style={{
                  color: "green",
                  marginBottom: "1rem",
                  fontWeight: "bold",
                }}
              >
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#5A153D",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "1rem",
                cursor: "pointer",
                marginTop: "0.5rem",
              }}
            >
              {isLoading ? "Processing..." : "Sign Up"}
            </button>

            {/* Return Home button */}
            <button
              type="button"
              onClick={() => navigate("/")}
              style={{
                marginTop: "1rem",
                padding: "0.6rem 1rem",
                backgroundColor: "#ddd",
                color: "#333",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Return Home
            </button>

            <div
              style={{
                marginTop: "1.5rem",
                fontSize: "0.9rem",
                textAlign: "center",
                color: "#333",
              }}
            >
              Already have an account?{" "}
              <span
                style={{
                  color: "#5A153D",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
                onClick={() => navigate("/login")}
              >
                Sign In
              </span>
            </div>
          </form>
        </div>
      </div>

      <BottomBanner />
    </>
  );
};

export default Signup;
