import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase.js";
import { signOut } from "firebase/auth";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

const handleLogin = async () => {
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);

    if (!userCred.user.emailVerified) {
      setError("Please verify your email before logging in.");
      return;
    }

    // 🔐 Check if user exists in Firestore
    const q = query(collection(db, "users"), where("email", "==", email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // User hasn’t completed payment, so log them out
      setError("Your account is not active yet. Please complete payment.");
      await signOut(auth);
      return;
    }

    // ✅ User exists and is verified
    navigate("/");

  } catch (err) {
    setError("Invalid email or password");
    console.error("Login error:", err);
  }
};

  return (
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

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem",
            marginBottom: "1rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem",
            marginBottom: "1rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />

        {error && (
          <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>
        )}

        <button
          onClick={handleLogin}
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
  );
};

export default Login;
