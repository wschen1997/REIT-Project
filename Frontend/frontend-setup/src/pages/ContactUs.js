import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.js";
import BottomBanner from "../components/BottomBanner.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function ContactUs() {
  const navigate = useNavigate();

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  // For controlling success popup
  const [submitted, setSubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !message.trim()) {
      alert("Please fill out all fields before submitting.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          message,
        }),
      });

      const result = await response.json();
      console.log("Server response:", result);

      if (response.ok) {
        setSubmitted(true);
        setShowPopup(true);
        // Reset form fields
        setFirstName("");
        setLastName("");
        setEmail("");
        setMessage("");
      } else {
        console.error("Failed to submit data:", result);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <>
      <Header />

      {/* Main Container */}
      <div
        style={{
          backgroundColor: "#fff",
          color: "#333",
          minHeight: "100vh",
          padding: "60px 20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "2.5rem",
              color: "#5A153D",
              marginBottom: "40px",
              textAlign: "left",
            }}
          >
            Contact Us
          </h1>

          <p
            style={{
              fontSize: "1rem",
              color: "#444",
              lineHeight: "1.6",
              maxWidth: "600px",
              marginBottom: "40px",
              textAlign: "left",
            }}
          >
            We’d love to hear from you. Whether you have a question about our platform,
            need support, or want to share feedback—please fill out the form below and
            we’ll get back to you as soon as possible.
          </p>

          {/* Contact Form */}
          {!submitted ? (
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                maxWidth: "800px",
              }}
            >
              {/* Name & Email row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)", // 3 equal columns
                  columnGap: "50px",                     // smaller gap horizontally
                  rowGap: "0px",                          // no vertical gap in this row
                  alignItems: "start",                    // top-align label + input
                }}
              >
                {/* First Name */}
                <div>
                  <label
                    htmlFor="firstName"
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    First Name *
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ccc",
                      borderRadius: "5px",
                      fontSize: "1rem",
                      fontFamily: "inherit",
                      height: "40px", // Ensures all inputs are the same height
                      boxSizing: "border-box", // Prevents padding from affecting width/height
                      display: "block", // Prevents inline inconsistencies
                      verticalAlign: "middle", // Aligns text inside the box properly // Prevents padding from affecting width/height
                    }}
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label
                    htmlFor="lastName"
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Last Name *
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ccc",
                      borderRadius: "5px",
                      fontSize: "1rem",
                      fontFamily: "inherit",
                      height: "40px", // Ensures all inputs are the same height
                      boxSizing: "border-box", // Prevents padding from affecting width/height
                      display: "block", // Prevents inline inconsistencies
                      verticalAlign: "middle", // Aligns text inside the box properly // Prevents padding from affecting width/height
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ccc",
                      borderRadius: "5px",
                      fontSize: "1rem",
                      fontFamily: "inherit",
                      height: "40px", // Ensures all inputs are the same height
                      boxSizing: "border-box", // Prevents padding from affecting width/height
                      display: "block", // Prevents inline inconsistencies
                      verticalAlign: "middle", // Aligns text inside the box properly
                    }}
                  />
                </div>
              </div>

              {/* Message field */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label
                  htmlFor="message"
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                    textAlign: "left",
                  }}
                >
                  Your Message *
                </label>
                <textarea
                  id="message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ccc",
                    borderRadius: "5px",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  backgroundColor: "#5A153D",
                  color: "#fff",
                  padding: "10px 20px",
                  fontSize: "1rem",
                  borderRadius: "5px",
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Submit Message
              </button>
            </form>
          ) : (
            <p
              style={{
                color: "#5A153D",
                fontWeight: "bold",
                marginTop: "20px",
                fontSize: "1.2rem",
                textAlign: "left",
              }}
            >
              Thank you for contacting us! We’ll be in touch soon.
            </p>
          )}
        </div>
      </div>

      {/* Success Popup Modal */}
      {showPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "10px",
              textAlign: "center",
              width: "300px",
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ color: "#5A153D" }}>Thank You!</h3>
            <p style={{ color: "#333", fontSize: "1rem", lineHeight: "1.5" }}>
              Your message has been received. We’ll respond as soon as possible.
            </p>
            <button
              onClick={() => setShowPopup(false)}
              style={{
                backgroundColor: "#5A153D",
                color: "#fff",
                padding: "8px 15px",
                border: "none",
                cursor: "pointer",
                borderRadius: "5px",
                marginTop: "10px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <BottomBanner />
    </>
  );
}

export default ContactUs;
