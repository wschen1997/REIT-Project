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

  // Terms with subheadings in bold
  const termsContent = (
    <>
      <p>
        Welcome to viserra-group.com (the “Website”). This Website is operated by Viserra Group (“Viserra”). 
        By accessing or using our Website, you agree to comply with and be bound by these Terms and Conditions (“T&C”). 
        If you do not agree to these T&C, please do not use our Website.
      </p>
      <p>
        <span className="modal-subheading">Acceptance of Terms</span><br />
        By using this Website, you acknowledge that you have read, understood, and agree to be bound by these T&C. 
        Viserra reserves the right to modify these T&C at any time without prior notice. 
        Your continued use of the Website constitutes acceptance of any changes.
      </p>
      <p>
        <span className="modal-subheading">Intellectual Property Rights</span><br />
        All content on this Website, including but not limited to text, graphics, logos, images, 
        and software, is the property of Viserra or its content suppliers and is protected by 
        intellectual property laws. You may not reproduce, distribute, or create derivative 
        works from any content on this Website without express written permission.
      </p>
      <p>
        <span className="modal-subheading">User Obligations</span><br />
        You agree to use the Website only for lawful purposes and in a manner that does not infringe 
        the rights of, restrict, or inhibit anyone else’s use and enjoyment of the Website. 
        Prohibited behavior includes harassing or causing distress or inconvenience to any person, 
        transmitting obscene or offensive content, or disrupting the normal flow of dialogue.
      </p>
      <p>
        <span className="modal-subheading">Products or Services Terms</span><br />
        Viserra provides analytics and data about real estate investments, such as REITs and crowdfunding. 
        The descriptions and data on the Website are for informational purposes only and do not constitute 
        an offer to buy, sell, or invest.
      </p>
      <p>
        <span className="modal-subheading">Guarantees and Warranties</span><br />
        Viserra makes no representations or warranties of any kind, express or implied, as to the operation of 
        the Website or the information, content, materials, or products included on this Website. 
        To the full extent permissible by applicable law, Viserra disclaims all warranties, express or implied.
      </p>
      <p>
        <span className="modal-subheading">Limitation of Liability</span><br />
        Viserra will not be liable for any damages of any kind arising from 
        the use of this Website, including but not limited to direct, 
        indirect, incidental, punitive, and consequential damages.
      </p>
      <p>
        <span className="modal-subheading">Confidentiality</span><br />
        Any confidential information shared by users will be protected and not disclosed without 
        their consent, except as required by law.
      </p>
      <p>
        <span className="modal-subheading">Governing Law</span><br />
        These T&C are governed by and construed in accordance with 
        the laws of the State of Ohio, without regard to its conflict of law principles. 
        Any disputes arising shall be subject to the exclusive jurisdiction of 
        the courts located in Cuyahoga County, Ohio.
      </p>
      <p>
        <span className="modal-subheading">Contact Information</span><br />
        If you have any questions or concerns about these T&C, please contact us 
        using the contact form on our site.
      </p>
    </>
  );

  // Privacy with subheadings in bold
  const privacyContent = (
    <>
      <p>
        <span className="modal-subheading">GDPR Privacy Statement</span><br />
        Viserra Group is committed to protecting your privacy and ensuring that your personal data 
        is handled in compliance with the General Data Protection Regulation (GDPR).
      </p>
      <p>
        <span className="modal-subheading">What Data We Collect:</span><br />
        When you fill out a contact form on our website, we may collect the following information:
      </p>
      <ul>
        <li>Your name</li>
        <li>Your email address</li>
        <li>Your phone number (if provided)</li>
        <li>Any additional information you choose to include in your message</li>
      </ul>
      <p>
        <span className="modal-subheading">How We Use Your Data:</span><br />
        The information you provide will only be used to:
      </p>
      <ul>
        <li>Respond to your inquiries or requests</li>
        <li>Communicate relevant information about our services</li>
      </ul>
      <p>
        <span className="modal-subheading">Data Sharing:</span><br />
        Your personal data will not be shared, sold, or rented to any third parties. 
        It will only be accessible to authorized personnel at Viserra for the purposes outlined above.
      </p>
      <p>
        <span className="modal-subheading">Data Retention:</span><br />
        We will retain your data only for as long as is necessary to fulfill your inquiry 
        and comply with legal or regulatory obligations.
      </p>
      <p>
        <span className="modal-subheading">Your Rights:</span><br />
        Under GDPR, you have the right to:
      </p>
      <ul>
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
        <span className="modal-subheading">Cookies and Tracking Technologies:</span><br />
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
        <div
          className="modal-overlay"
          onClick={(e) => {
            // This checks if the click was on the overlay itself, not the box inside it
            if (e.target === e.currentTarget) {
              setShowTnC(false);
            }
          }}
        >
          <div className="modal-box">
            <button className="sidebar-close-btn" onClick={() => setShowTnC(false)}>
              ×
            </button>
            <h2 className="modal-title">Terms &amp; Conditions</h2>
            <div className="modal-content">
              {termsContent}
            </div>
          </div>
        </div>
      )}

      {/* Privacy Overlay */}
      {showPrivacy && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPrivacy(false);
            }
          }}
        >
          <div className="modal-box">
            <button className="sidebar-close-btn" onClick={() => setShowPrivacy(false)}>
              ×
            </button>
            <h2 className="modal-title">Privacy Policy</h2>
            <div className="modal-content">
              {privacyContent}
            </div>
          </div>
        </div>
      )}

      {/* Bottom banner */}
      <div className={`bottom-banner ${isVisible ? 'visible' : ''}`}>
        {/* Link row */}
        <div className="banner-link-row">
          {links.map((text) => (
            <span
              key={text}
              className="banner-link"
              onClick={() => handleLinkClick(text)}
            >
              {text}
            </span>
          ))}
        </div>

        {/* Disclaimer columns */}
        <div className="disclaimer-container">
          <p className="disclaimer-paragraph">
            All the information presented is collected from official public documents
            such as: earnings presentations, 10-K, 10-Q, 8-K, proxy statements, press releases,
            and company prospectuses or private offering documents for crowdfunded funds and REITs.
          </p>
          <p className="disclaimer-paragraph">
            The data displayed by viserra-group.com is solely for informational purposes.
            We do not recommend the buying, holding, or selling of any assets on this website.
            Please consult a personal licensed financial advisor before making any investment decisions.
          </p>
        </div>

        {/* Copyright */}
        <p className="copyright-text">
          © {new Date().getFullYear()} Viserra Group. All Rights Reserved.
        </p>
      </div>
    </>
  );
}

export default BottomBanner;
