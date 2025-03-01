import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.js"; // Import Header.js

function HomePage() {
  const navigate = useNavigate();

  return (
    <>
      {/* Reusable Header Component */}
      <Header />

      {/* Main Content Container */}
      <div 
        className="home" 
        style={{ 
          textAlign: "center", 
          fontFamily: "Arial, sans-serif", 
          paddingTop: "20px" // Additional spacing for better UI
        }}
      >
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
          <h1 style={{ fontSize: "2.5rem", marginBottom: "10px" }}>
            Your All-in-One Tool for Smarter REIT Investing
          </h1>
          <p 
            style={{ 
              fontSize: "1.2rem", 
              maxWidth: "600px", 
              margin: "0 auto", 
              lineHeight: "1.5" 
            }}
          >
            Access in-depth REIT analytics and make data-driven investment decisions with confidence.
          </p>
        </div>
      </div>
    </>
  );
}

export default HomePage;
