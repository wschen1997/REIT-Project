import React, { useState } from 'react';

// This component will contain all logic and UI for the "Modeling" tab.
// It is designed to look and feel exactly like the "Financials" tab.
const ModelTab = ({ ticker }) => {
  // State to manage which sub-tab (which model) is active
  const [activeModelSubTab, setActiveModelSubTab] = useState('p_ffo');

  // Define the different models we will build
  const modelTabs = [
    { id: 'p_ffo', label: 'P/FFO Multiple' },
    { id: 'p_affo', label: 'P/AFFO Multiple' },
    { id: 'ddm', label: 'Dividend Discount Model' },
    { id: 'ms_ddm', label: 'Multi-stage DDM' },
  ];

  // --- Styles copied directly from DetailPage.js for consistency ---

  // Style for the container holding the sub-tab buttons
  const subTabBarStyle = {
    display: "flex",
    gap: "10px",
    margin: "0 0 15px 0",
  };

  // Style for each individual sub-tab button
  const subTabStyle = (isActive) => ({
    padding: "8px 16px",
    cursor: "pointer",
    backgroundColor: "transparent",
    border: "none",
    fontWeight: isActive ? "bold" : "normal",
    outline: "none",
    transition: "background-color 0.3s, color 0.3s",
    color: isActive ? "#5A153D" : "#333",
    // This matches the Financials sub-tabs, which do not have an underline
    borderBottom: "3px solid transparent",
  });

  return (
    // This outer div provides the same spacing and structure as the Financials tab content
    <div>
      {/* Sub-tab navigation bar */}
      <div style={subTabBarStyle}>
        {modelTabs.map((sub) => {
          const isActive = (sub.id === activeModelSubTab);
          return (
            <button
              key={sub.id}
              onClick={() => setActiveModelSubTab(sub.id)}
              style={subTabStyle(isActive)}
              // onMouseEnter/Leave effects are identical to the Financials sub-tabs
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#faf0fb";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {sub.label}
            </button>
          );
        })}
      </div>

      {/* Conditionally render the content for the active model */}
      {/* We will build out the actual model UI here in the next steps */}
      <div>
        {activeModelSubTab === 'p_ffo' && (
          <div>
            <h3>P/FFO Multiple Valuation for {ticker}</h3>
            <p>This is where we will build the P/FFO model interface and display its results.</p>
          </div>
        )}

        {activeModelSubTab === 'p_affo' && (
          <div>
            <h3>P/AFFO Multiple Valuation for {ticker}</h3>
            <p>This is where the P/AFFO model will go.</p>
          </div>
        )}

        {activeModelSubTab === 'ddm' && (
          <div>
            <h3>Dividend Discount Model for {ticker}</h3>
            <p>This is where the DDM model will go.</p>
          </div>
        )}
        
        {activeModelSubTab === 'ms_ddm' && (
            <div>
              <h3>Multi-stage DDM for {ticker}</h3>
              <p>This is where the multi-stage DDM model will go.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default ModelTab;
