import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from '../context/ThemeContext.js';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  const menu = [
    { label: "REITs Screener", path: "/filter" },
    { label: "About Us", path: "/about" },
    { label: "Contact Us", path: "/contact" },
    { label: "Valuation Model", path: "/model" },
    { label: "Pricing", path: "/pricing" },
  ];

  return (
    // The 'left' style remains inline as it's controlled by component state.
    <aside
      className="sidebar"
      style={{
        left: isOpen ? 0 : "-260px",
      }}
    >
      {/* Replaced inline styles and hover handlers with a clean className */}
      <button className="sidebar-close-btn" onClick={onClose}>
        ×
      </button>

      {/* This logo section's styles were fine and remain unchanged */}
      <div
        onClick={() => { navigate("/"); onClose(); }}
        style={{
          padding: "10px 24px 20px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <img
          src={theme === 'dark' ? '/logo-dark-mode.png' : '/logo-crop.PNG'}
          alt="Viserra Logo"
          style={{ maxWidth: "100%", maxHeight: 60 }}
        />
      </div>

      {/* Replaced inline styles and hover handlers with a clean className */}
      {menu.map(({ label, path }) => (
        <div
          key={label}
          className="sidebar-link"
          onClick={() => { navigate(path); onClose(); }}
        >
          {label}
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;

