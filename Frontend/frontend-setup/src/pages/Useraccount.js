import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase.js";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import BottomBanner from "../components/BottomBanner.js";
import { useUser, useAuth } from "@clerk/clerk-react";
import Loading from "../components/Loading.js";

const Useraccount = () => {
  const navigate = useNavigate();
  const { isSignedIn, user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const fetchFirestoreData = async () => {
      if (isSignedIn && user) {
        const userEmail = user.primaryEmailAddress.emailAddress;
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", userEmail));

        try {
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            setUserData(snapshot.docs[0].data());
          } else {
            const newUserData = {
              username: user.username || user.firstName || user.primaryEmailAddress.emailAddress.split('@')[0],
              email: user.primaryEmailAddress.emailAddress,
              plan: "free",
              createdAt: new Date().toISOString(),
            };
            
            const userDocRef = doc(db, "users", user.id);
            await setDoc(userDocRef, newUserData);
            setUserData(newUserData);
          }
        } catch (error) {
          console.error("Error fetching or creating user data in Firestore:", error);
        }
      } else {
        navigate("/clerk-signin");
      }
      setLoading(false);
    };

    fetchFirestoreData();
  }, [isLoaded, isSignedIn, user, navigate, signOut]);

  if (loading) {
    return <Loading />;
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
    textAlign: "left",
  };

  const sectionStyle = {
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "24px",
    marginBottom: "20px",
  };
  
  const infoRowStyle = {
    display: "flex",
    justifyContent: "space-between",
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
    <div className="App" style={{ paddingTop: "1rem" }}>
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