import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  applyActionCode,
} from "firebase/auth";
import { auth } from "../firebase.js";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";
import BottomBanner from "../components/BottomBanner.js";

const Login = ({ setCurrentUser }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showResendLink, setShowResendLink] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputStyle = {
    width: "95%",
    padding: "0.75rem",
    fontSize: "1rem",
    borderRadius: "6px",
    marginBottom: "1.3rem",
    border: "1px solid #ccc",
  };

  useEffect(() => {
      const searchParams = new URLSearchParams(window.location.search);

      if (searchParams.get('status') === 'created') {
        setSuccessMessage("Account created! We've sent a link to your email. Please verify before logging in.");
        setShowResendLink(true);
        setResendCooldown(60); // <-- ADD THIS LINE
        window.history.replaceState(null, '', window.location.pathname);
      } else if (searchParams.get('verified') === 'true') {
        setSuccessMessage('Success! Your email has been verified. You can now log in.');
        window.history.replaceState(null, '', window.location.pathname);
      }
  }, []); 

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!email || !password) {
      setError("For security purpose, please enter your email and password to resend the link.");
      return;
    }
    try {
      setError("");
      setSuccessMessage("");
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      if (userCred.user && !userCred.user.emailVerified) {
        const actionCodeSettings = {
          url: `${window.location.origin}/login?verified=true`,
        };
        await sendEmailVerification(userCred.user, actionCodeSettings);
        setSuccessMessage("A new verification link has been sent to your email.");
        setResendCooldown(60);
      }
      await signOut(auth);
    } catch (err) {
      if (err.code === 'auth/too-many-requests') {
        setError("Too many requests. Please wait a moment before trying again.");
        setResendCooldown(60);
      } else {
        setError("Failed to resend email. Please check your credentials.");
      }
      console.error("Resend error:", err);
    }
  };

  const handleLogin = async () => {
    try {
      setError("");
      setSuccessMessage(""); // Clear success message on new login attempt
      setShowResendLink(false);
      const userCred = await signInWithEmailAndPassword(auth, email, password);

      await userCred.user.reload();

      if (!userCred.user.emailVerified) {
        setError("Please verify your email before logging in.");
        setShowResendLink(true);
        await signOut(auth);
        return;
      }

      const q = query(collection(db, "users"), where("email", "==", email));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setError("Your account setup is not complete. Please sign up again.");
        await signOut(auth);
        return;
      }

      setCurrentUser(userCred.user);
      navigate("/");
    } catch (err) {
      setError("Invalid email or password");
      setShowResendLink(false);
      console.error("Login error:", err);
    }
  };

  const googleProvider = new GoogleAuthProvider();
  const handleGoogleLogin = async () => {
    try {
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const q = query(collection(db, "users"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("Your account is not active yet. Please complete the signup process.");
        await signOut(auth);
        return;
      }
      
      setCurrentUser(user);
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

          {showResendLink && (
            <div style={{ marginBottom: "1rem", fontSize: "0.9rem", textAlign: "center" }}>
              <span>Didn't receive an email? </span>
              <button
                onClick={handleResendVerification}
                disabled={resendCooldown > 0}
                onMouseEnter={(e) => {
                  if (resendCooldown === 0) { 
                    e.currentTarget.style.color = "#B12D78";
                  }
                }}
                onMouseLeave={(e) => {
                  // Only change color back if the button is active (not counting down)
                  if (resendCooldown === 0) { 
                    e.currentTarget.style.color = "#5A153D";
                  }
                }}
                style={{
                  color: resendCooldown > 0 ? "#999" : "#5A153D",
                  background: "none",
                  border: "none",
                  textDecoration: "underline",
                  cursor: resendCooldown > 0 ? "default" : "pointer",
                  padding: 0,
                  fontSize: "0.9rem",
                }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification link"}
              </button>
            </div>
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
              border: "2px solid #5A153D", // Added for consistency
              borderRadius: "6px",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Login
          </button>

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
              Or sign in using
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
          </div>

          <button
            onClick={handleGoogleLogin}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#faf0fb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
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

          <button
            onClick={() => navigate("/")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#ccc"; // Darken on hover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ddd"; // Revert on leave
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
            Don't have an account?
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
