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

      {/* Main Content Container */}
      <div className="home" style={{ textAlign: "center", fontFamily: "Arial, sans-serif" }}>
        
        {/* Hero Section */}
        <div
          style={{
            backgroundImage: "url('/banner.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            padding: "80px 20px",
            color: "#333",
            position: "relative",
          }}
        >
          {/* A slight overlay to darken the background image and make text more readable */}
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              padding: "40px 20px",
              borderRadius: "8px",
              maxWidth: "700px",
              margin: "0 auto",
            }}
          >
            <h1 style={{ fontSize: "2.4rem", color: "#5A153D", marginBottom: "10px" }}>
              Welcome to Viserra
            </h1>
            <p style={{ fontSize: "1.2rem", lineHeight: "1.6", color: "#444", margin: "0 auto" }}>
              Your gateway to smarter real estate investing. Track and compare public REITs, 
              explore crowdfunding opportunities, and unlock powerful analytics — all in one place.
            </p>
            {/* Example "Learn More" button if you want a direct CTA */}
            <button
              onClick={() => navigate("/filter")}
              style={{
                marginTop: "20px",
                backgroundColor: "#5A153D",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                padding: "10px 50px",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Explore REITs
            </button>
          </div>
        </div>

        {/* Email Signup Section */}
        <div
          style={{
            backgroundColor: "#f9f9f9",
            padding: "20px 20px",
            marginTop: "0px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#333" }}>
            🚀 Join Our Early Access List
          </h2>
          
          <p style={{ maxWidth: "600px", margin: "10px auto", fontSize: "1.2rem", color: "#444", lineHeight: "1.6" }}>
            Viserra is an early-stage fintech startup. We are building a platform that tracks and
            analyzes the performance of public REITs and real estate crowdfunding vehicles.
          </p>

          <p style={{ maxWidth: "600px", margin: "20px auto", fontSize: "1.2rem", color: "#444", lineHeight: "1.6" }}>
            Sign up below for exclusive updates and enjoy a <strong>30% discount</strong> when we launch!
          </p>

          {/* Sign-Up Form */}
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
                }}
              />

              {/* Interest Selection */}
              <p style={{ marginTop: "10px", fontSize: "1.2rem", color: "#555" }}>What are you interested in?</p>
              <select 
                value={interest} 
                onChange={(e) => setInterest(e.target.value)}
                required
                style={{ padding: "8px", borderRadius: "5px", width: "200px", marginBottom: "10px" }}
              >
                <option value="">Select...</option>
                <option value="REITs">REITs</option>
                <option value="Crowdfunding">Real Estate Crowdfunding</option>
                <option value="Both">Both</option>
              </select>

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
            <p style={{ color: "#5A153D", fontWeight: "bold", marginTop: "20px", fontSize: "1.2rem" }}>
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
              You’ve successfully joined our early access list. We’ll keep you up to date on our progress.
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
