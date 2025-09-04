// Useraccount.js – MODIFIED FOR SUPABASE
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase.js";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import BottomBanner from "../components/BottomBanner.js";
// --- CHANGE #1: Import Supabase hook instead of Clerk ---
import { useSessionContext } from "@supabase/auth-helpers-react";
import Loading from "../components/Loading.js";

const Useraccount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState('profile');
  // --- CHANGE #2: Get session from Supabase context ---
  const { session, isLoading } = useSessionContext();
  const user = session?.user;

  const [userData, setUserData] = useState(null);
  // --- CHANGE #3: Use Supabase's isLoading state ---
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.pathname.includes('/subscription')) {
      setActiveTab('subscription');
    } else {
      setActiveTab('profile');
    }
  }, [location.pathname]);

  useEffect(() => {
    // --- CHANGE #4: Check Supabase's loading state ---
    if (isLoading) {
      setLoading(true);
      return;
    }

    const fetchFirestoreData = async () => {
      // --- CHANGE #5: Check for Supabase session and user ---
      if (session && user) {
        // --- CHANGE #6: Get email and ID from Supabase user object ---
        const userEmail = user.email;
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", userEmail));

        try {
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            setUserData(snapshot.docs[0].data());
          } else {
            // Logic to create a new user in Firestore is preserved
            const newUserData = {
              // Get username from email as a fallback
              username: user.user_metadata.full_name || user.email.split('@')[0],
              email: user.email,
              plan: "free",
              createdAt: new Date().toISOString(),
            };
            
            // Use the Supabase user ID for the document reference
            const userDocRef = doc(db, "users", user.id);
            await setDoc(userDocRef, newUserData);
            setUserData(newUserData);
          }
        } catch (error) {
          console.error("Error fetching or creating user data in Firestore:", error);
        }
      } else {
        // --- CHANGE #7: Navigate to the new login page ---
        navigate("/login");
      }
      setLoading(false);
    };

    fetchFirestoreData();
  // --- CHANGE #8: Update dependency array for Supabase hooks ---
  }, [isLoading, session, user, navigate]);

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

  const containerStyle = {
    maxWidth: "700px",
    margin: "0 30px",
    padding: "0 30px",
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
    fontSize: "0.82rem"
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

  const tabStyle = (isActive) => ({
    padding: "10px 20px",
    cursor: "pointer",
    backgroundColor: "transparent",
    border: "none",
    fontWeight: isActive ? "bold" : "normal",
    color: isActive ? "#5A153D" : "#333",
    borderBottom: isActive ? "3px solid #5A153D" : "3px solid transparent",
    outline: "none",
    transition: "background-color 0.3s, color 0.3s",
  });

  return (
    <div className="App" style={{ paddingTop: "0.5rem" }}>
      <div style={containerStyle}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>My Account</h2>
        
        <div style={{ display: "flex", gap: "20px", borderBottom: "1px solid #ccc", marginBottom: "20px" }}>
          <button
            onClick={() => navigate('/user')}
            style={tabStyle(activeTab === 'profile')}
            onMouseEnter={(e) => {
              if (activeTab !== 'profile') {
                e.currentTarget.style.backgroundColor = "#faf0fb";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Profile & Security
          </button>
          <button
            onClick={() => navigate('/user/subscription')}
            style={tabStyle(activeTab === 'subscription')}
            onMouseEnter={(e) => {
              if (activeTab !== 'subscription') {
                e.currentTarget.style.backgroundColor = "#faf0fb";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Subscription
          </button>
        </div>

        {/* --- CHANGE #9: Replace Clerk's <UserProfile /> with a simple display --- */}
        {activeTab === 'profile' && (
          <div style={sectionStyle}>
            <h2 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '15px', fontSize: '1.02rem'}}>
              Profile
            </h2>
            <div style={{...infoRowStyle, borderBottom: 'none'}}>
              <span style={{color: '#555', paddingRight: '10px'}}>Email:</span>
              <span style={{fontWeight: 'bold'}}>{userData.email}</span>
            </div>
            <p style={{marginTop: '20px', fontSize: '0.9rem', color: '#666'}}>
              To manage your account details, please log in through your identity provider (e.g., Google).
            </p>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div style={sectionStyle}>
            <h2 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '15px', fontSize: '1.02rem'}}>Subscription</h2>
            <div style={{...infoRowStyle, borderBottom: 'none'}}>
              <span style={{color: '#555', paddingRight: '10px'}}>Current plan:</span>
              <span style={{textTransform: 'capitalize', fontWeight: 'bold'}}>{userData.plan}</span>
            </div>
          </div>
        )}

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