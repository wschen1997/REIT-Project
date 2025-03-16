import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function HomePage() {
  const navigate = useNavigate();

  // Form State
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [interest, setInterest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false); // Controls popup visibility

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!interest) {
      alert("Please select your investment interest before submitting.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, feedback, interest }),
      });

      const result = await response.json();
      console.log("Server response:", result);

      if (response.ok) {
        setSubmitted(true);
        setShowPopup(true); // Show popup after successful submission
      } else {
        console.error("Failed to submit data:", result);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <>
      {/* Reusable Header Component */}
      <Header />

      {/* MAIN CONTAINER */}
      <div className="home" style={{ fontFamily: "Arial, sans-serif" }}>
        {/* HERO SECTION */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "60px 40px",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          {/* LEFT COLUMN: BIG TEXT */}
          <div style={{ flex: "1", marginRight: "40px" }}>
            <h1
              style={{
                fontSize: "3rem",
                fontWeight: "bold",
                marginBottom: "20px",
                lineHeight: "1.2",
                color: "#5A153D",
              }}
            >
              EMPOWER YOUR
              <br />
              REAL ESTATE INVESTING
              <br />
              WITH VISERRA.
            </h1>
            <p style={{ fontSize: "1.2rem", color: "#444", marginBottom: "30px" }}>
              Track and compare public REITs, explore crowdfunding opportunities,
              and unlock powerful analytics — all in one place.
            </p>
          </div>

          {/* RIGHT COLUMN: DASHBOARD IMAGE */}
          <div style={{ flex: "1", textAlign: "right" }}>
            <img
              src="/Dashboard.png"
              alt="Viserra Dashboard"
              style={{ width: "100%", maxWidth: "500px", borderRadius: "8px" }}
            />
          </div>
        </div>

        {/* POWERED BY SECTION */}
        <div
          style={{
            textAlign: "center",
            margin: "70px auto",
            maxWidth: "1200px",
            padding: "0 20px",
          }}
        >
          <h3 style={{ fontSize: "2rem", color: "#5A153D", marginBottom: "40px" }}>
            Powered by
          </h3>
          <img
            src="/Powered By.png"
            alt="Powered by data providers"
            style={{ width: "100%", maxWidth: "900px" }}
          />
        </div>

        {/* SIGNUP SECTION */}
        <div
          style={{
            padding: "40px 20px",
            maxWidth: "1200px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: "#5A153D",
              marginBottom: "20px",
            }}
          >
            🚀 Join Our Early Access List
          </h2>

          <p
            style={{
              maxWidth: "600px",
              margin: "0 auto",
              fontSize: "1.2rem",
              color: "#444",
              lineHeight: "1.6",
              marginBottom: "10px",
            }}
          >
            Viserra is an early-stage fintech startup. We’re building a platform
            that tracks and analyzes the performance of public REITs and real
            estate crowdfunding vehicles.
          </p>
          <p
            style={{
              maxWidth: "600px",
              margin: "0 auto",
              fontSize: "1.2rem",
              color: "#444",
              lineHeight: "1.6",
              marginBottom: "20px",
            }}
          >
            Sign up below for exclusive updates and enjoy a{" "}
            <strong>30% discount</strong> when we launch!
          </p>

          {/* SIGN-UP FORM */}
          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
              {/* Email Input */}
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  padding: "10px",
                  width: "280px",
                  border: "1px solid #ccc",
                  borderRadius: "5px",
                  marginBottom: "10px",
                  marginRight: "10px",
                }}
              />

              {/* Interest Selection */}
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                required
                style={{
                  padding: "8px",
                  borderRadius: "5px",
                  width: "200px",
                  marginBottom: "10px",
                  marginRight: "10px",
                }}
              >
                <option value="">What are you interested in?</option>
                <option value="REITs">REITs</option>
                <option value="Crowdfunding">Real Estate Crowdfunding</option>
                <option value="Both">Both</option>
              </select>

              <br />

              {/* Feedback */}
              <textarea
                placeholder="Any feedback or features you'd love to see?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                style={{
                  display: "block",
                  margin: "10px auto",
                  width: "300px",
                  height: "60px",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "5px",
                }}
              />

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  backgroundColor: "#5A153D",
                  color: "white",
                  padding: "10px 15px",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "5px",
                  marginTop: "10px",
                  fontSize: "1rem",
                }}
              >
                Sign Up
              </button>
            </form>
          ) : (
            <p
              style={{
                color: "#5A153D",
                fontWeight: "bold",
                marginTop: "20px",
                fontSize: "1.2rem",
              }}
            >
              Thank you for signing up! We’ll be in touch soon.
            </p>
          )}
        </div>
      </div>

      {/* POPUP MODAL */}
      {showPopup && (
        <div
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)", // Dim background
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "10px",
              textAlign: "center",
              width: "300px",
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ color: "#5A153D" }}>Thank You!</h3>
            <p style={{ color: "#333", fontSize: "1rem", lineHeight: "1.5" }}>
              You’ve successfully joined our early access list. We’ll keep you up
              to date on our progress.
            </p>
            <button
              onClick={() => setShowPopup(false)}
              style={{
                backgroundColor: "#5A153D",
                color: "white",
                padding: "8px 15px",
                border: "none",
                cursor: "pointer",
                borderRadius: "5px",
                marginTop: "10px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default HomePage;
