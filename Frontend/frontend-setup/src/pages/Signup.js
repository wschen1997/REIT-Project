import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
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
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import BottomBanner from "../components/BottomBanner.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function Signup({ currentUser }) {
  const navigate = useNavigate();

  // -------------- Form Fields --------------
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
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
  //  Username check (This function is unchanged)
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
  //  Email check (This function is unchanged)
  // --------------------------------------
  async function checkEmailInUse() {
    setEmailError("");
    if (!email) return;
    try {
      const usersRef = collection(db, "users");
      const qEmail = query(usersRef, where("email", "==", email));
      const snap = await getDocs(qEmail);
      if (!snap.empty) {
        setEmailError("An account with this email already exists.");
        return;
      }
    } catch (err) {
      console.error("Error checking email:", err);
      setEmailError("Unable to check email right now.");
    }
  } 

  // --------------------------------------
  //  Validate password format (This function is unchanged)
  // --------------------------------------
  function validatePasswordFormat(newPass) {
    setPassMinLength(newPass.length >= 8);
    setPassHasLetter(/[A-Za-z]/.test(newPass));
    setPassHasNumber(/\d/.test(newPass));
    setPassHasSpecial(/[^A-Za-z0-9]/.test(newPass));
  }
  
  // --------------------------------------
  //  Google sign-up logic (This function is unchanged)
  // --------------------------------------
  const googleProvider = new GoogleAuthProvider();

  const handleGoogleSignup = async () => {
    try {
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      const usersRef = collection(db, "users");
      const emailQuery = query(usersRef, where("email", "==", result.user.email));
      const emailSnap = await getDocs(emailQuery);
      
      if (!emailSnap.empty) {
        setError("This email is already associated with an account. Please log in instead.");
        await signOut(auth);
        return;
      }
      
      setIsGoogleUser(true);
      if (result.user.displayName) {
        setUsername(result.user.displayName.replace(/\s+/g, ""));
      }
      setEmail(result.user.email);
      setSuccessMessage(
        "Google sign-up successful. Please confirm your username and click 'Create Free Account'."
      );
    } catch (err) {
      console.error("Google signup error:", err);
      setError("Failed to sign up with Google. Please try again or use email/password.");
    }
  }; 

  // --------------------------------------
  //  Final signup logic (MODIFIED for the new flow)
  // --------------------------------------
  const handleSignup = async () => {
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
      if (!username || !email || !password) {
        setError("All fields are required.");
        return;
      }
    } else {
      if (!username) {
        setError("Please set a username before continuing.");
        return;
      }
    }

    try {
      setError("");
      
      if (!isGoogleUser) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);

        const actionCodeSettings = {
          url: `${window.location.origin}/login?verified=true`,
        };

        await sendEmailVerification(userCred.user, actionCodeSettings);
        await signOut(auth); 
      }

      const usersRef = collection(db, "users");
      const emailQuery = query(usersRef, where("email", "==", email));
      const emailSnap = await getDocs(emailQuery);

      if (!emailSnap.empty) {
        setError("An account with this email already exists. Please log in.");
        if (isGoogleUser) await signOut(auth); // Sign out Google user if they exist
        return;
      }

      await addDoc(usersRef, {
        username,
        email,
        plan: "free",
        createdAt: new Date().toISOString(),
      });
      
      if (isGoogleUser) {
        navigate("/");
      } else {
        navigate("/login?status=created");
      }

    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please log in or use a different email.");
      } else {
        console.error("Signup error:", err);
        setError(err.message);
      }
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
            Create Free Account
          </button>

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