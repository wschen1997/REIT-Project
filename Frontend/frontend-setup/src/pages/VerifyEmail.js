import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../firebase.js";

function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get the email and password passed from the Signup page
  const { email, password } = location.state || {};

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("Account created! We've sent a link to your email. Please verify before logging in.");
  const [resendCooldown, setResendCooldown] = useState(60);

  // Redirect if email/password are not available (e.g., direct navigation)
  useEffect(() => {
    if (!email || !password) {
      navigate('/signup');
    }
  }, [email, password, navigate]);

  // Cooldown timer logic (moved from Login.js)
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Resend logic (moved from Login.js)
  const handleResendVerification = async () => {
    if (!email || !password) {
      setError("Session expired. Please sign up again.");
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
      setError("Failed to resend email. Please try signing up again.");
      console.error("Resend error:", err);
    }
  };

  return (
    <>
        <div style={{ backgroundColor: "var(--background-color)", minHeight: "100vh" }}>
        {/* 1. We add flexbox and a 'gap' to the card to enforce equal spacing */}
        <div 
            className="card" 
            style={{ 
            width: "clamp(320px, 40%, 600px)",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2.5rem' // This single property now controls all vertical spacing!
            }}
        >
            {/* 2. The margin is removed from the h2 */}
            <h2 style={{ fontSize: "1.8rem", color: "var(--text-color-dark)", margin: 0 }}>
            Verify Your Email
            </h2>
            
            {/* 3. Margins are removed from messages to let 'gap' control the space */}
            {successMessage && <p className="success-message" style={{ margin: 0, textAlign: 'center' }}>{successMessage}</p>}
            {error && <p className="error-message" style={{ margin: 0, textAlign: 'center' }}>{error}</p>}

            {/* 4. Margin is removed from the 'resend' link container */}
            <div style={{ fontSize: "0.9rem", textAlign: "center" }}>
            <span>Didn't receive an email? </span>
            <button
                onClick={handleResendVerification}
                disabled={resendCooldown > 0}
                className="text-link"
                style={{
                background: 'none', 
                border: 'none', 
                textDecoration: 'underline', 
                padding: 0, 
                fontSize: '0.9rem',
                color: resendCooldown > 0 ? 'var(--text-color-subtle)' : 'var(--primary-color)',
                cursor: resendCooldown > 0 ? 'default' : 'pointer',
                }}
            >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification link"}
            </button>
            </div>
            
            {/* 5. The "Go to Login Page" button has been completely removed. */}
        </div>
        </div>
    </>
    );
}

export default VerifyEmail;