import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomBanner from "../components/BottomBanner.js";
import PopupModal from "../components/PopupModal.js";
import Loading from "../components/Loading.js"; 

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function ContactUs() {
  const navigate = useNavigate();

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  // Control states
  const [submitted, setSubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false); // --- 2. ADD the isLoading state

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !message.trim()) {
      alert("Please fill out all fields before submitting.");
      return;
    }

    setIsLoading(true); // --- 3. SET loading to true before the API call

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
        setErrorMessage(result.message || "Sorry, we couldn't send your message. Please try again.");
        console.error("Failed to submit data:", result);
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred. Please check your connection and try again.");
      console.error("Error submitting form:", error);
    } finally {
      setIsLoading(false); // --- 4. SET loading to false after the call is finished
    }
  };

  return (
    <>
      <div style={{ backgroundColor: "#fff", color: "#333", minHeight: "100vh", padding: "60px 20px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "2.5rem", color: "#5A153D", marginBottom: "40px", textAlign: "left" }}>
            Contact Us
          </h1>
          <p style={{ fontSize: "1rem", color: "#444", lineHeight: "1.6", maxWidth: "600px", marginBottom: "40px", textAlign: "left" }}>
            We’d love to hear from you. Whether you have a question about our platform, need support, or want to share feedback—please fill out the form below and we’ll get back to you as soon as possible.
          </p>
          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "800px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", columnGap: "50px", rowGap: "0px", alignItems: "start" }}>
                <div>
                  <label htmlFor="firstName" style={{ display: "block", marginBottom: "5px", fontWeight: "bold", textAlign: "left", whiteSpace: "nowrap" }}>First Name *</label>
                  <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "5px", fontSize: "1rem", fontFamily: "inherit", height: "40px", boxSizing: "border-box", display: "block", verticalAlign: "middle" }} />
                </div>
                <div>
                  <label htmlFor="lastName" style={{ display: "block", marginBottom: "5px", fontWeight: "bold", textAlign: "left", whiteSpace: "nowrap" }}>Last Name *</label>
                  <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "5px", fontSize: "1rem", fontFamily: "inherit", height: "40px", boxSizing: "border-box", display: "block", verticalAlign: "middle" }} />
                </div>
                <div>
                  <label htmlFor="email" style={{ display: "block", marginBottom: "5px", fontWeight: "bold", textAlign: "left", whiteSpace: "nowrap" }}>Email Address *</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "5px", fontSize: "1rem", fontFamily: "inherit", height: "40px", boxSizing: "border-box", display: "block", verticalAlign: "middle" }} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="message" style={{ display: "block", marginBottom: "5px", fontWeight: "bold", textAlign: "left" }}>Your Message *</label>
                <textarea id="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "5px", fontSize: "1rem", fontFamily: "inherit", resize: "vertical" }} />
              </div>
              
              {errorMessage && (
                <p className="error-message" style={{ margin: "-10px 0", textAlign: "left" }}>
                  {errorMessage}
                </p>
              )}

              <button type="submit" onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#faf0fb"; e.currentTarget.style.color = "#5A153D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#5A153D"; e.currentTarget.style.color = "#fff"; }} style={{ backgroundColor: "#5A153D", color: "#fff", padding: "10px 20px", fontSize: "1rem", border: "none", borderRadius: "5px", cursor: "pointer", alignSelf: "flex-start" }}>
                Submit Message
              </button>
            </form>
          ) : (
            <p style={{ color: "#5A153D", fontWeight: "bold", marginTop: "20px", fontSize: "1.2rem", textAlign: "left" }}>
              Thank you for contacting us! We’ll be in touch soon.
            </p>
          )}
        </div>
      </div>

      <PopupModal
        show={showPopup}
        onClose={() => setShowPopup(false)}
        title="Thank You!"
      >
        <p>
          Your message has been received. We’ll respond as soon as possible.
        </p>
      </PopupModal>
      
      {isLoading && <Loading />} 
      <BottomBanner />
    </>
  );
}

export default ContactUs;