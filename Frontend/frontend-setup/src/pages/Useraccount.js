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

  return (
    <div className="App">
      <h1 style={{ textAlign: "center", marginBottom: "1.5rem" }}>My Account</h1>
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          background: "#fff",
          padding: "30px",
          borderRadius: "10px",
          boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)"
        }}
      >
        <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          <strong>Username:</strong> {userData.username}
        </p>
        <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          <strong>Email:</strong> {userData.email}
        </p>
        <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          <strong>Registered Date:</strong>{" "}
          {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : "N/A"}
        </p>
        <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          <strong>Current Plan:</strong> {userData.plan}
        </p>
      </div>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
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
        style={{
            padding: "10px 20px",
            fontSize: "16px",
            borderRadius: "5px",
            backgroundColor: "#5A153D",
            color: "#fff",
            border: "none",
            cursor: "pointer",
        }}
        >
        Back to Home
        </button>
      </div>
      <BottomBanner />
    </div>
  );
};

export default Useraccount;
