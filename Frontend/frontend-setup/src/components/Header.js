import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const Header = () => {
  const navigate = useNavigate();

  // Search overlay
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  // REIT analytics dropdown
  const [showAnalyticsDropdown, setShowAnalyticsDropdown] = useState(false);

  // NEW: track logged-in username
  const [username, setUsername] = useState(null);

  // On mount, decode token if present
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwt_decode(token);
        // The backend includes "username" in the token
        if (decoded.username) {
          setUsername(decoded.username);
        }
      } catch (err) {
        console.error("Invalid token:", err);
      }
    }
  }, []);

  // Listen for custom event from HomePage's REIT card
  useEffect(() => {
    const handleOpenOverlay = () => {
      setShowSearchOverlay(true);
    };
    window.addEventListener("openSearchOverlay", handleOpenOverlay);

    return () => {
      window.removeEventListener("openSearchOverlay", handleOpenOverlay);
    };
  }, []);

  // Open search overlay
  const handleSearchClick = () => {
    setShowSearchOverlay(true);
  };

  // Close search overlay
  const handleCloseSearch = () => {
    setShowSearchOverlay(false);
    setSearchQuery("");
    setSuggestions([]);
  };

  // Navigate to a REIT detail page
  const handleSelect = (ticker) => {
    setShowSearchOverlay(false);
    setSearchQuery("");
    setSuggestions([]);
    navigate(`/reits/${ticker}`);
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("token");
    setUsername(null);
    navigate("/");
  };

  // Fetch search suggestions
  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      setIsFetching(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/reits`, {
          params: { search: searchQuery },
        });
        setSuggestions(response.data?.reits || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsFetching(false);
      }
    };
    fetchSuggestions();
  }, [searchQuery]);

  return (
    <>
      {/* Navigation Bar */}
      <nav
        style={{
          position: "fixed",
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
          zIndex: 1000,
        }}
      >
        <img
          src="/logo-crop.PNG"
          alt="Viserra Logo"
          style={{ maxHeight: "90px", cursor: "pointer" }}
          onClick={() => navigate("/")}
        />

        <div
          style={{
            display: "flex",
            gap: "25px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-end",
            marginRight: "80px",
          }}
        >
          {/* "REITs Analytics" menu with dropdown */}
          <div
            className="nav-link dropdown-trigger"
            onMouseEnter={() => setShowAnalyticsDropdown(true)}
            onMouseLeave={() => setShowAnalyticsDropdown(false)}
            style={{ cursor: "pointer" }}
          >
            REITs Analytics
            <div
              className={`dropdown-menu ${showAnalyticsDropdown ? "show" : ""}`}
            >
              <div
                className="dropdown-item"
                onClick={() => {
                  handleSearchClick();
                  setShowAnalyticsDropdown(false);
                }}
              >
                Search for a REIT
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  navigate("/filter");
                  setShowAnalyticsDropdown(false);
                }}
              >
                REITs Screening
              </div>
            </div>
          </div>

          {/* Crowdfunding link */}
          <div
            className="nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/Crowdfunding")}
          >
            Real Estate Crowdfundings
          </div>

          {/* Pricing link */}
          <div
            className="nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/pricing")}
          >
            Pricing
          </div>

          {/* About Us link */}
          <div
            className="nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/about")}
          >
            About Us
          </div>

          {/* Contact Us link */}
          <div
            className="nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/contact")}
          >
            Contact Us
          </div>

          {/* If user is logged in => show username & logout;
              else show "Login" button */}
          {username ? (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "1rem", fontWeight: "bold" }}>
                Hello, {username}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: "8px 16px",
                  fontSize: "1rem",
                  border: "2px solid #B12D78",
                  color: "#fff",
                  backgroundColor: "#B12D78",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <div style={{ marginLeft: "10px" }}>
              <button
                onClick={() => navigate("/login")}
                style={{
                  padding: "8px 16px",
                  fontSize: "1rem",
                  border: "2px solid #5A153D",
                  color: "#5A153D",
                  backgroundColor: "transparent",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "#fcebf4")
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = "transparent")
                }
              >
                Login
              </button>
            </div>
          )}
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
          {/* Centered box */}
          <div
            style={{
              backgroundColor: "#fff",
              width: "clamp(400px, 80%, 600px)",
              margin: "0 auto",
              padding: "2rem 2.5rem",
              borderRadius: "8px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <h2 style={{ marginBottom: "1rem" }}>Search for a REIT</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type REIT ticker..."
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "1rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                marginBottom: "1rem",
              }}
            />
            {isFetching && (
              <p style={{ fontSize: "0.9rem", color: "#555" }}>Loading...</p>
            )}
            {!isFetching && (
              <>
                {suggestions.length > 0 ? (
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
                      width: "100%",
                    }}
                  >
                    {suggestions.map((reit) => (
                      <li
                        key={reit.Ticker}
                        onClick={() => {
                          handleSelect(reit.Ticker);
                        }}
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
                ) : (
                  searchQuery.length > 0 && (
                    <div
                      style={{
                        backgroundColor: "#fff",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        padding: "1rem",
                        color: "#333",
                        textAlign: "left",
                        maxHeight: "200px",
                        overflowY: "auto",
                        width: "100%",
                      }}
                    >
                      <p style={{ margin: 0 }}>
                        No REIT found for "<strong>{searchQuery}</strong>".
                        Please try another ticker or name.
                      </p>
                    </div>
                  )
                )}
              </>
            )}
            <div style={{ marginTop: "1rem", alignSelf: "flex-start" }}>
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
