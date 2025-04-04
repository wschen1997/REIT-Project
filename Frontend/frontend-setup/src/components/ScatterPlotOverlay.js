// ScatterPlotOverlay.js
import React, { useState, useEffect } from "react";
import { Scatter } from "react-chartjs-2";
import { Chart as ChartJS, PointElement, LinearScale, Tooltip, Legend } from "chart.js";

ChartJS.register(PointElement, LinearScale, Tooltip, Legend);

const ScatterPlotOverlay = ({ propertyTypes = [], onClose, currentREIT, fetchPeerData }) => {
  // If the REIT belongs to multiple property types, show a tab for each.
  // propertyTypes should be an array of strings.
  const [selectedType, setSelectedType] = useState(propertyTypes[0] || "");
  const [peerData, setPeerData] = useState(null);

  // Fetch peer data when the selected type changes.
  // fetchPeerData should be a function provided via props that returns a promise.
  useEffect(() => {
    if (selectedType && fetchPeerData) {
      fetchPeerData(selectedType).then((data) => setPeerData(data));
    }
  }, [selectedType, fetchPeerData]);

  // Configure scatter chart data.
  // Here we assume that peerData is an array of objects with x and y fields.
  // You can also include a special point for the current REIT.
  const chartData = {
    datasets: [
      {
        label: "Peers",
        data: peerData || [],
        backgroundColor: "rgba(177, 45, 120, 0.8)",
      },
      // Optionally add the current REIT’s point.
      {
        label: currentREIT?.ticker || "Current REIT",
        data: currentREIT ? [{ x: currentREIT.xValue, y: currentREIT.yValue }] : [],
        backgroundColor: "rgba(90, 21, 61, 0.8)",
        pointRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    scales: {
      x: { title: { display: true, text: "Metric X" } },
      y: { title: { display: true, text: "Metric Y" } },
    },
    plugins: {
      tooltip: { mode: "nearest", intersect: true },
      legend: { display: true },
    },
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
      }}
    >
      <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", width: "80%", maxWidth: "800px", maxHeight: "90%", overflowY: "auto", position: "relative" }}>
        {/* Close button */}
        <button onClick={onClose} style={{ position: "absolute", top: "10px", right: "10px", background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>
          &times;
        </button>
        {/* Tabs for property types if more than one */}
        {propertyTypes.length > 1 && (
          <div style={{ display: "flex", borderBottom: "1px solid #ccc", marginBottom: "10px" }}>
            {propertyTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: selectedType === type ? "#faf0fb" : "transparent",
                  border: "none",
                  borderBottom: selectedType === type ? "3px solid #5A153D" : "none",
                  cursor: "pointer",
                  fontWeight: selectedType === type ? "bold" : "normal",
                  transition: "background 0.3s",
                }}
              >
                {type}
              </button>
            ))}
          </div>
        )}
        {/* Scatter Chart */}
        <Scatter data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default ScatterPlotOverlay;
