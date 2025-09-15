import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase.js";
import { useLoading } from "../context/LoadingContext.js";

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { setLoading: setIsLoading } = useLoading();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      // This is the core Firebase function
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage(
        "If an account exists for this email, a password reset link has been sent. Please check your inbox."
      );
    } catch (err) {
      console.error("Password reset error:", err);
      // For security, show a generic message even if the email doesn't exist
      setError("Failed to send reset email. Please check the email address and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div style={{ backgroundColor: "var(--background-color)", minHeight: "100vh" }}>
        <div 
          className="card" 
          style={{ 
            width: "clamp(320px, 40%, 600px)",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem' // Controls the equal spacing between all items
          }}
        >
          <div style={{ textAlign: 'center' }}> {/* Wrapper to center text */}
            <h2 style={{ fontSize: "1.8rem", color: "var(--text-color-dark)", margin: 0, marginBottom: '0.5rem' }}>
              Reset Password
            </h2>
            <p style={{ color: "var(--text-color-subtle)", margin: 0 }}>
              Enter your email address to receive a reset link.
            </p>
          </div>

          {!successMessage ? (
            <form onSubmit={handleResetPassword} style={{ width: '100%' }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
              />
              {error && <p className="error-message">{error}</p>}
              <button type="submit" className="btn btn-primary">
                Send Reset Link
              </button>
            </form>
          ) : (
            <p className="success-message" style={{ textAlign: 'center', margin: 0 }}>{successMessage}</p>
          )}

          {/* This is the updated button */}
          <button
            onClick={() => navigate("/login")}
            className="btn btn-secondary" // Matched to "Return Home" button
          >
            Back to Login
          </button>
        </div>
      </div>
    </>
  );
}

export default ResetPassword;