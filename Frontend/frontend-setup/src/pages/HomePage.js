import React from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="home" style={{ textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      
      {/* Navigation Bar */}
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "15px 50px", backgroundColor: "#fff", color: "#333",
        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)"
      }}>
        <img
          src="/logo-crop.PNG"
          alt="Viserra Logo"
          style={{ maxHeight: "90px", cursor: "pointer" }}
          onClick={() => navigate("/")}
        />
        <div>
          <button className="nav-button" onClick={() => navigate("/filter")}>Equity Screening</button>
          <button className="nav-button">Serch for an Investment</button>
          <button className="nav-button">About Us</button>
          <button className="nav-button">Pricing</button>
          <button className="nav-button">Services</button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{
        backgroundImage: "url('/banner.jpg')", backgroundSize: "cover",
        backgroundPosition: "center", padding: "80px 20px", color: "#333"
      }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "10px" }}>Your All-in-One Tool for Smarter REIT Investing</h1>
        <p style={{ fontSize: "1.2rem", maxWidth: "600px", margin: "0 auto", lineHeight: "1.5" }}>
          Access in-depth REIT analytics and make data-driven investment decisions with confidence.
        </p>
      </div>
      
    </div>
  );
}

export default HomePage;
