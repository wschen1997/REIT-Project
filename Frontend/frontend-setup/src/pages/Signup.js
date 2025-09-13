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
import Loading from "../components/Loading.js";
import { FcGoogle } from "react-icons/fc";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function Signup({ currentUser }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false); 

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

      setIsLoading(true); // <-- TURN ON LOADING
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
          if (isGoogleUser) await signOut(auth);
          setIsLoading(false); // <-- TURN OFF LOADING
          return;
        }

        await addDoc(usersRef, {
          username,
          email,
          plan: "free",
          createdAt: new Date().toISOString(),
        });

        setIsLoading(false); // <-- TURN OFF LOADING
        if (isGoogleUser) {
          navigate("/");
        } else {
          navigate("/verify-email", { state: { email: email, password: password } });
        }

      } catch (err) {
        setIsLoading(false); // <-- TURN OFF LOADING ON ERROR
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
      <div style={{ backgroundColor: "var(--background-color)", minHeight: "100vh" }}>
        <div className="card" style={{ width: "clamp(320px, 40%, 600px)" }}>
          <h2 style={{ marginBottom: "2rem", fontSize: "1.8rem", color: "var(--text-color-dark)" }}>
            Sign Up
          </h2>
          {successMessage && <p className="success-message">{successMessage}</p>}
          {error && <p className="error-message">{error}</p>}

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setUsernameError("");
            }}
            onBlur={checkUsernameInUse}
            className="input-field"
          />
          {usernameError && (
            <p className="error-message" style={{ marginTop: "-0.5rem" }}>{usernameError}</p>
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
                className="input-field"
              />
              {passwordTouched && (
                <div className="password-reqs">
                  <p className="password-reqs-title">
                    Password Requirements:
                  </p>
                  <ul className="password-reqs-list">
                    <li className={`password-req-item ${passMinLength ? 'valid' : 'invalid'}`}>
                      At least 8 characters
                    </li>
                    <li className={`password-req-item ${passHasLetter ? 'valid' : 'invalid'}`}>
                      At least one letter
                    </li>
                    <li className={`password-req-item ${passHasNumber ? 'valid' : 'invalid'}`}>
                      At least one digit
                    </li>
                    <li className={`password-req-item ${passHasSpecial ? 'valid' : 'invalid'}`}>
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
            className="input-field"
            disabled={isGoogleUser}
          />
          {emailError && (
            <p className="error-message" style={{ marginTop: "-0.5rem" }}>{emailError}</p>
          )}

          <button
            onClick={handleSignup}
            className="btn btn-primary"
          >
            Create Free Account
          </button>

          {!isGoogleUser && (
            <>
              <div style={{ display: "flex", alignItems: "center", width: "100%", margin: "1.5rem 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }} />
                <span style={{ margin: "0 10px", color: "var(--text-color-subtle)", fontSize: "0.9rem" }}>
                  Or sign up using
                </span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }} />
              </div>

              <button
                onClick={handleGoogleSignup}
                className="btn btn-primary-outline"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '10px' 
                }}
              >
                <FcGoogle size={20} /> {/* <-- This is the icon */}
                <span>Google Account</span>
              </button>
            </>
          )}

          <div style={{ marginTop: "1.2rem", fontSize: "0.9rem", textAlign: "center", color: "var(--text-color-dark)" }}>
            Already have an account?{' '}
            <span
              onClick={() => navigate("/login")}
              className="text-link"
            >
              Sign In
            </span>
          </div>
        </div>
      </div>
      {isLoading && <Loading />}
      <BottomBanner />
    </>
  );
  }

export default Signup;