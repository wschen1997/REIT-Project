// Signup.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import Header from "../components/Header.js";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function Signup() {
  const navigate = useNavigate();
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState(null); // "free" or "premium"
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendVerification = async () => {
    if (!email || !password) {
      setError("Email and password are required for verification.");
      return;
    }
    try {
      setSendingEmail(true);
      setError("");
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length === 0) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCred.user);
        await signOut(auth);
        setEmailSent(true);
        setResendCooldown(50);
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (userCred.user.emailVerified) {
          setEmailVerified(true);
          setEmailSent(true);
        } else {
          await sendEmailVerification(userCred.user);
          await signOut(auth);
          setEmailSent(true);
          setResendCooldown(50);
        }
      }
    } catch (err) {
      console.error("Verification email error:", err);
      setError("Could not send verification email.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleVerifyStatus = async () => {
    try {
      setVerifyingEmail(true);
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      if (userCred.user.emailVerified) {
        setEmailVerified(true);
        setError("");
      } else {
        setError("Email not verified yet.");
      }
      await signOut(auth);
    } catch (err) {
      console.error("Email verification check error:", err);
      setError("Error checking email verification status.");
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleSignup = async () => {
    if (!emailVerified) {
      setError("Please verify your email before continuing.");
      return;
    }
    if (!username || !email || !password || !plan) {
      setError("All fields are required.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const existing = await getDocs(q);
      const alreadyExists = !existing.empty;

      if (plan === "premium") {
        const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success_url: `${window.location.origin}/signup?status=success&email=${email}&username=${username}`,
            cancel_url: `${window.location.origin}/signup?status=cancel`,
          }),
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        } else {
          throw new Error("Stripe session creation failed");
        }      
      } else {
        if (!alreadyExists) {
          await addDoc(usersRef, {
            username,
            email,
            plan,
            createdAt: new Date().toISOString(),
          });
        }
        navigate("/");
      }
    } catch (err) {
      setError(err.message);
      console.error("Signup error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      {isLoading && <Loading />}

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(4px)",
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
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "3rem",
          }}
        >
          <h2>Sign Up</h2>
          {error && <p style={{ color: "red" }}>{error}</p>}

          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

          <button
            onClick={handleSendVerification}
            disabled={resendCooldown > 0 || sendingEmail || emailVerified}
            style={{
              marginBottom: "0.5rem",
              color: emailVerified ? "green" : resendCooldown > 0 ? "#333" : "#5A153D",
              backgroundColor: "transparent",
              border: "none",
              fontWeight: "bold",
              cursor: emailVerified ? "default" : "pointer",
            }}
          >
            {emailVerified
              ? "✅ Email Verified"
              : sendingEmail
              ? "Sending..."
              : resendCooldown > 0
              ? `📧 Verification Sent (${resendCooldown}s)`
              : emailSent
              ? "Resend Verification Email"
              : "Send Verification Email"}
          </button>

          <button
            onClick={handleVerifyStatus}
            disabled={emailVerified || verifyingEmail || !email || !password}
            style={{
              marginBottom: "1rem",
              color: emailVerified ? "green" : "#007bff",
              backgroundColor: "transparent",
              border: "none",
              fontWeight: "bold",
              cursor: emailVerified ? "default" : "pointer",
            }}
          >
            {verifyingEmail ? "Checking..." : emailVerified ? "" : "Click Here Once Verified"}
          </button>

          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button onClick={() => setPlan("free")} style={plan === "free" ? activePlanStyle : inactivePlanStyle}>Free</button>
            <button onClick={() => setPlan("premium")} style={plan === "premium" ? activePlanStyle : inactivePlanStyle}>Premium</button>
          </div>

          <button onClick={handleSignup} style={signupBtn}>Continue</button>
        </div>
      </div>
      <BottomBanner />
    </>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  marginBottom: "1rem",
  fontSize: "1rem",
  borderRadius: "6px",
  border: "1px solid #ccc",
};

const activePlanStyle = {
  padding: "0.75rem 1.25rem",
  border: "2px solid #5A153D",
  backgroundColor: "#5A153D",
  color: "white",
  borderRadius: "6px",
  cursor: "pointer",
};

const inactivePlanStyle = {
  ...activePlanStyle,
  backgroundColor: "white",
  color: "#5A153D",
};

const signupBtn = {
  marginTop: "1.5rem",
  padding: "0.75rem 1.5rem",
  backgroundColor: "#5A153D",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  fontSize: "1rem",
  cursor: "pointer",
};

export default Signup;
