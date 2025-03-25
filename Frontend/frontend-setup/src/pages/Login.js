import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.js";
import { useAuth0 } from "@auth0/auth0-react";

const Login = () => {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

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
        appDiv.style.boxShadow = "0px 4px 10px rgba(0,0,0,0.1)";
        appDiv.style.margin = "40px auto";
        appDiv.style.padding = "30px";
      }
    };
  }, []);

  return (
    <>
      <Header />

      <div
        style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100vw", height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(4px)",
          zIndex: 9999, overflowY: "auto",
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
            boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "3rem",
          }}
        >
          <h2 style={{ marginBottom: "0.5rem", fontSize: "1.8rem", color: "#333" }}>
            Sign In
          </h2>
          <p style={{ marginBottom: "1.5rem", color: "#666" }}>
            Access personalized content and exclusive features
          </p>

          <button
            onClick={() => loginWithRedirect()}
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
            Continue with Auth0
          </button>

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
            Don&apos;t have an account?
            <span
              style={{ color: "#5A153D", cursor: "pointer", fontWeight: "bold", marginLeft: "4px" }}
              onClick={() => loginWithRedirect({ screen_hint: "signup" })}
            >
              Sign Up
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;