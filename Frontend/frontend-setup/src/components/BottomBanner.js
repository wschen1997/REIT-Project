import React, { useEffect, useState } from "react";

function BottomBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Add bottom padding so main content doesn't get covered by the banner
    document.body.style.paddingBottom = "180px";

    const handleScroll = () => {
      // Show the banner if the user is near the bottom
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

  // The banner slides up from the bottom
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
    padding: "20px",
    paddingBottom: "5px",
  };

  // The nav link row
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

  // Container for the two disclaimers side by side
  const disclaimerContainerStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: "20px",          // Slightly reduced gap
    maxWidth: "1300px",   // Widened container
    margin: "0 auto",
    textAlign: "left",
    flexWrap: "wrap",
  };

  // Each column
  const paragraphStyle = {
    flex: 1,
    fontSize: "0.95rem",
    lineHeight: "1.6",
    margin: 0,
  };

  return (
    <div style={bannerStyle}>
      {/* Link row */}
      <div style={linkRowStyle}>
        {["About Us", "FAQ", "Terms", "Privacy", "Contact Us"].map((text) => (
          <span
            key={text}
            style={linkStyle}
            onMouseEnter={handleLinkMouseEnter}
            onMouseLeave={handleLinkMouseLeave}
          >
            {text}
          </span>
        ))}
      </div>

      {/* Disclaimer columns */}
      <div style={disclaimerContainerStyle}>
        <p style={paragraphStyle}>
          All the information presented is collected from official public documents 
          such as: earnings presentations, 10-K, 10-Q, 8-K, proxy statements, press releases, and company
          prospectuses or private offering documents for crowdfunded funds and REITs.
        </p>
        <p style={paragraphStyle}>
          The data displayed by viserra-group.com is solely for informational purposes. 
          We do not recommend the buying, holding, or selling of any assets on this website. 
          Please consult a personal licensed financial advisor before making any investment decisions.
        </p>
      </div>
       {/* Copyright Notice */}
        <p style={{ textAlign: "center", fontSize: "0.8rem", marginTop: "18px", color: "#666" }}>
        © {new Date().getFullYear()} Viserra Group. All Rights Reserved.
        </p>
    </div>
  );
}

export default BottomBanner;
