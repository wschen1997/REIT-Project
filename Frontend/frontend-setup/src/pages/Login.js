import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "../components/Header.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // OPTIONAL: Override .App’s background so we see the blur
  useEffect(() => {
    const appDiv = document.querySelector(".App");
    if (appDiv) {
      appDiv.style.background = "transparent";
      appDiv.style.boxShadow = "none";
      appDiv.style.margin = "0";
      appDiv.style.padding = "0";
    }
    return () => {
      if (appDiv) {
        appDiv.style.background = "white";
        appDiv.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.1)";
        appDiv.style.margin = "40px auto";
        appDiv.style.padding = "30px";
      }
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/login`, {
        email,
        password,
      });

      const { token } = response.data;
      localStorage.setItem("token", token);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <>
      <Header />

      {/* Full-page blurred background */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 9999,
          overflowY: "auto",
        }}
        onClick={() => navigate("/")}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "clamp(320px, 40%, 600px)",
            backgroundColor: "#fff",
            margin: "2rem auto",
            minHeight: "80vh",
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "3rem",
          }}
        >
          <form
            onSubmit={handleLogin}
            style={{
              width: "100%",
              maxWidth: "500px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2
              style={{
                marginBottom: "0.5rem",
                fontSize: "1.8rem",
                color: "#333",
              }}
            >
              Sign In
            </h2>
            <p
              style={{
                marginBottom: "1.5rem",
                color: "#666",
              }}
            >
              Access personalized content and exclusive features
            </p>

            {/* Email */}
            <label
              style={{
                marginBottom: "0.3rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.6rem 0.9rem",
                marginBottom: "1rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />

            {/* Password */}
            <label
              style={{
                marginBottom: "0.3rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.6rem 0.9rem",
                marginBottom: "1rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />

            {error && (
              <div
                style={{
                  color: "#ff5c5c",
                  marginBottom: "1rem",
                  width: "100%",
                  fontWeight: "bold",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: "#5A153D",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "1rem",
                cursor: "pointer",
                marginTop: "0.5rem",
              }}
            >
              Sign In
            </button>

            {/* Return Home button */}
            <button
              type="button"
              onClick={() => navigate("/")}
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
              Don&apos;t have an account?{" "}
              <span
                style={{
                  color: "#5A153D",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
                onClick={() => navigate("/signup")}
              >
                Sign Up
              </span>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Login;
