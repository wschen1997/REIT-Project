import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const Header = () => {
  const navigate = useNavigate();

  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const handleSearchClick = () => {
    setShowSearchOverlay(true);
  };

  const handleCloseSearch = () => {
    setShowSearchOverlay(false);
    setSearchQuery("");
    setSuggestions([]);
  };

  const handleSelect = (ticker) => {
    setShowSearchOverlay(false);
    setSearchQuery("");
    setSuggestions([]);
    navigate(`/reits/${ticker}`);
  };

  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/reits`, {
          params: { search: searchQuery },
        });
        setSuggestions(response.data?.reits || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [searchQuery]);

  return (
    <>
      {/* Navigation Bar */}
      <nav
        style={{
        position: "fixed",  /* Keep it fixed at the top */
        top: 0,
        left: 0,
        width: "100%",
        height: "80px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "15px 20px",
        backgroundColor: "#fff",
        color: "#333",
        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
        zIndex: 1000, /* Ensures header stays on top */
        overflowX: "hidden",
        }}
      >
        <img
          src="/logo-crop.PNG"
          alt="Viserra Logo"
          style={{ maxHeight: "90px", cursor: "pointer" }}
          onClick={() => navigate("/")}
        />
        <div style={{ display: "flex", gap: "25px", flexWrap: "wrap", justifyContent: "flex-end", marginRight: "40px" }}>
          <div className="nav-link" onClick={() => navigate("/filter")}>REITs Screening</div>
          <span className="nav-link" onClick={handleSearchClick}>Search for a REIT</span>
          <div className="nav-link" onClick={() => navigate("/about us")}>About Us</div>
          <div className="nav-link" onClick={() => navigate("/solutions")}>Solutions</div>
          <div className="nav-link" onClick={() => navigate("/pricing")}>Pricing</div>
          <div className="nav-link" onClick={() => navigate("/contact us")}>Contact Us</div>
        </div>
      </nav>

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
            alignItems: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "2rem",
              borderRadius: "8px",
              width: "80%",
              maxWidth: "600px",
              position: "relative",
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
                marginBottom: "1rem",
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
                  textAlign: "left",
                }}
              >
                {suggestions.map((reit) => (
                  <li
                    key={reit.Ticker}
                    onClick={() => handleSelect(reit.Ticker)}
                    style={{
                      padding: "8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #ccc",
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
                onClick={() => console.log("Searching for:", searchQuery)}
                style={{
                  backgroundColor: "#5A153D",
                  color: "#fff",
                  border: "none",
                  padding: "0.75rem 1.5rem",
                  fontSize: "1rem",
                  borderRadius: "4px",
                  marginRight: "1rem",
                  cursor: "pointer",
                }}
              >
                Search
              </button>

              <button
                onClick={handleCloseSearch}
                style={{
                  backgroundColor: "#B12D78",
                  color: "#fff",
                  border: "none",
                  padding: "0.75rem 1.5rem",
                  fontSize: "1rem",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
