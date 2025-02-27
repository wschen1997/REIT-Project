import React from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="home" style={{ textAlign: "center", padding: "40px" }}>
      {/* Logo with increased size and spacing */}
      <img
        src="/logo-crop.png"
        alt="Viserra Logo"
        style={{
          maxWidth: "300px", // Increase size
          height: "auto", // More spacing
          marginBottom: "0.1px",
        }}
      />

      <h1>Your All-in-One Tool for Smarter REITs Investing</h1>
      <p>Find the best REITs based on your preferences.</p>

      <button className="start-button" onClick={() => navigate("/filter")}>
        REIT Screener
      </button>
    </div>
  );
}

export default HomePage;
