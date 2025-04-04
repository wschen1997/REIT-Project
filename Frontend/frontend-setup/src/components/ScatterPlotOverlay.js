import React, { useState, useEffect } from "react";
import { Scatter } from "react-chartjs-2";

// 1) Import the plugins
import {
  Chart as ChartJS,
  PointElement,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import ChartDataLabels from "chartjs-plugin-datalabels";

// Register the base chart features plus the plugins
ChartJS.register(
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
  annotationPlugin,
  ChartDataLabels
);

const ScatterPlotOverlay = ({ propertyTypes = [], onClose, currentREIT, API_BASE_URL }) => {
  // Use the first property type by default if multiple exist
  const [selectedType, setSelectedType] = useState(propertyTypes[0] || "");
  const [peerData, setPeerData] = useState([]);

  // Fetch peer data when the selected type changes
  useEffect(() => {
    if (selectedType && API_BASE_URL) {
      fetch(`${API_BASE_URL}/api/peer-scatter?property_type=${encodeURIComponent(selectedType)}`)
        .then((res) => res.json())
        .then((data) => {
          // Remove the current REIT from the peer list if it's in there
          // so we don't get duplicates in both sets
          const filtered = currentREIT
            ? data.filter((item) => item.ticker !== currentREIT.ticker)
            : data;
          setPeerData(filtered);
        })
        .catch((err) => {
          console.error("Error fetching peer data:", err);
          setPeerData([]);
        });
    }
  }, [selectedType, API_BASE_URL, currentREIT]);

  // Data label styling to simulate a "speech bubble" background
  const dataLabelStyle = {
    backgroundColor: "rgba(128, 128, 128, 0.1)", // Slightly transparent grey
    borderColor: "black",
    borderWidth: 1,
    borderRadius: 4,
    color: "#333",
    padding: 4,
    // Attempt to avoid collisions (not perfect, but helps)
    overlap: false,
    // Position label away from the dot
    anchor: "end",
    align: "end",
    offset: 8,
    // Keep label inside chart if possible
    clamp: true,
    formatter: (value, context) => {
      const dataObj = context.dataset.data[context.dataIndex];
      return dataObj.ticker || "";
    },
  };

  // Build the chart data
  const chartData = {
    datasets: [
      {
        label: "Peers",
        // Make peers a bit bigger on hover
        pointRadius: 6,
        pointHoverRadius: 8,
        data: peerData,
        backgroundColor: "rgba(177, 45, 120, 0.8)",
        datalabels: dataLabelStyle,
      },
      {
        label: currentREIT?.ticker || "Current REIT",
        // Make the current REIT dot larger, and also bigger on hover
        pointRadius: 10,
        pointHoverRadius: 12,
        data: currentREIT
          ? [{ x: currentREIT.xValue, y: currentREIT.yValue, ticker: currentREIT.ticker }]
          : [],
        backgroundColor: "rgba(90, 21, 61, 0.8)",
        datalabels: dataLabelStyle,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      tooltip: {
        mode: "nearest",
        intersect: true,
        callbacks: {
          label: (ctx) => {
            const xVal = ctx.parsed.x;
            const yVal = ctx.parsed.y;
            // Round to one decimal
            const formattedX = xVal.toFixed(1);
            const formattedY = yVal.toFixed(1);

            const dataObj = ctx.dataset.data[ctx.dataIndex];
            const ticker = dataObj.ticker || ctx.dataset.label;

            return `${ticker}: (Stability: ${formattedX}, Fundamental: ${formattedY})`;
          },
        },
      },
      legend: { display: true },
      // Vertical/horizontal midlines
      annotation: {
        annotations: {
          xMidline: {
            type: "line",
            xMin: 50,
            xMax: 50,
            borderColor: "rgba(0, 0, 0, 0.4)",
            borderWidth: 1,
          },
          yMidline: {
            type: "line",
            yMin: 50,
            yMax: 50,
            borderColor: "rgba(0, 0, 0, 0.4)",
            borderWidth: 1,
          },
        },
      },
      // Let the dataset-level "datalabels" config handle the style
      datalabels: {},
    },
    scales: {
        x: {
          title: {
            display: true,
            text: "Stability Percentile",
            color: "#5A153D", // Your theme color
            font: { weight: "bold", size: 14 } // Increased font size here
          },
          min: 0,
          max: 100,
        },
        y: {
          title: {
            display: true,
            text: "Fundamental Percentile",
            color: "#5A153D", // Your theme color
            font: { weight: "bold", size: 14 } // Increased font size here
          },
          min: 0,
          max: 100,
        },
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
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "1250px",
          maxHeight: "90%",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#B12D78";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#5A153D";
          }}
          style={{
            position: "absolute",
            top: "5px",
            right: "5px",
            background: "transparent",
            border: "none",
            fontSize: "1.8rem",
            cursor: "pointer",
          }}
        >
          &times;
        </button>

        {/* Tabs if multiple property types */}
        {propertyTypes.length > 1 && (
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #ccc",
              marginBottom: "10px",
              paddingRight: "20px",
              paddingLeft: "20px",
            }}
          >
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
                  // Slightly rounded corners for the toggles
                  borderRadius: "6px",
                  // If selected, keep bottom radius 0 so the line doesn't look weird
                  ...(selectedType === type
                    ? { borderRadius: "6px 6px 0 0" }
                    : {}),
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
