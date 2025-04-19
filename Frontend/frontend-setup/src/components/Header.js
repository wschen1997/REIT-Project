// Header.js – complete replacement (search bar now sits right next to logo)
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { auth } from "../firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";
import Sidebar from "./Sidebar.js";

const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// Tweak just this if the auth buttons ever shift left/right
const AUTH_GROUP_STYLE = { marginRight: "55px" };

const Header = ({ userPlan, setUserPlan }) => {
  const navigate = useNavigate();

  /* ─────────────────────────  Firebase / user  ───────────────────────── */
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState("");
  const [loginHovered, setLoginHovered] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (!u) {
        setUsername("");
        setUserPlan(null);
        return;
      }
      // fetch Firestore doc
      const q = query(collection(db, "users"), where("email", "==", u.email));
      try {
        const qs = await getDocs(q);
        if (qs.empty) throw new Error("No doc");
        const data = qs.docs[0].data();
        if (!["free", "premium"].includes(data.plan)) {
          signOut(auth);
          return;
        }
        setUsername(data.username || "");
        setUserPlan(data.plan);
      } catch {
        signOut(auth);
      }
    });
    return () => unsub();
  }, [setUserPlan]);

  /* ─────────────────────────  sidebar  ───────────────────────── */
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /* ─────────────────────────  search box  ────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const fetchSuggestions = async () => {
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
    };
    fetchSuggestions();
    return () => {
      active = false;
    };
  }, [searchQuery]);

  const handleSelectTicker = (tkr) => {
    setSearchQuery("");
    setSuggestions([]);
    navigate(`/reits/${tkr}`);
  };

  /* ─────────────────────────  render  ───────────────────────── */
  return (
    <>
      {/* Sidebar */}
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
              color: "#5A153D", // change if you need another color
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

          {/* search box – moved here */}
          <div style={{ width: 320, position: "relative" }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search REIT ticker…"
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: "1rem",
                borderRadius: 4,
                border: "1px solid #ccc",
              }}
            />
            {Boolean(searchQuery) && (
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
                {isFetching && (
                  <p style={{ margin: 8, fontSize: ".9rem", color: "#555" }}>
                    Loading…
                  </p>
                )}
                {!isFetching && suggestions.length === 0 && (
                  <p style={{ margin: 8, fontSize: ".9rem" }}>
                    No match for <strong>{searchQuery}</strong>
                  </p>
                )}
                {suggestions.map((r) => (
                  <div
                    key={r.Ticker}
                    onClick={() => handleSelectTicker(r.Ticker)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#faf0fb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <strong>{r.Ticker}</strong>
                    {r.Company_Name ? ` – ${r.Company_Name}` : ""}
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
          {currentUser ? (
            <>
              {/* greeting dropdown trigger */}
              <div
                className="nav-link dropdown-trigger"
                onMouseEnter={(e) =>
                  e.currentTarget.querySelector(".acct-dd").classList.add("show")
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
              {/* logout –  unchanged styles */}
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
                color: loginHovered ? "#fff" : "#5A153D",
                backgroundColor: loginHovered ? "#B12D78" : "transparent",
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
