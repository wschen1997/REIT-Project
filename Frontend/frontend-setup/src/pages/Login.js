import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
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
    border: "1px solid #ccc",
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

  // Existing email/password login
  const handleLogin = async () => {
    try {
      setError("");
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

  // Google login logic
  const googleProvider = new GoogleAuthProvider();

  const handleGoogleLogin = async () => {
    try {
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log("Google user is:", user);

      // Check if Firestore doc exists
      const q = query(collection(db, "users"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (snap.empty) {
        // Means user doc doesn't exist => not fully registered
        setError("Your account is not active yet. Please complete the signup process.");
        await signOut(auth);
        return;
      }

      // If doc found, check plan
      const userDoc = snap.docs[0].data();
      if (!["free", "premium"].includes(userDoc.plan)) {
        setError("Your account is not active yet. Please complete payment or signup.");
        await signOut(auth);
        return;
      }

      // plan is valid => navigate home
      navigate("/");
    } catch (err) {
      console.error("Google login error:", err);
      setError("Failed to log in with Google. Please try again or use email/password.");
    }
  };

  return (
    <>
      <div style={{ backgroundColor: "#fff", minHeight: "100vh" }}>
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
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {successMessage && (
            <p style={{ color: "green", marginBottom: "1rem" }}>{successMessage}</p>
          )}
          {error && (
            <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>
          )}

          {/* Email/Password login button */}
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

          {/* Divider line with text "Or login using" */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              margin: "1.5rem 0",
            }}
          >
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
            <span style={{ margin: "0 10px", color: "#666", fontSize: "0.9rem" }}>
              Or login using
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
          </div>

          {/* Google Login button, same style as "Sign up with Google" from Signup */}
          <button
            onClick={handleGoogleLogin}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#faf0fb";
              e.currentTarget.style.color = "#5A153D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
              e.currentTarget.style.color = "#5A153D";
            }}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: "#fff",
              color: "#5A153D",
              border: "2px solid #5A153D",
              borderRadius: "6px",
              fontSize: "1rem",
              cursor: "pointer",
              marginBottom: "1rem",
            }}
          >
            Google Account
          </button>

          {/* Return Home button, matching same style & width */}
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
              width: "100%",
              padding: "0.75rem",
              backgroundColor: "#ddd",
              color: "#333",
              border: "none",
              borderRadius: "6px",
              fontSize: "1rem",
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

      <BottomBanner />
    </>
  );
};

export default Login;
