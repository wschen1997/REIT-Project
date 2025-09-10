import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomBanner from "../components/BottomBanner.js";
import PopupModal from "../components/PopupModal.js";
import Loading from "../components/Loading.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function ContactUs() {
  const navigate = useNavigate();

  // --- This logic remains completely unchanged ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- This logic remains completely unchanged ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !message.trim()) {
      alert("Please fill out all fields before submitting.");
      return;
    }

    setIsLoading(true);

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
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 1. Added inline style to reduce vertical padding */}
      <div className="contact-page" style={{ padding: "40px 20px" }}>
        <div className="contact-page-container">
          {/* 2. Added inline style to reduce margin-bottom */}
          <h1 className="contact-page-title" style={{ marginBottom: "25px" }}>
            Contact Us
          </h1>
          
          {/* 3. NEW WRAPPER with inline style to control width and alignment */}
          <div style={{ maxWidth: "800px" }}>
            {/* 4. Added inline style to override max-width from the class and reduce margin */}
            <p className="contact-page-subtitle" style={{ maxWidth: "none", marginBottom: "30px" }}>
              We’d love to hear from you. Whether you have a question about our platform, need support, or want to share feedback—please fill out the form below and we’ll get back to you as soon as possible.
            </p>
            {!submitted ? (
              // 5. Added inline style to reduce gap between form elements
              <form onSubmit={handleSubmit} className="contact-form" style={{ gap: "15px" }}>
                <div className="contact-form-grid">
                  <div>
                    <label htmlFor="firstName" className="contact-form-label">First Name *</label>
                    <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="input-field contact-form-input" />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="contact-form-label">Last Name *</label>
                    <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="input-field contact-form-input" />
                  </div>
                  <div>
                    <label htmlFor="email" className="contact-form-label">Email Address *</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field contact-form-input" />
                  </div>
                </div>
                <div className="contact-form-group">
                  <label htmlFor="message" className="contact-form-label">Your Message *</label>
                  <textarea id="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required className="input-field contact-form-textarea" />
                </div>
                
                {errorMessage && (
                  <p className="error-message contact-error-message">
                    {errorMessage}
                  </p>
                )}

                <button type="submit" className="btn btn-primary contact-submit-btn">
                  Submit Message
                </button>
              </form>
            ) : (
              <p className="contact-success-message">
                Thank you for contacting us! We’ll be in touch soon.
              </p>
            )}
          </div>
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