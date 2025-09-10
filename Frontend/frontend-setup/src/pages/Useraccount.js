import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import BottomBanner from "../components/BottomBanner.js";
import Loading from "../components/Loading.js";

const Useraccount = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- This logic remains completely unchanged ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
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

        <div className="user-account-section">
          <h2 className="user-account-section-title">User Information</h2>
          <div className="user-account-info-row">
            <strong className="user-account-info-label">Username:</strong>
            <span className="user-account-info-value">{userData.username}</span>
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
        </div>

        <div className="user-account-section">
          <h2 className="user-account-section-title">Subscription</h2>
          <div className="user-account-info-row no-border">
            <strong className="user-account-info-label">Current Plan:</strong>
            <span className="user-account-plan-value">{userData.plan}</span>
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
      <BottomBanner />
    </div>
  );
};

export default Useraccount;