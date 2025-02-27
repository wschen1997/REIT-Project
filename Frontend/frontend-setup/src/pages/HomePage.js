import React from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="home" style={{ textAlign: "center", padding: "40px" }}>
      {/* Logo with increased size and spacing */}
      <img
        src="/logo-crop.PNG"
        alt="Viserra Logo"
        style={{
          maxWidth: "300px", // Increase size
          height: "auto", 
          marginBottom: "0.1px", // spacing
        }}
      />

      <h2>Your All-in-One Tool for Smarter REITs Investing</h2>
      <p>Access our REITs analytics platform and make data-driven decisions with confidence.</p>

      <button className="start-button" onClick={() => navigate("/filter")}>
        Search for a REIT
      </button>
    </div>
  );
}

export default HomePage;
