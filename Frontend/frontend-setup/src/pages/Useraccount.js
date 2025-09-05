import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import BottomBanner from "../components/BottomBanner.js";

const Useraccount = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

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
    return (
      <div className="App" style={{ padding: "2rem", textAlign: "center" }}>
        Loading...
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="App" style={{ padding: "2rem", textAlign: "center" }}>
        User data not available.
      </div>
    );
  }

  // --- Style definitions for the new look ---
  const containerStyle = {
    maxWidth: "700px",
    margin: "0 30px",
    padding: "0 20px",
    textAlign: "left", // This will now correctly align everything inside
  };

  const sectionStyle = {
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "24px",
    marginBottom: "20px",
  };
  
  const infoRowStyle = {
    display: "flex",
    justifyContent: "space-between", // Changed back to space-between for clean columns
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f0f0f0",
    fontSize: "1rem"
  };

  const buttonContainerStyle = {
    display: "flex",
    justifyContent: "flex-start",
    gap: "15px",
    marginTop: "30px",
  };

  const buttonStyle = {
    padding: "10px 20px",
    fontSize: "16px",
    borderRadius: "5px",
    backgroundColor: "#5A153D",
    color: "#fff",
    border: "2px solid #5A153D",
    cursor: "pointer",
    transition: "background-color 0.2s, color 0.2s"
  };

  return (
    // We leave the outer "App" div alone as it's part of the global layout
    <div className="App" style={{ paddingTop: "1rem" }}>
      {/* We add a NEW container div inside to control this page's specific layout */}
      <div style={containerStyle}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1.75rem" }}>My Account</h2>
        
        <hr style={{ border: "none", borderBottom: "1px solid #e0e0e0", marginBottom: "2rem" }} />
        
        <div style={sectionStyle}>
            <h2 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '15px', fontSize: '1.5rem'}}>User Information</h2>
            <div style={infoRowStyle}>
                <strong style={{color: '#555'}}>Username:</strong>
                <span>{userData.username}</span>
            </div>
            <div style={infoRowStyle}>
                <strong style={{color: '#555'}}>Email:</strong>
                <span>{userData.email}</span>
            </div>
             <div style={{...infoRowStyle, borderBottom: 'none'}}>
                <strong style={{color: '#555'}}>Registered Date:</strong>
                <span>{userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : "N/A"}</span>
            </div>
        </div>

        <div style={sectionStyle}>
            <h2 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '15px', fontSize: '1.5rem'}}>Subscription</h2>
             <div style={{...infoRowStyle, borderBottom: 'none'}}>
                <strong style={{color: '#555'}}>Current Plan:</strong>
                <span style={{textTransform: 'capitalize', fontWeight: 'bold'}}>{userData.plan}</span>
            </div>
        </div>

        <div style={buttonContainerStyle}>
          <button
            onClick={() => navigate("/")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#faf0fb";
              e.currentTarget.style.color = "#5A153D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#5A153D";
              e.currentTarget.style.color = "#fff";
            }}
            style={buttonStyle}
          >
            Back to Home
          </button>

          {userData.plan === 'free' && (
            <button
              onClick={() => navigate('/pricing')}
               onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#faf0fb";
                e.currentTarget.style.color = "#5A153D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#5A153D";
                e.currentTarget.style.color = "#fff";
              }}
              style={buttonStyle}
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
