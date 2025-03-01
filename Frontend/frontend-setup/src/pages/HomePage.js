import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Load backend URL from environment variable
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function HomePage() {
  const navigate = useNavigate();

  // State for showing the overlay
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  // State for the user's search input
  const [searchQuery, setSearchQuery] = useState("");
  // State for the real-time suggestions
  const [suggestions, setSuggestions] = useState([]);

  // Show the overlay
  const handleSearchClick = () => {
    setShowSearchOverlay(true);
  };

  // Close the overlay
  const handleCloseSearch = () => {
    setShowSearchOverlay(false);
    setSearchQuery("");
    setSuggestions([]);
  };

  // Navigate to the detail page for a selected ticker
  const handleSelect = (ticker) => {
    setShowSearchOverlay(false);
    setSearchQuery("");
    setSuggestions([]);
    navigate(`/reits/${ticker}`);
  };

  // Fetch suggestions whenever searchQuery changes
  useEffect(() => {
    // If the search box is empty, clear suggestions
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }

    // Otherwise, call the backend with `search=...`
    const fetchSuggestions = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/reits`, {
          params: { search: searchQuery },
        });
        // Expecting { reits: [...] } in response
        if (response.data && response.data.reits) {
          setSuggestions(response.data.reits);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [searchQuery]);

  return (
    <div
      className="home"
      style={{
        textAlign: "center",
        fontFamily: "Arial, sans-serif"
      }}
    >
      {/* Navigation Bar */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "15px 50px",
          backgroundColor: "#fff",
          color: "#333",
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)"
        }}
      >
        <img
          src="/logo-crop.PNG"
          alt="Viserra Logo"
          style={{ maxHeight: "90px", cursor: "pointer" }}
          onClick={() => navigate("/")}
        />
        <div>
          <button className="nav-button" onClick={() => navigate("/filter")}>
            REITs Screening
          </button>
          <button className="nav-button" onClick={handleSearchClick}>
            Search for a REIT
          </button>
          <button className="nav-button">About Us</button>
          <button className="nav-button">Pricing</button>
          <button className="nav-button">Services</button>
        </div>
      </nav>

      {/* Hero Section */}
      <div
        style={{
          backgroundImage: "url('/banner.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          padding: "80px 20px",
          color: "#333"
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
          Access in-depth REIT analytics and make data-driven investment decisions
          with confidence.
        </p>
      </div>

      {/* Full-Screen Search Overlay */}
      {showSearchOverlay && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "2rem",
              borderRadius: "8px",
              width: "80%",
              maxWidth: "600px",
              position: "relative"
            }}
          >
            <h2 style={{ marginBottom: "1rem" }}>Search for a REIT</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type REIT ticker or name..."
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "1rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                marginBottom: "1rem"
              }}
            />

            {/* Real-time suggestions list */}
            {suggestions.length > 0 && (
              <ul
                style={{
                  listStyleType: "none",
                  margin: 0,
                  padding: 0,
                  backgroundColor: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  textAlign: "left"
                }}
              >
                {suggestions.map((reit) => (
                  <li
                    key={reit.Ticker}
                    onClick={() => handleSelect(reit.Ticker)}
                    style={{
                      padding: "8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #ccc"
                    }}
                  >
                    <strong>{reit.Ticker}</strong>
                    {reit.Company_Name ? ` - ${reit.Company_Name}` : ""}
                  </li>
                ))}
              </ul>
            )}

            <div style={{ marginTop: "1rem" }}>
              <button
                onClick={() => {
                  console.log("Searching for:", searchQuery);
                  // Optionally do a final search or redirect
                }}
                style={{
                  backgroundColor: "#007bff",
                  color: "#fff",
                  border: "none",
                  padding: "0.75rem 1.5rem",
                  fontSize: "1rem",
                  borderRadius: "4px",
                  marginRight: "1rem",
                  cursor: "pointer"
                }}
              >
                Search
              </button>

              <button
                onClick={handleCloseSearch}
                style={{
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  border: "none",
                  padding: "0.75rem 1.5rem",
                  fontSize: "1rem",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
