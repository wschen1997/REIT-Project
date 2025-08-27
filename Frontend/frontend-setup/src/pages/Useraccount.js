import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase.js";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import BottomBanner from "../components/BottomBanner.js";
import { useUser, useAuth, UserProfile } from "@clerk/clerk-react";
import Loading from "../components/Loading.js";

const Useraccount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState('profile');
  const { isSignedIn, user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.pathname.includes('/subscription')) {
      setActiveTab('subscription');
    } else {
      setActiveTab('profile');
    }
  }, [location.pathname]);

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

        {activeTab === 'profile' && (
          <div style={{marginTop: '20px'}}>
            <UserProfile
              path="/user"
              appearance={{
                elements: {
                  cardBox: {
                    boxShadow: 'none',
                    borderRadius: '0px',
                    border: '1px solid #e0e0e0'
                  },
                  footer: {
                    display: 'none'
                  }
                }
              }}
            />
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

        {/* --- MODIFICATION START: Buttons are now outside the tabs --- */}
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
        {/* --- MODIFICATION END --- */}

      </div>
      <BottomBanner />
    </div>
  );
};

export default Useraccount;