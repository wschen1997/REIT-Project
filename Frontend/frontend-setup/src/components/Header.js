import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { auth } from "../firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";


const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const Header = () => {
  const navigate = useNavigate();
  console.log("Header rendered. Current URL:", window.location.href);

  // Firebase authentication state
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        getDocs(q)
          .then((querySnapshot) => {
            if (!querySnapshot.empty) {
              const userData = querySnapshot.docs[0].data();
              if (userData.plan === "premium" || userData.plan === "free") {
                setUsername(userData.username || "");
              } else {
                console.warn("Unauthorized plan. Logging out.");
                signOut(auth);
              }
            } else {
              console.warn("No user document found in Firestore. Logging out.");
              signOut(auth);
            }
          })
          .catch((err) => {
            console.error("Error fetching username:", err);
          });
      }          
    });
    return () => unsubscribe();
  }, []);

  // For search overlay
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  // REIT analytics dropdown
  const [showAnalyticsDropdown, setShowAnalyticsDropdown] = useState(false);

  // Listen for "openSearchOverlay" custom event
  useEffect(() => {
    const handleOpenOverlay = () => {
      console.log("Received openSearchOverlay event");
      setShowSearchOverlay(true);
    };
    window.addEventListener("openSearchOverlay", handleOpenOverlay);

    return () => {
      window.removeEventListener("openSearchOverlay", handleOpenOverlay);
    };
  }, []);

  // Search overlay open/close
  const handleSearchClick = () => {
    console.log("Search overlay triggered");
    setShowSearchOverlay(true);
  };
  const handleCloseSearch = () => {
    console.log("Closing search overlay");
    setShowSearchOverlay(false);
    setSearchQuery("");
    setSuggestions([]);
  };

  // On selecting a REIT
  const handleSelect = (ticker) => {
    console.log("REIT selected:", ticker);
    setShowSearchOverlay(false);
    setSearchQuery("");
    setSuggestions([]);
    navigate(`/reits/${ticker}`);
  };

  // Fetch suggestions
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
          onClick={() => {
            console.log("Logo clicked, navigating to home");
            navigate("/");
          }}
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
          {/* Analytics dropdown */}
          <div
            className="nav-link dropdown-trigger"
            onMouseEnter={() => {
              console.log("Analytics dropdown mouse enter");
              setShowAnalyticsDropdown(true);
            }}
            onMouseLeave={() => {
              console.log("Analytics dropdown mouse leave");
              setShowAnalyticsDropdown(false);
            }}
            style={{ cursor: "pointer" }}
          >
            REITs Analytics
            <div className={`dropdown-menu ${showAnalyticsDropdown ? "show" : ""}`}>
              <div
                className="dropdown-item"
                onClick={() => {
                  console.log("Dropdown item: Search for a REIT clicked");
                  handleSearchClick();
                  setShowAnalyticsDropdown(false);
                }}
              >
                Search for a REIT
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  console.log("Dropdown item: REITs Screening clicked");
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
            onClick={() => {
              console.log("Navigating to Crowdfunding");
              navigate("/Crowdfunding");
            }}
          >
            Real Estate Crowdfundings
          </div>

          {/* Pricing link */}
          <div
            className="nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => {
              console.log("Navigating to Pricing");
              navigate("/pricing");
            }}
          >
            Pricing
          </div>

          {/* About Us link */}
          <div
            className="nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => {
              console.log("Navigating to About Us");
              navigate("/about");
            }}
          >
            About Us
          </div>

          {/* Contact Us link */}
          <div
            className="nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => {
              console.log("Navigating to Contact Us");
              navigate("/contact");
            }}
          >
            Contact Us
          </div>
          {currentUser ? (
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              <span
                style={{
                  fontWeight: "bold",
                  color: "#5A153D",
                  border: "2px solid #5A153D",
                  padding: "6px 14px",
                  borderRadius: "4px",
                }}
              >
                Hello, {username || currentUser.email}
              </span>
              <button
                onClick={() => signOut(auth)}
                style={{
                  padding: "8px 16px",
                  fontSize: "1rem",
                  border: "2px solid #B12D78",
                  color: "#fff",
                  backgroundColor: "#B12D78",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          ) : (
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
              }}
            >
              Login
            </button>
          )}  
        </div>
      </nav>

      {/* Search overlay */}
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
                          console.log("Suggestion clicked for ticker:", reit.Ticker);
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
                        No REIT found for "<strong>{searchQuery}</strong>". Please try another ticker or name.
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
