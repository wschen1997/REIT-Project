// Login.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";
import BottomBanner from "../components/BottomBanner.js";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const inputStyle = {
    width: "95%",
    padding: "0.75rem",
    fontSize: "1rem",
    borderRadius: "6px",
    marginBottom: "1.3rem",
  };  

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    if (status === "activated") {
      setSuccessMessage("Your account has been activated. Please log in.");
      signOut(auth); // Clear any previous user cache before login
      window.history.replaceState({}, document.title, "/login"); // clean URL
    }
  }, []);

  const handleLogin = async () => {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);

      if (!userCred.user.emailVerified) {
        setError("Please verify your email before logging in.");
        return;
      }

      // Check if user exists in Firestore
      const q = query(collection(db, "users"), where("email", "==", email));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        // User hasn’t completed payment, so log them out
        setError("Your account is not active yet. Please complete payment.");
        await signOut(auth);
        return;
      }

      // User exists and is verified
      navigate("/");
    } catch (err) {
      setError("Invalid email or password");
      console.error("Login error:", err);
    }
  };

  return (
    <>
      {/* 2) Plain white background for the entire page */}
      <div style={{ backgroundColor: "#fff", minHeight: "100vh" }}>
        {/* Centered login box */}
        <div
          style={{
            width: "clamp(320px, 40%, 600px)",
            margin: "2rem auto",
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "3rem",
            backgroundColor: "#fff",
          }}
        >
          <h2 style={{ marginBottom: "0.5rem", fontSize: "1.8rem", color: "#333" }}>
            Sign In
          </h2>
          <p style={{ marginBottom: "1.5rem", color: "#666" }}>
            Access personalized content and exclusive features
          </p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...inputStyle, border: "1px solid #ccc" }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, border: "1px solid #ccc" }}
          />

          {successMessage && (
            <p style={{ color: "green", marginBottom: "1rem" }}>{successMessage}</p>
          )}
          {error && (
            <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>
          )}

          <button
            onClick={handleLogin}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#faf0fb";
              e.currentTarget.style.color = "#5A153D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#5A153D";
              e.currentTarget.style.color = "#fff";
            }}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: "#5A153D",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Login
          </button>

          <button
            onClick={() => navigate("/")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#faf0fb";
              e.currentTarget.style.color = "#5A153D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ddd";
              e.currentTarget.style.color = "#333";
            }}
            style={{
              marginTop: "1rem",
              padding: "0.6rem 1rem",
              backgroundColor: "#ddd",
              color: "#333",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Return Home
          </button>

          <div
            style={{
              marginTop: "1.2rem",
              fontSize: "0.9rem",
              textAlign: "center",
              color: "#333",
            }}
          >
            Don&apos;t have an account?
            <span
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#B12D78";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#5A153D";
              }}
              style={{
                color: "#5A153D",
                cursor: "pointer",
                fontWeight: "bold",
                marginLeft: "4px",
              }}
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </span>
          </div>
        </div>
      </div>

      {/* 3) BottomBanner at the end */}
      <BottomBanner />
    </>
  );
};

export default Login;
