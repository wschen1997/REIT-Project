import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";

// Register only the essential Chart.js components.
ChartJS.register(ArcElement, Tooltip);

/**
 * A reusable modal overlay component to display a scoring donut chart in a two-column layout.
 * @param {object} props - Component props.
 * @param {number} props.score - The score value (0-100) to display.
 * @param {string} props.title - The title to display above the donut chart.
 * @param {string} props.tooltipText - The text for the info tooltip.
 * @param {object} props.donutOptions - The chart options object for the donut.
 * @param {function} props.onClose - The function to call when the overlay should be closed.
 */
const ScoringDonutOverlay = ({ score, title, tooltipText, donutOptions, onClose }) => {
  if (score === null || score === undefined) {
    return null;
  }

  const scoreVal = Math.round(score);

  // This chart data configuration is now simpler, as options are passed via props.
  const donutChartData = {
    labels: ["Score", "Remaining"],
    datasets: [
      {
        data: [scoreVal, 100 - scoreVal],
        backgroundColor: ["#5A153D", "#e0e0e0"],
        borderWidth: 0,
        datalabels: { display: false },
      },
    ],
  };

  return (
    // Full-screen overlay
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
      }}
    >
      {/* Main modal container */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "800px", // Increased width for the two-column layout
          maxHeight: "90%",
          display: "flex", // Use Flexbox for columns
          gap: "20px",     // Space between columns
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#B12D78"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#5A153D"; }}
          style={{
            position: "absolute", top: "10px", right: "10px",
            background: "transparent", border: "none", fontSize: "1.8rem",
            cursor: "pointer", color: "#5A153D", lineHeight: 1,
          }}
        >
          &times;
        </button>

        {/* --- LEFT COLUMN: The Donut Chart --- */}
        <div style={{ flex: 1, textAlign: 'center', padding: '20px', borderRight: '1px solid #eee' }}>
          <h4>
            {title}
            <span
              className="tooltip-icon"
              style={{
                marginLeft: "6px", cursor: "pointer", fontSize: "0.8rem",
                width: "14px", height: "14px", display: "inline-block",
                textAlign: "center", lineHeight: "16px",
              }}
            >
              i
              <span className="tooltip-text">{tooltipText}</span>
            </span>
          </h4>
          <div style={{ width: "200px", margin: "20px auto 0" }}>
            <Doughnut data={donutChartData} options={donutOptions} />
          </div>
          <p style={{ marginTop: "20px", fontSize: '1.2rem' }}>
            {`${scoreVal}/100`}
          </p>
        </div>

        {/* --- RIGHT COLUMN: Blank space for future content --- */}
        <div style={{ flex: 1, padding: '20px' }}>
          {/* This area is intentionally left blank for now */}
          <h4>About this Score</h4>
          <p style={{color: '#666', fontSize: '0.9rem'}}>Further details and methodology will be added here soon.</p>
        </div>

      </div>
    </div>
  );
};

export default ScoringDonutOverlay;