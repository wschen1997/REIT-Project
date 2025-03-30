// Signup.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signOut,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// A naive regex enforcing:
// - At least 8 characters
// - At least 1 letter
// - At least 1 digit
// - At least 1 special character
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function Signup() {
  const navigate = useNavigate();
  // hover state for plan buttons
  const [hoveredPlan, setHoveredPlan] = useState(null);
  // states
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState(null); // "free" or "premium"

  // top-level error (for final signup or other actions)
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // local validation states
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");

  // For password format checks
  const [passMinLength, setPassMinLength] = useState(false);
  const [passHasLetter, setPassHasLetter] = useState(false);
  const [passHasNumber, setPassHasNumber] = useState(false);
  const [passHasSpecial, setPassHasSpecial] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // handle Stripe success from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const emailFromURL = urlParams.get("email");
    const usernameFromURL = urlParams.get("username");

    if (status === "success" && emailFromURL && usernameFromURL) {
      const registerUser = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/register-premium-user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailFromURL, username: usernameFromURL }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Failed to register");
          navigate(`/login?status=activated`);
        } catch (err) {
          console.error("Post-payment setup error:", err);
          setError("Payment succeeded but account setup failed. Please contact support.");
        }
      };
      registerUser();
    }
  }, [navigate]);

  // POLL FOR EMAIL VERIFICATION: every 5s, reload user data
  // if not verified, keep polling. If verified, stop.
  useEffect(() => {
    if (emailSent && !emailVerified) {
      const intervalId = setInterval(async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            setEmailVerified(true);
            clearInterval(intervalId);
          }
        }
      }, 5000);
      return () => clearInterval(intervalId);
    }
  }, [emailSent, emailVerified]);

  // resend cooldown
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ----- "Instant" checks (onBlur / onChange) -----

  // 1) Check if username is taken
  async function checkUsernameInUse() {
    setUsernameError("");
    if (!username) return;
    try {
      const usersRef = collection(db, "users");
      const qUsername = query(usersRef, where("username", "==", username));
      const snap = await getDocs(qUsername);
      if (!snap.empty) {
        setUsernameError("This username is already taken. Please choose a different one.");
      }
    } catch (err) {
      console.error("Error checking username:", err);
      setUsernameError("Unable to check username right now.");
    }
  }

  // 2) Check if email is taken
  async function checkEmailInUse() {
    setEmailError("");
    if (!email) return;
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length > 0) {
        setEmailError("This email is already associated with an account.");
        return;
      }
      // Check Firestore too
      const usersRef = collection(db, "users");
      const qEmail = query(usersRef, where("email", "==", email));
      const snap = await getDocs(qEmail);
      if (!snap.empty) {
        setEmailError("An account with this email already exists.");
      }
    } catch (err) {
      console.error("Error checking email:", err);
      setEmailError("Unable to check email right now.");
    }
  }

  // 3) Validate password format on each keystroke
  function validatePasswordFormat(newPass) {
    setPassMinLength(newPass.length >= 8);
    setPassHasLetter(/[A-Za-z]/.test(newPass));
    setPassHasNumber(/\d/.test(newPass));
    setPassHasSpecial(/[^A-Za-z0-9]/.test(newPass));
  }

  // ---------------

  // handle sending verification email
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
        // no user in Firebase Auth => create
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCred.user);
        // remain signed in so we can poll .reload()
        setEmailSent(true);
        setResendCooldown(50);
      } else {
        // user in Auth => sign in to check if verified
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (userCred.user.emailVerified) {
          setEmailVerified(true);
        } else {
          await sendEmailVerification(userCred.user);
        }
        setEmailSent(true);
        setResendCooldown(50);
      }
    } catch (err) {
      console.error("Verification email error:", err);
      setError("This email is already in use. Please log in or reset your password.");
    } finally {
      setSendingEmail(false);
    }
  };

  // final signup
  const handleSignup = async () => {
    if (
      usernameError ||
      emailError ||
      !passMinLength ||
      !passHasLetter ||
      !passHasNumber ||
      !passHasSpecial
    ) {
      setError("Please fix the errors above before continuing.");
      return;
    }

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

      // double-check email in Firestore
      const emailQuery = query(usersRef, where("email", "==", email));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        setError(
          "An account with this email already exists. If this is you, please log in or reset your password."
        );
        setIsLoading(false);
        return;
      }

      // double-check username in Firestore
      const usernameQuery = query(usersRef, where("username", "==", username));
      const usernameSnap = await getDocs(usernameQuery);
      if (!usernameSnap.empty) {
        setError("This username is already taken. Please choose a different one.");
        setIsLoading(false);
        return;
      }

      // In a real app, do NOT store plaintext passwords in Firestore.
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
        // plan === "free"
        await addDoc(usersRef, {
          username,
          email,
          password, // demonstration only
          plan,
          createdAt: new Date().toISOString(),
        });
        await signOut(auth);
        navigate("/login?status=activated");
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
      {isLoading && <Loading />}

      {/* Plain white background (no blur), fill at least full screen */}
      <div style={{ backgroundColor: "#fff", minHeight: "100vh" }}>
        {/* Centered sign-up box */}
        <div
          style={{
            width: "clamp(320px, 40%, 600px)",
            margin: "2rem auto",
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "3rem",
            backgroundColor: "#fff",
          }}
        >
          <h2>Sign Up</h2>
          {successMessage && <p style={{ color: "green" }}>{successMessage}</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}

          {/* USERNAME */}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setUsernameError(""); // reset if user changes
            }}
            onBlur={checkUsernameInUse}
            style={inputStyle}
          />
          {usernameError && (
            <p style={{ color: "red", marginTop: "-0.5rem" }}>{usernameError}</p>
          )}

          {/* PASSWORD */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              const newPass = e.target.value;
              setPassword(newPass);
              setPasswordTouched(true);
              validatePasswordFormat(newPass);
            }}
            style={inputStyle}
          />
          {passwordTouched && (
            <div style={{ textAlign: "left", marginBottom: "1.3rem" }}>
              <p style={{ margin: "0 0 0.25rem", fontWeight: "bold" }}>
                Password Requirements:
              </p>
              <ul style={{ listStyleType: "disc", paddingLeft: "1.25rem", margin: 0 }}>
                <li style={{ color: passMinLength ? "green" : "red" }}>
                  At least 8 characters
                </li>
                <li style={{ color: passHasLetter ? "green" : "red" }}>
                  At least one letter
                </li>
                <li style={{ color: passHasNumber ? "green" : "red" }}>
                  At least one digit
                </li>
                <li style={{ color: passHasSpecial ? "green" : "red" }}>
                  At least one special character
                </li>
              </ul>
            </div>
          )}

          {/* EMAIL */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError("");
            }}
            onBlur={checkEmailInUse}
            style={inputStyle}
          />
          {emailError && (
            <p style={{ color: "red", marginTop: "-0.5rem" }}>{emailError}</p>
          )}

          {/* SEND VERIFICATION */}
          <button
            onClick={handleSendVerification}
            disabled={resendCooldown > 0 || sendingEmail || emailVerified}
            onMouseEnter={(e) => {
              // Only apply hover color if the button isn't disabled
              if (!emailVerified && !sendingEmail && resendCooldown === 0) {
                e.currentTarget.style.color = "#B12D78";
              }
            }}
            onMouseLeave={(e) => {
              // Revert to default color logic
              if (!emailVerified && !sendingEmail && resendCooldown === 0) {
                e.currentTarget.style.color = "#5A153D";
              }
            }}
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
              ? "Email Verified"
              : sendingEmail
              ? "Sending..."
              : resendCooldown > 0
              ? `Verification Sent (${resendCooldown}s)`
              : emailSent
              ? "Resend Verification Email"
              : "Send Verification Email"}
          </button>

          {/* PLAN SELECTOR */}
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button
              onClick={() => setPlan("free")}
              onMouseEnter={() => setHoveredPlan("free")}
              onMouseLeave={() => setHoveredPlan(null)}
              style={
                plan === "free"
                  ? activePlanStyle
                  : hoveredPlan === "free"
                  ? { ...inactivePlanStyle, backgroundColor: "#faf0fb" }
                  : inactivePlanStyle
              }
            >
              Free
            </button>

            <button
              onClick={() => setPlan("premium")}
              onMouseEnter={() => setHoveredPlan("premium")}
              onMouseLeave={() => setHoveredPlan(null)}
              style={
                plan === "premium"
                  ? activePlanStyle
                  : hoveredPlan === "premium"
                  ? { ...inactivePlanStyle, backgroundColor: "#faf0fb" }
                  : inactivePlanStyle
              }
            >
              Premium
            </button>
          </div>

          {/* CONTINUE BUTTON with hover fill effect */}
          <button
            onClick={handleSignup}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#faf0fb";
              e.currentTarget.style.color = "#5A153D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#5A153D";
              e.currentTarget.style.color = "#fff";
            }}
            style={signupBtn}
          >
            Continue
          </button>

          {/*  "Already have an account?" prompt */}
          <div
            style={{
              marginTop: "1.5rem",
              fontSize: "0.9rem",
              textAlign: "center",
              color: "#333",
            }}
          >
            Already have an account?
            <span
              onClick={() => navigate("/login")}
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
            >
              Log In
            </span>
          </div>
        </div>
      </div>

      <BottomBanner />
    </>
  );
}

// styling
const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  marginBottom: "1.3rem",
  fontSize: "1rem",
  borderRadius: "6px",
  border: "1px solid #ccc",
};

const activePlanStyle = {
  padding: "0.75rem 1.25rem",
  border: "2px solid #5A153D",
  backgroundColor: "#faf0fb",
  color: "#5A153D",
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
