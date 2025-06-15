// Sidebar.js – logo left‑aligned, hover‑close removed, “X” button added
import React from "react";
import { useNavigate } from "react-router-dom";

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const menu = [
    { label: "REITs Screener",            path: "/filter"       },
    { label: "About Us",                  path: "/about"        },
    { label: "Contact Us",                path: "/contact"      },
    { label: "Valuation Model",           path: "/model"        },
    {/* label: "Pricing",                   path: "/pricing"  */},
    {/* label: "Real Estate Crowdfundings", path: "/Crowdfunding" */},
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
        paddingTop : 7,
        transition : "left .25s ease",
        zIndex     : 1301,    // above the blur overlay
        overflowY  : "auto",
      }}
    >
      {/* ───────── Close (X) button ───────── */}
      <div
        onClick={onClose}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#faf0fb";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
        style={{
          position     : "absolute",
          top          : 10,
          right        : 10,
          width        : 28,
          height       : 28,
          lineHeight   : "28px",
          textAlign    : "center",
          fontSize     : 20,
          fontWeight   : "bold",
          cursor       : "pointer",
          borderRadius : "50%",
          color        : "#5A153D",
          transition   : "background .2s",
          userSelect   : "none",
        }}
      >
        ×
      </div>

      {/* ───────── Logo (left‑aligned) ───────── */}
      <div
        onClick={() => { navigate("/"); onClose(); }}
        style={{
          padding   : "10px 24px 20px",
          cursor    : "pointer",
          userSelect: "none",
        }}
      >
        <img
          src="/logo-crop.PNG"
          alt="Viserra Logo"
          style={{ maxWidth: "100%", maxHeight: 60 }}
        />
      </div>

      {/* ───────── Menu links ───────── */}
      {menu.map(({ label, path }) => (
        <div
          key={label}
          className="nav-link"
          style={{
            padding : "14px 24px",
            cursor  : "pointer",
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
