import React from "react";
import { useNavigate } from "react-router-dom";

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const menu = [
    { label: "Real Estate Crowdfundings", path: "/Crowdfunding" },
    { label: "REITs Screener",            path: "/filter"       },
    { label: "Pricing",                   path: "/pricing"      },
    { label: "About Us",                  path: "/about"        },
    { label: "Contact Us",                path: "/contact"      },
  ];

  return (
    <aside
      style={{
        position   : "fixed",
        top        : 0,
        left       : isOpen ? 0 : "-260px",
        width      : 260,
        height     : "100vh",
        background : "#fff",
        color      : "#5A153D",
        borderRight: "1px solid #eee",
        paddingTop : 80,             // space for header
        transition : "left .25s ease",
        zIndex     : 1200,
      }}
      onMouseLeave={onClose}
    >
      {menu.map(({ label, path }) => (
        <div
          key={label}
          className="nav-link"
          style={{
            padding: "14px 24px",
            cursor : "pointer",
            fontSize: "1.05rem",
          }}
          onClick={() => { navigate(path); onClose(); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#faf0fb"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {label}
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
