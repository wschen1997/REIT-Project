import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { auth } from "../firebase.js";
import { signOut } from "firebase/auth";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";
import Sidebar from "./Sidebar.js";
import { ThemeContext } from '../context/ThemeContext.js';

const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const Header = ({ currentUser, userPlan, setUserPlan }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useContext(ThemeContext);

  /* ─────────────────────────  Firebase / user  ───────────────────────── */
  const [username, setUsername] = useState("");

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
          className="page-overlay"
        />
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentUser={currentUser} />

      {/* Header bar */}
      <nav className="header-nav">
        {/* LEFT:  hamburger + logo + search */}
        <div className="header-left-section">
          {/* ☰ hamburger */}
          <div
            onClick={() => setIsSidebarOpen((o) => !o)}
            className="hamburger-btn"
          >
            &#9776;
          </div>

          {/* logo */}
          <img
            src={theme === 'dark' ? '/logo-dark-mode.png' : '/logo-crop.PNG'}
            alt="Viserra Logo"
            className="header-logo"
            onClick={() => navigate("/")}
          />

          {/* search box */}
          <div className="search-container">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              placeholder="Search REIT ticker…"
              className="search-input"
            />
            {(
              // show API suggestions if typing
              searchQuery ||
              // otherwise, if focused and have recents, show them
              (!searchQuery && isFocused && recentSearches.length > 0)
            ) && (
              <div
                className="search-suggestions"
              >
                {searchQuery && isFetching && (
                  <p className="suggestion-status">
                    Loading…
                  </p>
                )}
                {searchQuery &&
                  !isFetching &&
                  suggestions.length === 0 && (
                    <p className="suggestion-status">
                      No match for <strong>{searchQuery}</strong>
                    </p>
                  )}

                {/* unified list: either API results or recents (filtered) */}
                {!searchQuery && isFocused && recentSearches.filter(r => r.Ticker && r.Company_Name).length > 0 && (
                  <div className="suggestion-header">
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
                    className="suggestion-item"
                  >
                    {/* Ticker in purple */}
                    <span className="suggestion-ticker">
                      {r.Ticker}
                    </span>
                    {/* Company name in black, safe-split */}
                    <span className="suggestion-name">
                      {(r.Company_Name || "").split(" (")[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT:  auth buttons / greeting */}
        <div className="header-right-section">
          {currentUser && currentUser.emailVerified && location.pathname !== '/signup' ? (
            <>
              {/* User account link */}
              <div
                className="btn btn-primary btn-sm"
                onClick={() => navigate("/user")}
              >
                Hello, {username || currentUser.email}
              </div>
              {/* logout */}
              <button
                onClick={() => {
                  setUsername("");
                  signOut(auth);
                }}
                className="btn btn-primary-outline btn-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="btn btn-primary btn-sm"
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
