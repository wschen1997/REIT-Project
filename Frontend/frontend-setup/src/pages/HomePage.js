import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js"; // <-- Added import for Loading

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function HomePage() {
  const navigate = useNavigate();

  // Form State
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [interest, setInterest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false); // Controls popup visibility
  const [isLoading, setIsLoading] = useState(false); // <-- Added loading state

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!interest) {
      alert("Please select your investment interest before submitting.");
      return;
    }

    setIsLoading(true); // <-- Show Loading before fetch

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
    } finally {
      setIsLoading(false); // <-- Hide Loading after fetch completes
    }
  };

  // REIT card => open search overlay
  const handleReitClick = () => {
    window.dispatchEvent(new Event("openSearchOverlay"));
  };

  // Crowdfunding card => navigate
  const handleCrowdfundingClick = () => {
    navigate("/Crowdfunding");
  };

  const featureBoxStyle = {
    cursor: "pointer",
    backgroundColor: "#fff",
    borderRadius: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    width: "320px",
    padding: "16px",
    textAlign: "left",
    transition: "background-color 0.2s, transform 0.2s",
  };

  // A single style object for all form controls so they line up identically
  const commonFormControlStyle = {
    width: "600px",
    height: "45px",
    boxSizing: "border-box",
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "5px",
    fontSize: "1rem",
    fontFamily: "inherit",
  };

  return (
    <>
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
            margin: "80px auto",
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
            style={{ width: "100%", maxWidth: "1100px" }}
          />
        </div>

        {/* FEATURES SECTION */}
        <div
          style={{
            textAlign: "center",
            margin: "150px auto",
            maxWidth: "1200px",
            padding: "0 20px",
          }}
        >
          <h2 style={{ fontSize: "2rem", color: "#5A153D", marginBottom: "50px" }}>
            Powerful Analytics for Real Estate Investors
          </h2>

          <div
            style={{
              display: "flex",
              gap: "40px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {/* REIT BOX */}
            <div
              onClick={handleReitClick}
              style={featureBoxStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#faf0fb";
                e.currentTarget.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <img
                src="/REIT.png"
                alt="REIT Feature"
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              />
              <h3 style={{ fontSize: "1.3rem", marginBottom: "10px", color: "#5A153D" }}>
                REIT Analytics
              </h3>
              <p style={{ fontSize: "0.95rem", color: "#444", lineHeight: "1.5" }}>
                Gain insights into publicly traded REITs with live pricing,
                fundamental data, and advanced screening tools. 
                Quickly search and compare your target tickers.
              </p>
            </div>

            {/* CROWDFUNDING BOX */}
            <div
              onClick={handleCrowdfundingClick}
              style={featureBoxStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#faf0fb";
                e.currentTarget.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <img
                src="/Crowdfunding.png"
                alt="Crowdfunding Feature"
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              />
              <h3 style={{ fontSize: "1.3rem", marginBottom: "10px", color: "#5A153D" }}>
                Crowdfunding Insights
              </h3>
              <p style={{ fontSize: "0.95rem", color: "#444", lineHeight: "1.5" }}>
                Explore top real estate crowdfunding deals, with standardized metrics
                including total return, distribution yield, and NAV growth. 
                Compare different platforms for your next investment.
              </p>
            </div>
          </div>
        </div>

        {/* SIGNUP SECTION */}
        <div
          style={{
            textAlign: "center",
            margin: "80px auto",
            maxWidth: "1200px",
            padding: "0 20px",
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
            Join Our Early Access List
          </h2>
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
            <strong>30% discount</strong> when we officially launch!
          </p>

          {/* SIGN-UP FORM */}
          {!submitted ? (
            <form
              onSubmit={handleSubmit}
              style={{
                marginTop: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "15px",
              }}
            >
              {/* Email Input */}
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  ...commonFormControlStyle,
                }}
              />

              {/* Interest Selection */}
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                required
                style={{
                  ...commonFormControlStyle,
                  textAlignLast: "left",
                }}
              >
                <option value="">What are you interested in?</option>
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
                  ...commonFormControlStyle,
                  boxSizing: "border-box",
                  padding: "10px",
                  height: "100px",
                  resize: "vertical",
                  marginTop: "-10px",
                  marginBottom: "5px",
                }}
              />

              {/* Submit Button */}
              <button
                type="submit"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#faf0fb";
                  e.currentTarget.style.color = "#5A153D";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#5A153D";
                  e.currentTarget.style.color = "#fff";
                }}
                style={{
                  ...commonFormControlStyle,
                  backgroundColor: "#5A153D",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#faf0fb";
                e.currentTarget.style.color = "#5A153D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#5A153D";
                e.currentTarget.style.color = "#fff";
              }}
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

      {/* Show Loading overlay if isLoading is true */}
      {isLoading && <Loading />}

      {/* The new bottom banner that slides up at scroll-bottom */}
      <BottomBanner />
    </>
  );
}

export default HomePage;
