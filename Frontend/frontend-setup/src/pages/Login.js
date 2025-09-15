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
import { useLoading } from "../context/LoadingContext.js";
import { FcGoogle } from "react-icons/fc";

const Login = ({ setCurrentUser }) => {
  const navigate = useNavigate();
  const { setLoading: setIsLoading } = useLoading();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // SUCCESS MESSAGE STATE FOR WHEN USER IS REDIRECTED FROM VERIFICATION LINK
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get('verified') === 'true') {
      setSuccessMessage('Email verification successful! Please log in with the credentials you set up earlier.');
      window.history.replaceState(null, '', window.location.pathname);
    } 
    // --- ADD THIS ENTIRE 'ELSE IF' BLOCK ---
    else if (searchParams.get('passwordReset') === 'true') {
      setSuccessMessage('Password successfully updated! Please log in with your new password.');
      window.history.replaceState(null, '', window.location.pathname);
    }
    // --- END OF BLOCK TO ADD ---
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      setError("");
      setSuccessMessage(""); // Clear success message on new login attempt
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await userCred.user.reload();

      if (!userCred.user.emailVerified) {
        // This error message now guides the user correctly
        setError("Your email is not verified yet. Please check your inbox for the verification link.");
        await signOut(auth);
        setIsLoading(false);
        return;
      }

      const q = query(collection(db, "users"), where("email", "==", email));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setError("Your account setup is not complete. Please sign up again.");
        await signOut(auth);
        setIsLoading(false);
        return;
      }

      setCurrentUser(userCred.user);
      setIsLoading(false);
      navigate("/");
    } catch (err) {
      setIsLoading(false);
      setError("Invalid email or password");
      console.error("Login error:", err);
    }
  };

  const googleProvider = new GoogleAuthProvider();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const q = query(collection(db, "users"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("Your account is not active yet. Please complete the signup process.");
        await signOut(auth);
        setIsLoading(false);
        return;
      }

      setCurrentUser(user);
      setIsLoading(false);
      navigate("/");
    } catch (err) {
      setIsLoading(false);
      console.error("Google login error:", err);
      setError("Failed to sign in with Google. Please try again or use email/password.");
    }
  };

  return (
    <>
      <div style={{ backgroundColor: "var(--background-color)", minHeight: "100vh" }}>
        <div className="card" style={{ width: "clamp(320px, 40%, 600px)" }}>
          <h2 style={{ marginBottom: "0.5rem", fontSize: "1.8rem", color: "var(--text-color-dark)" }}>
            Sign In
          </h2>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-color-subtle)" }}>
            Access personalized content and exclusive features
          </p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
          />
          
          {successMessage && <p className="success-message">{successMessage}</p>}
          {error && <p className="error-message">{error}</p>}

          <button onClick={handleLogin} className="btn btn-primary">
            Login
          </button>

          <div style={{ display: "flex", alignItems: "center", width: "100%", margin: "1.5rem 0" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }} />
            <span style={{ margin: "0 10px", color: "var(--text-color-subtle)", fontSize: "0.9rem" }}>
              Or sign in using
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }} />
          </div>
          
          <button
            onClick={handleGoogleLogin}
            className="btn btn-primary-outline"
            style={{ 
              marginBottom: "1rem",
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px' 
            }}
          >
            <FcGoogle size={20} />
            <span>Google Account</span>
          </button>
          
          <button
            onClick={() => navigate("/")}
            className="btn btn-secondary"
          >
            Return Home
          </button>

          {/* This new container manages the spacing and alignment for both links */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '1rem', // This sets the space between "Sign Up" and "Forgot Password?"
            marginTop: '1.5rem', // This sets the space from the "Return Home" button
            fontSize: '0.9rem', 
            color: "var(--text-color-dark)" 
          }}>
            <div> {/* Wrapper for the first line */}
              Don't have an account?{' '}
              <span onClick={() => navigate("/signup")} className="text-link">
                Sign Up
              </span>
            </div>

            <div> {/* Wrapper for the second line (PASTED HERE) */}
              <span onClick={() => navigate("/reset-password")} className="text-link-subtle">
                Forgot Password?
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
