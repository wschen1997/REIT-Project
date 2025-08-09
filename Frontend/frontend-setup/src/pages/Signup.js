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

function Signup({ currentUser }) {
  const navigate = useNavigate();

  // -------------- Local UI States --------------
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

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
  //  Poll for email verification if using normal email flow
  // --------------------------------------
  // This is the NEW, correct block to paste in.
useEffect(() => {
  console.log("%cSignup component received prop:", "color: orange;", currentUser);

  // First, check if the user is already verified when the component receives the prop.
  if (currentUser && currentUser.emailVerified) {
    setEmailVerified(true);
    setSuccessMessage("Your email has been successfully verified! Please click 'Continue' to create your account.");
    return; // Stop if we're already verified.
  }

  // If an email has been sent out and we have a user who is NOT yet verified, START POLLING.
  if (emailSent && currentUser && !currentUser.emailVerified) {
    const intervalId = setInterval(async () => {
      // Tell the currentUser object to refresh its data from Firebase's servers.
      await currentUser.reload();
      console.log("Polling: Checking verification status...");

      // After reloading, check the property again.
      if (currentUser.emailVerified) {
        console.log("%cPOLLING: User is now verified! Stopping poll.", "color: green; font-weight: bold;");
        clearInterval(intervalId);
        setEmailVerified(true);
        setSuccessMessage("Your email has been successfully verified! Please choose a plan to continue.");
        await auth.currentUser.getIdToken(true);
      }
    }, 3000); // Check every 3 seconds

    // Clean up the interval when the component is no longer on screen.
    return () => clearInterval(intervalId);
  }
}, [currentUser, emailSent]); // This effect runs when the user changes OR when the email is sent.

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
      // First, check Firestore for a user document with the given email.
      const usersRef = collection(db, "users");
      const qEmail = query(usersRef, where("email", "==", email));
      const snap = await getDocs(qEmail);
      if (!snap.empty) {
        setEmailError("An account with this email already exists.");
        return;
      }
      
      // Optionally, if you want additional info from Auth, you can fetch the sign-in methods.
      // But in this case, if no Firestore doc exists, we allow the user to proceed,
      // even if there's an Auth record from an incomplete signup.
      // const methods = await fetchSignInMethodsForEmail(auth, email);
      // if (methods.length > 0) {
      //   setEmailError("This email is associated with an incomplete signup. Please complete your verification.");
      //   return;
      // }
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
      console.log("Attempting to sign up with Google..."); // <-- LOG 1

      const result = await signInWithPopup(auth, googleProvider);
      console.log("Google sign-in popup successful. User object:", result.user); // <-- LOG 2

      // --- Duplicate Email Check Start ---
      const usersRef = collection(db, "users");
      const emailQuery = query(usersRef, where("email", "==", result.user.email));
      
      console.log("Checking if email already exists in Firestore..."); // <-- LOG 3
      const emailSnap = await getDocs(emailQuery);
      
      if (!emailSnap.empty) {
        console.log("Duplicate email found in Firestore. Aborting signup."); // <-- LOG 4
        setError("This email is already associated with an account. Please log in instead.");
        await signOut(auth); // Optionally sign the user out
        return; // Stop further execution
      }
      // --- Duplicate Email Check End ---
      
      console.log("No duplicate email found. Proceeding with signup."); // <-- LOG 5

      // Proceed with Google sign-up if no duplicate found
      setIsGoogleUser(true);
      if (result.user.displayName) {
        setUsername(result.user.displayName.replace(/\s+/g, ""));
      }
      setEmail(result.user.email);
      setSuccessMessage(
        "Google sign-up successful. Please click 'Continue' to create your account."
      );
    } catch (err) {
      console.error("Google signup error:", err); // <-- LOG 6 (This is where your error is happening)
      setError("Failed to sign up with Google. Please try again or use email/password.");
    }
  }; 

  // --------------------------------------
  //  Final signup logic
  // --------------------------------------
  const handleSignup = async () => {
    // --- Step 1: Validate the form ---
    if (!isGoogleUser) {
      // Validation for regular email/password signup
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
      if (!username || !email || !password) {
        setError("All fields are required.");
        return;
      }
    } else {
      // Validation for a user who signed up with Google
      if (!username) {
        setError("Please set a username before continuing.");
        return;
      }
    }

    // --- Step 2: Create the user in the database ---
    try {
      setError("");
      const usersRef = collection(db, "users");

      // Check if user already exists in Firestore before creating
      const emailQuery = query(usersRef, where("email", "==", email));
      const emailSnap = await getDocs(emailQuery);

      if (!emailSnap.empty) {
        setError("An account with this email already exists. Please log in.");
        return;
      }

      // Create the user document in Firestore with a 'free' plan by default
      await addDoc(usersRef, {
        username,
        email,
        plan: "free", // Always 'free' on signup
        createdAt: new Date().toISOString(),
      });
      
      // --- Step 3: Finish and redirect ---
      // Sign out from the temporary signup session so the user can log in properly.
      await signOut(auth);
      // Redirect to the login page with a success message
      navigate("/login?status=activated");

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
