import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.js";

function HomePage() {
  const navigate = useNavigate();
  
  // Form State
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [interest, setInterest] = useState(""); // Interest selection
  const [submitted, setSubmitted] = useState(false);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Ensure interest is selected
    if (!interest) {
      alert("Please select your investment interest before submitting.");
      return;
    }

    // Send data to the backend
    try {
      const response = await fetch("http://127.0.0.1:5000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, feedback, interest }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        console.error("Failed to submit data");
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
      <div className="home" style={{ textAlign: "center", fontFamily: "Arial, sans-serif", paddingTop: "20px" }}>
        
        {/* Hero Section */}
        <div
          style={{
            backgroundImage: "url('/banner.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            padding: "80px 20px",
            color: "#333",
          }}
        >
        </div>

        {/* Email Signup Section */}
        <div style={{ backgroundColor: "#f9f9f9", padding: "20px 20px", marginTop: "5px", borderRadius: "8px" }}>
          <h2>🚀 Join Our Early Access List</h2>
          <p style={{ maxWidth: "500px", margin: "0 auto", fontSize: "1.2rem", color: "#555" }}>
            Viserra is an early-stage startup building a real estate investment analytics platform focusing on:
          </p>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li>REITs – Track and analyze public real estate investments.</li>
            <li>Real Estate Crowdfunding – Compare and evaluate private real estate opportunities.</li>
          </ul>
          <p style={{ maxWidth: "500px", margin: "0 auto", fontSize: "1.2rem", color: "#555" }}>
            Sign up below for exclusive updates and a 30% discount when we launch!
          </p>

          {/* Form */}
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
                  marginBottom: "10px"
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
                  borderRadius: "5px"
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
                  borderRadius: "5px"
                }}
              >
                Sign Up
              </button>
            </form>
          ) : (
            <p style={{ color: "#5A153D", fontWeight: "bold", marginTop: "20px" }}>
              ✅ Thanks for signing up! We’ll be in touch soon.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default HomePage;
