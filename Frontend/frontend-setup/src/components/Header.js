// Header.js – corrected and complete
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { auth } from "../firebase.js";
import { signOut } from "firebase/auth";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";
import Sidebar from "./Sidebar.js";

const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// Tweak just this if the auth buttons ever shift left/right
const AUTH_GROUP_STYLE = { marginRight: "55px" };

const Header = ({ currentUser, userPlan, setUserPlan }) => {
  const navigate = useNavigate();
  const location = useLocation();

  /* ─────────────────────────  Firebase / user  ───────────────────────── */
  const [username, setUsername] = useState("");
  const [loginHovered, setLoginHovered] = useState(false);

  useEffect(() => {
    if (!currentUser || !currentUser.emailVerified) {
      setUsername("");
      setUserPlan(null);
      return;
    }

    const fetchUserData = async () => {
      const q = query(collection(db, "users"), where("email", "==", currentUser.email));
      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          setUsername(userData.username || "");
          setUserPlan(userData.plan);
        } else {
           // This handles cases where user exists in Firebase Auth but not in your database yet
           // You might want to sign them out if their DB record is missing
           // signOut(auth); // <-- Comment this out for now
        }
      } catch (error) {
        console.error("Error fetching user data in Header:", error);
        signOut(auth);
      }
    };

    fetchUserData();
  }, [currentUser, setUserPlan, location]); 

  /* ─────────────────────────  sidebar  ───────────────────────── */
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /* ─────────────────────────  search box  ────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  // recent searches (array of {Ticker, Company_Name})
  const [recentSearches, setRecentSearches] = useState([]);
  const [isFocused, setIsFocused] = useState(false);

  // load recents from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    setRecentSearches(stored);
  }, []);

  // save a new recent (object) at top, dedupe, keep max 5
  const saveRecent = (item) => {
    const filtered = recentSearches.filter((r) => r.Ticker !== item.Ticker);
    const updated = [item, ...filtered].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  // fetch from API when user types
  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }
    let active = true;
    (async () => {
      setIsFetching(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/reits`, {
          params: { search: searchQuery },
        });
        if (active) setSuggestions(res.data?.reits || []);
      } catch {
        active && setSuggestions([]);
      } finally {
        active && setIsFetching(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [searchQuery]);

  // when user selects, record and navigate
  const handleSelectTicker = (item) => {
    saveRecent(item);
    setSearchQuery("");
    setSuggestions([]);
    navigate(`/reits/${item.Ticker}`);
  };

  /* ─────────────────────────  render  ───────────────────────── */
  return (
    <>
      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            backgroundColor: "rgba(0,0,0,0.25)",
            zIndex: 1200,
          }}
        />
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Header bar */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "#fff",
          color: "#333",
          boxShadow: "0 4px 6px rgba(0,0,0,.1)",
          zIndex: 1100,
        }}
      >
        {/* LEFT:  hamburger + logo + search */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* ☰ hamburger */}
          <div
            onClick={() => setIsSidebarOpen((o) => !o)}
            style={{
              marginLeft: 10,
              fontSize: 26,
              lineHeight: 0,
              cursor: "pointer",
              userSelect: "none",
              color: "#5A153D",
            }}
          >
            &#9776;
          </div>

          {/* logo */}
          <img
            src="/logo-crop.PNG"
            alt="Viserra Logo"
            style={{ height: 60, cursor: "pointer" }}
            onClick={() => navigate("/")}
          />

          {/* search box */}
          <div style={{ width: 320, position: "relative" }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              placeholder="Search REIT ticker…"
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: "1rem",
                borderRadius: 4,
                border: "1px solid #ccc",
              }}
            />
            {(
              // show API suggestions if typing
              searchQuery ||
              // otherwise, if focused and have recents, show them
              (!searchQuery && isFocused && recentSearches.length > 0)
            ) && (
              <div
                style={{
                  position: "absolute",
                  top: 46,
                  left: 0,
                  width: "108.5%",
                  maxHeight: 260,
                  overflowY: "auto",
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  zIndex: 1300,
                }}
              >
                {searchQuery && isFetching && (
                  <p style={{ margin: 8, fontSize: ".9rem", color: "#555" }}>
                    Loading…
                  </p>
                )}
                {searchQuery &&
                  !isFetching &&
                  suggestions.length === 0 && (
                    <p style={{ margin: 8, fontSize: ".9rem" }}>
                      No match for <strong>{searchQuery}</strong>
                    </p>
                  )}

                {/* unified list: either API results or recents (filtered) */}
                {!searchQuery && isFocused && recentSearches.filter(r => r.Ticker && r.Company_Name).length > 0 && (
                  <div style={{ padding: "8px 12px", color: "#000", fontWeight: 600 }}>
                    Recent
                  </div>
                )}
                {(searchQuery
                  ? suggestions
                  : recentSearches.filter((r) => r.Ticker && r.Company_Name)
                ).map((r) => (
                  <div
                    key={r.Ticker}
                    onClick={() => handleSelectTicker(r)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#faf0fb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* Ticker in purple */}
                    <span
                      style={{
                        color: "#5A153D",
                        fontWeight: 600,
                      }}
                    >
                      {r.Ticker}
                    </span>
                    {/* Company name in black, safe-split */}
                    <span style={{ color: "#000", marginLeft: 8 }}>
                      {(r.Company_Name || "").split(" (")[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT:  auth buttons / greeting */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 25,
            ...AUTH_GROUP_STYLE,
          }}
        >
          {currentUser && currentUser.emailVerified && location.pathname !== '/signup' ? (
            <>
              {/* greeting dropdown */}
              <div
                className="nav-link dropdown-trigger"
                onMouseEnter={(e) =>
                  e.currentTarget
                    .querySelector(".acct-dd")
                    .classList.add("show")
                }
                onMouseLeave={(e) =>
                  e.currentTarget
                    .querySelector(".acct-dd")
                    .classList.remove("show")
                }
                style={{ cursor: "pointer" }}
              >
                Hello, {username || currentUser.email}
                <div className="acct-dd dropdown-menu">
                  <div
                    className="dropdown-item"
                    onClick={() => navigate("/user")}
                  >
                    My Account
                  </div>
                </div>
              </div>
              {/* logout */}
              <button
                onClick={() => {
                  setUsername("");
                  signOut(auth);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#faf0fb";
                  e.currentTarget.style.color = "#5A153D";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#5A153D";
                  e.currentTarget.style.color = "#fff";
                }}
                style={{
                  padding: "8px 16px",
                  fontSize: "1rem",
                  border: "none",
                  color: "#fff",
                  backgroundColor: "#5A153D",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#faf0fb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
              }}
              style={{
                padding: "8px 16px",
                fontSize: "1rem",
                border: "2px solid #5A153D",
                borderRadius: "4px",
                cursor: "pointer",
                color: "#5A153D",
                backgroundColor: "transparent",
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </nav>
    </>
  );
};

export default Header;