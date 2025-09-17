import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import Loading from "../components/Loading.js";
import PopupModal from "../components/PopupModal.js";


const Useraccount = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isGoogle = user.providerData.some(
          (provider) => provider.providerId === 'google.com'
        );
        setIsGoogleUser(isGoogle);

        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setUserData(data);
        } else {
          console.error("No user document found");
          navigate("/signup");
        }
      } else {
        navigate("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleChangePassword = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const actionCodeSettings = {
          url: `${window.location.origin}/login?passwordReset=true`,
        };
        await sendPasswordResetEmail(auth, user.email, actionCodeSettings);
        setPopupTitle("Check Your Email");
        setPopupMessage("A password reset link has been sent to your inbox. Please follow the instructions to update your password.");
        setShowPopup(true);
      } catch (error) {
        console.error("Error sending password reset email:", error);
        setPopupTitle("Error");
        setPopupMessage("Could not send password reset email. Please try again later.");
        setShowPopup(true);
      }
    }
  };

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        navigate("/login");
      })
      .catch((error) => {
        console.error("Sign out error", error);
      });
  };

  if (loading) {
    return <Loading />;
  }

  if (!userData) {
    return (
      <div className="user-account-page" style={{ padding: "2rem" }}>
        User data not available.
      </div>
    );
  }

  return (
    <div className="user-account-page">
      <div className="user-account-container">
        <h2 className="user-account-main-title">My Account</h2>
        <hr className="user-account-hr" />

        {/* --- MODIFIED: Section now uses flexbox for balanced spacing --- */}
        <div className="user-account-section">
          <h2 className="user-account-section-title">User Information</h2>
          {/* This new div controls the spacing of the rows below */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.3rem' }}>
            <div className="user-account-info-row">
              <strong className="user-account-info-label">Username:</strong>
              <div className="user-account-value-with-icon">
                <span className="user-account-info-value">{userData.username}</span>

                {/* New Sign Out Icon with Tooltip */}
                <div className="signout-icon-wrapper" onClick={handleSignOut}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  <span className="tooltip-text-right">Sign Out</span>
                </div>
              </div>
            </div>
            <div className="user-account-info-row">
              <strong className="user-account-info-label">Email:</strong>
              <span className="user-account-info-value">{userData.email}</span>
            </div>
            <div className="user-account-info-row no-border">
              <strong className="user-account-info-label">Registered Date:</strong>
              <span className="user-account-info-value">
                {userData.createdAt
                  ? new Date(userData.createdAt).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>

            {/* --- MODIFIED: This entire block is now conditional and restyled --- */}
            {!isGoogleUser && (
              <div className="user-account-info-row no-border" style={{ justifyContent: 'flex-start', paddingTop: '1rem' }}>
                <button
                  onClick={handleChangePassword}
                  className="btn btn-primary-outline btn-sm"
                >
                  Change Password
                </button>
              </div>
            )}
          </div>
        </div>

        {/* --- MODIFIED: Section now uses flexbox for balanced spacing --- */}
        <div className="user-account-section">
          <h2 className="user-account-section-title">Subscription</h2>
          {/* This new div controls the spacing of the row below */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.3rem' }}>
            <div className="user-account-info-row no-border">
              <strong className="user-account-info-label">Current Plan:</strong>
              <span className="user-account-plan-value">{userData.plan}</span>
            </div>
          </div>
        </div>

        <div className="user-account-buttons">
          <button
            onClick={() => navigate("/")}
            className="btn btn-primary-outline btn-sm"
          >
            Back to Home
          </button>
          
          {userData.plan === "free" && (
            <button
              onClick={() => navigate("/pricing")}
              className="btn btn-primary btn-sm"
            >
              Upgrade to Premium
            </button>
          )}
        </div>
      </div>
      
      <PopupModal 
        show={showPopup} 
        onClose={() => setShowPopup(false)} 
        title={popupTitle}
      >
        <p>{popupMessage}</p>
      </PopupModal>

    </div>
  );
};

export default Useraccount;