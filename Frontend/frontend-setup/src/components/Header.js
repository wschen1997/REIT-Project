import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const Header = () => {
  const navigate = useNavigate();

  // Search overlay
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // Track if the API call is in progress
  const [isFetching, setIsFetching] = useState(false);

  // REIT analytics dropdown
  const [showAnalyticsDropdown, setShowAnalyticsDropdown] = useState(false);

  // Crowdfunding overlay
  const [showCrowdfundingOverlay, setShowCrowdfundingOverlay] = useState(false);

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

  // Fetch search suggestions
  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsFetching(true);   // Start fetching
      try {
        const response = await axios.get(`${API_BASE_URL}/api/reits`, {
          params: { search: searchQuery },
        });
        setSuggestions(response.data?.reits || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsFetching(false); // Done fetching
      }
    };
    fetchSuggestions();
  }, [searchQuery]);

  // Close the Crowdfunding overlay
  const handleCloseCrowdfunding = () => {
    setShowCrowdfundingOverlay(false);
  };

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
            justifyContent: "flex-end",
            marginRight: "80px",
          }}
        >
          {/* "REITs Analytics" menu with dropdown */}
          <div
            className="nav-link dropdown-trigger"
            onMouseEnter={() => setShowAnalyticsDropdown(true)}
            onMouseLeave={() => setShowAnalyticsDropdown(false)}
          >
            REITs Analytics
            <div
              className={`dropdown-menu ${
                showAnalyticsDropdown ? "show" : ""
              }`}
            >
              <div
                className="dropdown-item"
                onClick={() => {
                  setShowSearchOverlay(true);
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

          {/* Crowdfunding link -> overlay */}
          <div
            className="nav-link"
            onClick={() => setShowCrowdfundingOverlay(true)}
          >
            Real Estate Crowdfundings
          </div>
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

            {/* If still fetching, show a "Loading..." message or spinner */}
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
                ) : (
                  /* If user typed something but we have zero suggestions */
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

      {/* Full-Screen Crowdfunding Overlay */}
      {showCrowdfundingOverlay && (
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
            <h2 style={{ marginBottom: "1rem", color: "#5A153D" }}>
              Real Estate Crowdfundings
            </h2>
            <p style={{ fontSize: "1rem", lineHeight: "1.5" }}>
              We’re currently developing a platform that helps you evaluate
              real estate crowdfunding opportunities more effectively.
              <br />
              <br />
              If you’re interested in early access, we’d love to hear from you!
              Sign up on our landing page for our early-access list, and you’ll
              receive an exclusive <strong>30% discount</strong> when we launch.
            </p>
            <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
              <button
                onClick={handleCloseCrowdfunding}
                style={{
                  backgroundColor: "#5A153D",
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
