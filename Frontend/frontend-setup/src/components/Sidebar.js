import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from '../context/ThemeContext.js';
import ThemeSwitcher from './ThemeSwitcher.js';

const Sidebar = ({ isOpen, onClose, currentUser }) => {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  const menu = [
    { label: "About Us", path: "/about" },
    { label: "Contact Us", path: "/contact" },
    // { label: "Valuation Model", path: "/model" },
    { label: "Subscription", path: "/pricing" },
    { label: "REITs Screener", path: "/filter" },
  ];

  const handleAccountClick = () => {
    if (currentUser) {
      navigate('/user');
    } else {
      navigate('/login');
    }
    onClose();
  };

  return (
    <aside
      className="sidebar"
      style={{
        left: isOpen ? 0 : "-260px",
      }}
    >
      {/* This div no longer needs any special flex styles */}
      <div>
        <button className="sidebar-close-btn" onClick={onClose}>
          ×
        </button>

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
            className="header-logo"
          />
        </div>

        <div
          className="sidebar-link"
          onClick={handleAccountClick}
        >
          My Account
        </div>

        {menu.map(({ label, path }) => (
          <div
            key={label}
            className="sidebar-link"
            onClick={() => { navigate(path); onClose(); }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* THIS IS THE FIX:
        We wrap the ThemeSwitcher in a div and use absolute positioning
        to lock it to the bottom of the sidebar.
      */}
      <div style={{
        position: 'absolute',
        bottom: '20px', // <-- THIS is the space from the bottom. Change this value to adjust the height.
        left: '0',
        width: '100%'
      }}>
        <ThemeSwitcher />
      </div>

    </aside>
  );
};

export default Sidebar;

