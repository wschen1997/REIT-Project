import React from "react";

function PopupModal({ show, onClose, title, children }) {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: 'center', width: '400px' }}
      >
        <button className="sidebar-close-btn" onClick={onClose}>
          ×
        </button>

        {/* --- MODIFIED LINE --- */}
        {/* We've added a class and removed the inline color style */}
        <h3 className="popup-modal-title" style={{ marginTop: 0, paddingTop: '0.5rem' }}>
          {title}
        </h3>

        <div className="modal-content" style={{ color: "var(--text-color-dark)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default PopupModal;