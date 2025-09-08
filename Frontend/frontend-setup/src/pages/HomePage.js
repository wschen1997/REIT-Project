import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js";
import PopupModal from "../components/PopupModal.js"; // --- 1. IMPORT the new component

const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function HomePage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [interest, setInterest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(""); 

    if (!interest) {
      alert("Please select your investment interest before submitting.");
      return;
    }

    setIsLoading(true);

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
        setShowPopup(true);
      } else {
        const message = result.message || "The email address is invalid or has already been used.";
        setErrorMessage(message);
        console.error("Failed to submit data:", result);
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred. Please try again.");
      console.error("Error submitting form:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
      <div className="home" style={{ fontFamily: "Arial, sans-serif" }}>
        {/* --- HERO AND POWERED BY SECTIONS (Unchanged) --- */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "60px 40px", maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ flex: "1", marginRight: "40px" }}>
            <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "20px", lineHeight: "1.2", color: "#5A153D" }}>
              EMPOWER YOUR<br />REAL ESTATE INVESTING<br />WITH VISERRA.
            </h1>
            <p style={{ fontSize: "1.2rem", color: "#444", marginBottom: "30px" }}>
              Track and compare public REITs, explore fundamental insights, and unlock powerful AI analytics — all in one place.
            </p>
          </div>
          <div style={{ flex: "1", textAlign: "right" }}>
            <img src="/Dashboard.png" alt="Viserra Dashboard" style={{ width: "100%", maxWidth: "500px", borderRadius: "8px" }} />
          </div>
        </div>
        <div style={{ textAlign: "center", margin: "40px auto", maxWidth: "1200px", padding: "0 20px", marginBottom: "100px" }}>
          <h3 style={{ fontSize: "2rem", color: "#5A153D", marginBottom: "40px" }}>Powered by</h3>
          <img src="/Powered By.png" alt="Powered by data providers" style={{ width: "100%", maxWidth: "1100px" }} />
        </div>

        {/* --- EARLY ACCESS FORM (Unchanged) --- */}
        <div style={{ textAlign: "center", margin: "80px auto", maxWidth: "1200px", padding: "0 20px" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: "bold", color: "#5A153D", marginBottom: "20px" }}>
            Join Our Early Access List!
          </h2>
          <p style={{ maxWidth: "600px", margin: "0 auto", fontSize: "1.2rem", color: "#444", lineHeight: "1.6", marginBottom: "20px" }}></p>
          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ marginTop: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "15px" }}>
              <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ ...commonFormControlStyle }} />
              <select value={interest} onChange={(e) => setInterest(e.target.value)} required style={{ ...commonFormControlStyle, textAlignLast: "left" }}>
                <option value="">What are you interested in?</option>
                <option value="REITs">REITs</option>
                <option value="Crowdfunding">Real Estate Crowdfunding</option>
                <option value="Both">Both</option>
              </select>
              <textarea placeholder="Any feedback or features you'd love to see?" value={feedback} onChange={(e) => setFeedback(e.target.value)} style={{ ...commonFormControlStyle, boxSizing: "border-box", padding: "10px", height: "100px", resize: "vertical", marginTop: "-10px", marginBottom: "5px" }} />
              {errorMessage && <p className="error-message" style={{ margin: "-5px 0 0 0", textAlign: "center" }}>{errorMessage}</p>}
              <button type="submit" onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#faf0fb"; e.currentTarget.style.color = "#5A153D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#5A153D"; e.currentTarget.style.color = "#fff"; }} style={{ ...commonFormControlStyle, backgroundColor: "#5A153D", color: "#fff", border: "none", cursor: "pointer" }}>
                Sign Up
              </button>
            </form>
          ) : (
            <p style={{ color: "#5A153D", fontWeight: "bold", marginTop: "20px", fontSize: "1.2rem" }}>
              Thank you for signing up! We’ll be in touch soon.
            </p>
          )}
        </div>

        {/* --- 2. USE the new component. --- */}
        {/* The old, large block of JSX for the modal is gone. */}
        <PopupModal
          show={showPopup}
          onClose={() => setShowPopup(false)}
          title="Thank You!"
        >
          <p>
            You’ve successfully joined our early access list. We’ll keep you up
            to date on our progress.
          </p>
        </PopupModal>

        {isLoading && <Loading />}
      </div>
      <BottomBanner />
    </>
  );
}

export default HomePage;
