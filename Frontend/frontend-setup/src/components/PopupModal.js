import React from "react";

// A general-purpose popup modal component
function PopupModal({ show, onClose, title, children }) {
  // If the 'show' prop is false, the component renders nothing.
  if (!show) {
    return null;
  }

  return (
    // The modal-overlay class provides the dark, blurred background.
    // Clicking the overlay will close the modal.
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        // This prevents the modal from closing when you click inside the box.
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: 'center', width: '400px' }}// Ensures content inside is centered
      >
        {/* --- 1. ADDED: The top-right close button --- */}
        {/* This reuses the exact same button style from your T&C modal */}
        <button className="sidebar-close-btn" onClick={onClose}>
          ×
        </button>

        {/* The title is passed in as a prop */}
        <h3 style={{ color: "var(--primary-color)", marginTop: 0, paddingTop: '0.5rem' }}>{title}</h3>

        {/* The main content (e.g., a <p> tag) is passed in as children */}
        <div className="modal-content" style={{ color: "var(--text-color-dark)" }}>
          {children}
        </div>

      </div>
    </div>
  );
}

export default PopupModal;