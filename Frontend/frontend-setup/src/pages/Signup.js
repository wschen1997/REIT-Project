import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore"; // doc, updateDoc for updates
import { auth, db } from "../firebase.js";
import BottomBanner from "../components/BottomBanner.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// A naive regex enforcing:
// - At least 8 characters
// - At least 1 letter
// - At least 1 digit
// - At least 1 special character
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function Signup() {
  const navigate = useNavigate();

  // -------------- Local UI States --------------
  const [hoveredPlan, setHoveredPlan] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // -------------- Form Fields --------------
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState(null); // "free" or "premium"

  // -------------- Validation & Error States --------------
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passMinLength, setPassMinLength] = useState(false);
  const [passHasLetter, setPassHasLetter] = useState(false);
  const [passHasNumber, setPassHasNumber] = useState(false);
  const [passHasSpecial, setPassHasSpecial] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // -------------- Track if user is from Google --------------
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  // --------------------------------------
  //  Handle Stripe success from ?status=success
  // --------------------------------------
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

          // On success, direct to login
          navigate("/login?status=activated");
        } catch (err) {
          console.error("Post-payment setup error:", err);
          setError("Payment succeeded but account setup failed. Please contact support.");
        }
      };
      registerUser();
    }
  }, [navigate]);

  // --------------------------------------
  //  Poll for email verification if using normal email flow
  // --------------------------------------
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

  // --------------------------------------
  //  Resend verification cooldown
  // --------------------------------------
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // --------------------------------------
  //  Username check
  // --------------------------------------
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

  // --------------------------------------
  //  Email check
  // --------------------------------------
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

  // --------------------------------------
  //  Validate password format
  // --------------------------------------
  function validatePasswordFormat(newPass) {
    setPassMinLength(newPass.length >= 8);
    setPassHasLetter(/[A-Za-z]/.test(newPass));
    setPassHasNumber(/\d/.test(newPass));
    setPassHasSpecial(/[^A-Za-z0-9]/.test(newPass));
  }

  // --------------------------------------
  //  Send verification email (normal email flow)
  // --------------------------------------
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
        // No user => create in Firebase Auth
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCred.user);
        setEmailSent(true);
        setResendCooldown(50);
      } else {
        // There's a user => sign in to see if verified
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

  // --------------------------------------
  //  Google sign-up logic
  // --------------------------------------
  const googleProvider = new GoogleAuthProvider();

  const handleGoogleSignup = async () => {
    try {
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
  
      // --- Duplicate Email Check Start ---
      const usersRef = collection(db, "users");
      const emailQuery = query(usersRef, where("email", "==", result.user.email));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        setError("This email is already associated with an account. Please log in instead.");
        await signOut(auth); // Optionally sign the user out
        return; // Stop further execution
      }
      // --- Duplicate Email Check End ---
  
      // Proceed with Google sign-up if no duplicate found
      setIsGoogleUser(true);
      if (result.user.displayName) {
        setUsername(result.user.displayName.replace(/\s+/g, ""));
      }
      setEmail(result.user.email);
      setSuccessMessage(
        "Google sign-up successful. Please select a plan (free or premium) below."
      );
    } catch (err) {
      console.error("Google signup error:", err);
      setError("Failed to sign up with Google. Please try again or use email/password.");
    }
  };  

  // --------------------------------------
  //  Final signup logic
  // --------------------------------------
  const handleSignup = async () => {
    // If not google user => normal checks
    if (!isGoogleUser) {
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
    } else {
      // If google user => skip password & email verification
      if (!username) {
        setError("Please set a username before continuing.");
        return;
      }
      if (!plan) {
        setError("Please select a plan (free or premium) before continuing.");
        return;
      }
    }

    try {
      setError("");

      const usersRef = collection(db, "users");

      // 1) If plan === premium => stripe checkout
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
        // 2) plan === "free"
        const emailQuery = query(usersRef, where("email", "==", email));
        const emailSnap = await getDocs(emailQuery);

        if (emailSnap.empty) {
          // No doc => create
          await addDoc(usersRef, {
            username,
            email,
            password: isGoogleUser ? "" : password,
            plan,
            createdAt: new Date().toISOString(),
          });
        } else {
          // doc exist => update
          const existingDoc = emailSnap.docs[0];
          const docRef = existingDoc.ref;
          await updateDoc(docRef, {
            username,
            plan,
            password: isGoogleUser ? "" : password,
          });
        }

        // sign out from Firebase so user can log in again
        await signOut(auth);
        navigate("/login?status=activated");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message);
    }
  };

  // --------------------------------------
  //  Render
  // --------------------------------------
  return (
    <>
      <div style={{ backgroundColor: "#fff", minHeight: "100vh" }}>
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
              setUsernameError("");
            }}
            onBlur={checkUsernameInUse}
            style={inputStyle}
          />
          {usernameError && (
            <p style={{ color: "red", marginTop: "-0.5rem" }}>{usernameError}</p>
          )}

          {/* PASSWORD (hidden for google user) */}
          {!isGoogleUser && (
            <>
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
            </>
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
            disabled={isGoogleUser}
          />
          {emailError && (
            <p style={{ color: "red", marginTop: "-0.5rem" }}>{emailError}</p>
          )}

          {/* SEND VERIFICATION (hidden if google user) */}
          {!isGoogleUser && (
            <button
              onClick={handleSendVerification}
              disabled={resendCooldown > 0 || sendingEmail || emailVerified}
              onMouseEnter={(e) => {
                if (!emailVerified && !sendingEmail && resendCooldown === 0) {
                  e.currentTarget.style.color = "#B12D78";
                }
              }}
              onMouseLeave={(e) => {
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
                : "Click here to verify your email"}
            </button>
          )}

          {/* "Or sign up using" + Google button => hidden if isGoogleUser is true */}
          {!isGoogleUser && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  margin: "0.5rem 0 0.5rem 0",
                }}
              >
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
                <span style={{ margin: "0 10px", color: "#666", fontSize: "0.9rem" }}>
                  Or sign up using
                </span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
              </div>

              {/* Google Sign-Up Button */}
              <button
                onClick={handleGoogleSignup}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#faf0fb";
                  e.currentTarget.style.color = "#5A153D";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#fff";
                  e.currentTarget.style.color = "#5A153D";
                }}
                style={{
                  margin: "1rem 0",
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#fff",
                  color: "#5A153D",
                  border: "2px solid #5A153D",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  width: "105%",
                  height: "45px",
                  cursor: "pointer",
                }}
              >
                Google Account
              </button>
            </>
          )}

          {/* Divider line + small text for plan explanation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              margin: "0.5rem 0 0.8rem 0",
            }}
          >
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
            <span style={{ margin: "0 10px", color: "#666", fontSize: "0.9rem" }}>
              Choose Your Plan
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
          </div>

          {/* PLAN SELECTOR (evenly spaced) */}
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              width: "105%",
              height: "45px",
              marginTop: "0.5rem",
            }}
          >
            <button
              onClick={() => setPlan("free")}
              onMouseEnter={() => setHoveredPlan("free")}
              onMouseLeave={() => setHoveredPlan(null)}
              style={{
                ...planButtonStyle,
                ...(plan === "free"
                  ? activePlanStyle
                  : hoveredPlan === "free"
                  ? { ...inactivePlanStyle, backgroundColor: "#faf0fb" }
                  : inactivePlanStyle),
              }}
            >
              Free
            </button>

            <button
              onClick={() => setPlan("premium")}
              onMouseEnter={() => setHoveredPlan("premium")}
              onMouseLeave={() => setHoveredPlan(null)}
              style={{
                ...planButtonStyle,
                ...(plan === "premium"
                  ? activePlanStyle
                  : hoveredPlan === "premium"
                  ? { ...inactivePlanStyle, backgroundColor: "#faf0fb" }
                  : inactivePlanStyle),
              }}
            >
              Premium
            </button>
          </div>

          {/* CONTINUE BUTTON */}
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

          {/* "Already have an account?" */}
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

// Reused style for plan buttons
const planButtonStyle = {
  flex: 1,
  padding: "0.75rem 1.25rem",
  borderRadius: "6px",
  cursor: "pointer",
  border: "2px solid #5A153D",
  textAlign: "center",
  fontSize: "1rem",
};

const activePlanStyle = {
  backgroundColor: "#faf0fb",
  color: "#5A153D",
};

const inactivePlanStyle = {
  backgroundColor: "white",
  color: "#5A153D",
};

const signupBtn = {
  marginTop: "1.5rem",
  padding: "0.75rem 1.5rem",
  backgroundColor: "#5A153D",
  color: "#fff",
  border: "none",
  width: "105%",
  height: "45px",
  borderRadius: "6px",
  fontSize: "1rem",
  cursor: "pointer",
};

export default Signup;
