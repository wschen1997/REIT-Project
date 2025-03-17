import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function BottomBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showTnC, setShowTnC] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Add bottom padding so main content doesn't get covered by the banner
    document.body.style.paddingBottom = "180px";

    const handleScroll = () => {
      // Show the banner if user is near the bottom
      const scrolledToBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 50;
      setIsVisible(scrolledToBottom);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.body.style.paddingBottom = "0";
    };
  }, []);

  // Banner slides up from the bottom
  const bannerStyle = {
    position: "fixed",
    left: 0,
    bottom: 0,
    width: "100%",
    backgroundColor: "#fff",
    color: "#333",
    boxShadow: "0 -2px 6px rgba(0, 0, 0, 0.1)",
    zIndex: 1000,
    transition: "transform 0.4s ease-in-out",
    transform: isVisible ? "translateY(0%)" : "translateY(100%)",
    padding: "20px 20px 5px 20px",
  };

  // Link row
  const linkRowStyle = {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
    justifyContent: "center",
    fontSize: "1rem",
    fontWeight: "500",
  };

  // Each link color & hover
  const linkStyle = {
    color: "#5A153D",
    cursor: "pointer",
    textDecoration: "none",
    transition: "color 0.1s ease",
  };
  const handleLinkMouseEnter = (e) => {
    e.currentTarget.style.color = "#B12D78";
  };
  const handleLinkMouseLeave = (e) => {
    e.currentTarget.style.color = "#5A153D";
  };

  // Disclaimer columns
  const disclaimerContainerStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: "20px",
    maxWidth: "1300px",
    margin: "0 auto",
    textAlign: "left",
    flexWrap: "wrap",
  };
  const paragraphStyle = {
    flex: 1,
    fontSize: "0.95rem",
    lineHeight: "1.6",
    margin: 0,
  };

  // The nav link array
  const links = ["About Us", "Terms", "Privacy", "Contact Us"];

  // Handle link clicks
  const handleLinkClick = (text) => {
    if (text === "About Us") {
      navigate("/about");
    } else if (text === "Terms") {
      setShowTnC(true);
    } else if (text === "Privacy") {
      setShowPrivacy(true);
    } else if (text === "Contact Us") {
      navigate("/contact");
    } else {
      console.log(`${text} clicked (not yet implemented)`);
    }
  };

  // Overlays
  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  // Common box style
  const boxStyle = {
    backgroundColor: "#fff",
    width: "clamp(400px, 80%, 700px)",
    borderRadius: "8px",
    padding: "2rem",
    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
    maxHeight: "80vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
  };

  // Subheading style
  const subheadingStyle = {
    fontWeight: "bold",
    color: "#333",
  };

  // Terms with subheadings in bold
  const termsContent = (
    <>
      <p>
        Welcome to viserra-group.com (the “Website”). This Website is operated by Viserra Group (“Viserra”). 
        By accessing or using our Website, you agree to comply with and be bound by these Terms and Conditions (“T&C”). 
        If you do not agree to these T&C, please do not use our Website.
      </p>
      <p>
        <span style={subheadingStyle}>Acceptance of Terms</span><br />
        By using this Website, you acknowledge that you have read, understood, and agree to be bound by these T&C. 
        Viserra reserves the right to modify these T&C at any time without prior notice. 
        Your continued use of the Website constitutes acceptance of any changes.
      </p>
      <p>
        <span style={subheadingStyle}>Intellectual Property Rights</span><br />
        All content on this Website, including but not limited to text, graphics, logos, images, 
        and software, is the property of Viserra or its content suppliers and is protected by 
        intellectual property laws. You may not reproduce, distribute, or create derivative 
        works from any content on this Website without express written permission.
      </p>
      <p>
        <span style={subheadingStyle}>User Obligations</span><br />
        You agree to use the Website only for lawful purposes and in a manner that does not infringe 
        the rights of, restrict, or inhibit anyone else’s use and enjoyment of the Website. 
        Prohibited behavior includes harassing or causing distress or inconvenience to any person, 
        transmitting obscene or offensive content, or disrupting the normal flow of dialogue.
      </p>
      <p>
        <span style={subheadingStyle}>Products or Services Terms</span><br />
        Viserra provides analytics and data about real estate investments, such as REITs and crowdfunding. 
        The descriptions and data on the Website are for informational purposes only and do not constitute 
        an offer to buy, sell, or invest.
      </p>
      <p>
        <span style={subheadingStyle}>Guarantees and Warranties</span><br />
        Viserra makes no representations or warranties of any kind, express or implied, as to the operation of 
        the Website or the information, content, materials, or products included on this Website. 
        To the full extent permissible by applicable law, Viserra disclaims all warranties, express or implied.
      </p>
      <p>
        <span style={subheadingStyle}>Limitation of Liability</span><br />
        Viserra will not be liable for any damages of any kind arising from 
        the use of this Website, including but not limited to direct, 
        indirect, incidental, punitive, and consequential damages.
      </p>
      <p>
        <span style={subheadingStyle}>Confidentiality</span><br />
        Any confidential information shared by users will be protected and not disclosed without 
        their consent, except as required by law.
      </p>
      <p>
        <span style={subheadingStyle}>Governing Law</span><br />
        These T&C are governed by and construed in accordance with 
        the laws of the State of Ohio, without regard to its conflict of law principles. 
        Any disputes arising shall be subject to the exclusive jurisdiction of 
        the courts located in Cuyahoga County, Ohio.
      </p>
      <p>
        <span style={subheadingStyle}>Contact Information</span><br />
        If you have any questions or concerns about these T&C, please contact us 
        using the contact form on our site.
      </p>
    </>
  );

  // Privacy with subheadings in bold
  const privacyContent = (
    <>
      <p>
        <span style={subheadingStyle}>GDPR Privacy Statement</span><br />
        Viserra Group is committed to protecting your privacy and ensuring that your personal data 
        is handled in compliance with the General Data Protection Regulation (GDPR).
      </p>
      <p>
        <span style={subheadingStyle}>What Data We Collect:</span><br />
        When you fill out a contact form on our website, we may collect the following information:
      </p>
      <ul style={{ marginLeft: "1rem" }}>
        <li>Your name</li>
        <li>Your email address</li>
        <li>Your phone number (if provided)</li>
        <li>Any additional information you choose to include in your message</li>
      </ul>
      <p>
        <span style={subheadingStyle}>How We Use Your Data:</span><br />
        The information you provide will only be used to:
      </p>
      <ul style={{ marginLeft: "1rem" }}>
        <li>Respond to your inquiries or requests</li>
        <li>Communicate relevant information about our services</li>
      </ul>
      <p>
        <span style={subheadingStyle}>Data Sharing:</span><br />
        Your personal data will not be shared, sold, or rented to any third parties. 
        It will only be accessible to authorized personnel at Viserra for the purposes outlined above.
      </p>
      <p>
        <span style={subheadingStyle}>Data Retention:</span><br />
        We will retain your data only for as long as is necessary to fulfill your inquiry 
        and comply with legal or regulatory obligations.
      </p>
      <p>
        <span style={subheadingStyle}>Your Rights:</span><br />
        Under GDPR, you have the right to:
      </p>
      <ul style={{ marginLeft: "1rem" }}>
        <li>Access your personal data</li>
        <li>Request corrections to your data</li>
        <li>Request deletion of your data</li>
        <li>Withdraw your consent for data processing</li>
      </ul>
      <p>
        To exercise these rights or for any questions regarding our privacy practices, 
        please contact us at support@viserra-group.com.
      </p>
      <p>
        <span style={subheadingStyle}>Cookies and Tracking Technologies:</span><br />
        Viserra Group may use cookies or similar tracking technologies to enhance your browsing experience 
        and collect anonymous data about website usage. By using our website, you consent to our use of cookies. 
        For details on managing cookies, please adjust your browser settings.
      </p>
      <p>
        Viserra Group is committed to maintaining the confidentiality and security of your personal data.
      </p>
    </>
  );

  return (
    <>
      {/* T&C Overlay */}
      {showTnC && (
        <div style={overlayStyle}>
          <div style={boxStyle}>
            <h2 style={{ marginTop: 0, color: "#333" }}>Terms &amp; Conditions</h2>
            <div style={{ fontSize: "0.95rem", lineHeight: "1.5" }}>
              {termsContent}
            </div>
            <button
              style={{
                alignSelf: "flex-end",
                backgroundColor: "#5A153D",
                color: "#fff",
                border: "none",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                borderRadius: "4px",
                cursor: "pointer",
                marginTop: "1rem",
              }}
              onClick={() => setShowTnC(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Privacy Overlay */}
      {showPrivacy && (
        <div style={overlayStyle}>
          <div style={boxStyle}>
            <h2 style={{ marginTop: 0, color: "#333" }}>Privacy Policy</h2>
            <div style={{ fontSize: "0.95rem", lineHeight: "1.5" }}>
              {privacyContent}
            </div>
            <button
              style={{
                alignSelf: "flex-end",
                backgroundColor: "#5A153D",
                color: "#fff",
                border: "none",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                borderRadius: "4px",
                cursor: "pointer",
                marginTop: "1rem",
              }}
              onClick={() => setShowPrivacy(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Bottom banner */}
      <div style={bannerStyle}>
        {/* Link row */}
        <div style={linkRowStyle}>
          {links.map((text) => (
            <span
              key={text}
              style={linkStyle}
              onMouseEnter={handleLinkMouseEnter}
              onMouseLeave={handleLinkMouseLeave}
              onClick={() => handleLinkClick(text)}
            >
              {text}
            </span>
          ))}
        </div>

        {/* Disclaimer columns */}
        <div style={disclaimerContainerStyle}>
          <p style={paragraphStyle}>
            All the information presented is collected from official public documents
            such as: earnings presentations, 10-K, 10-Q, 8-K, proxy statements, press releases,
            and company prospectuses or private offering documents for crowdfunded funds and REITs.
          </p>
          <p style={paragraphStyle}>
            The data displayed by viserra-group.com is solely for informational purposes.
            We do not recommend the buying, holding, or selling of any assets on this website.
            Please consult a personal licensed financial advisor before making any investment decisions.
          </p>
        </div>

        {/* Copyright */}
        <p style={{ textAlign: "center", fontSize: "0.8rem", marginTop: "18px", color: "#666" }}>
          © {new Date().getFullYear()} Viserra Group. All Rights Reserved.
        </p>
      </div>
    </>
  );
}

export default BottomBanner;
