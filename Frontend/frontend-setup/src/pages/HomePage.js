import React, { useState, useContext } from "react"; // 1. Import useContext
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext.js"; // 2. Import your ThemeContext
import { useLoading } from "../context/LoadingContext.js"; 
import PopupModal from "../components/PopupModal.js";

const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function HomePage() {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext); // 3. Get the current theme from context

  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [interest, setInterest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const { setLoading: setIsLoading } = useLoading();
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

  return (
    <>
      <style>
        {`
          .marquee-container {
            width: 100%;
            overflow: hidden;
            box-sizing: border-box;
          }
          .marquee-content {
            display: flex;
            width: 200%;
            animation: scroll 30s linear infinite;
          }
          .marquee-content img {
            width: 50%;
            flex-shrink: 0;
          }
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}
      </style>

      <div className="home">
        {/* --- HERO SECTION --- */}
        <div className="hero-section-home">
          <div className="hero-content-home">
            <div className="hero-text-home">
              <h1 className="hero-title-home">
                EMPOWER YOUR<br />REAL ESTATE INVESTING<br />WITH <span className="highlight">VISERRA.</span>
              </h1>
              <p className="hero-subtitle-home">
                Track and compare public REITs, explore fundamental insights, and unlock powerful AI analytics — all in one place.
              </p>
            </div>
            <div className="hero-image-container-home">
              {/* 4. Use a ternary operator to dynamically set the image source */}
              <img 
                src={theme === 'dark' ? '/Dashboard-Dark.png' : '/Dashboard.png'} 
                alt="Viserra Dashboard" 
                className="hero-image-home" 
              />
            </div>
          </div>
        </div>
        
        {/* --- POWERED BY SECTION --- */}
        <div className="powered-by-section">
          <div className="marquee-container">
            <div className="marquee-content">
              <img src="/Powered By.png" alt="Powered by data providers" className="powered-by-logos" />
              <img src="/Powered By.png" alt="Powered by data providers" className="powered-by-logos" />
            </div>
          </div>
          <p className="powered-by-text">
            Powered by world class fintech, proptech, and AI companies
          </p>
        </div>

        {/* --- EARLY ACCESS FORM --- */}
        <div className="early-access-section">
          <h2 className="early-access-title">
            Join Our Early Access List!
          </h2>

          <p 
            className="early-access-subtitle"
            style={{ 
              textAlign: 'center', 
              maxWidth: 'none', 
              margin: '0 0 30px 0' 
            }}
          >
            Viserra is an early-stage fintech startup with a goal to provide top-tier, AI-driven investment analytics backed by proprietary financial data. While we're still in the development stage, we would love to hear your feedback on what features would be most valuable to you.
          </p>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="early-access-form">
              <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field home-form-input" />
              
              <select value={interest} onChange={(e) => setInterest(e.target.value)} required className="input-field home-form-input home-select-input">
                <option value="">What are you interested in?</option>
                <option value="REITs">REITs</option>
                <option value="Crowdfunding">Real Estate Crowdfunding</option>
                <option value="Equities">General Equities</option>
                <option value="Others">Other Financial Products</option>
              </select>

              <textarea placeholder="Any feedback or features you'd love to see?" value={feedback} onChange={(e) => setFeedback(e.target.value)} className="input-field home-form-input home-textarea-input" />
              
              {errorMessage && <p className="error-message home-error-message">{errorMessage}</p>}
              
              <button type="submit" className="btn btn-primary home-form-button">
                Sign Up
              </button>
            </form>
          ) : (
            <p className="signup-success-message">
              Thank you for signing up! We’ll be in touch soon.
            </p>
          )}
        </div>

        <PopupModal show={showPopup} onClose={() => setShowPopup(false)} title="Thank You!">
          <p>You’ve successfully joined our early access list. We’ll keep you up to date on our progress.</p>
        </PopupModal>


      </div>
    </>
  );
}

export default HomePage;