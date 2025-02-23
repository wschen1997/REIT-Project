import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement, // Required for Pie/Donut charts
  Title,
  Tooltip,
  Legend
);

// Load backend URL from environment variable
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function DetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();

  // State for financial data and scoring
  const [financialData, setFinancialData] = useState([]);
  const [stabilityScore, setStabilityScore] = useState(null);
  const [fundamentalScore, setFundamentalScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticker) {
      setError("Ticker is undefined.");
      setLoading(false);
      return;
    }
    // Fetch with include_scores=true to get scoring data along with quarterly data
    fetch(`${API_BASE_URL}/api/reits/${ticker}/financials?include_scores=true`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched financial data:", data);
        // Expect an object with quarterly_data and score values
        if (data.quarterly_data) {
          setFinancialData(data.quarterly_data);
          setStabilityScore(data.stability_percentile);
          setFundamentalScore(data.fundamental_percentile);
        } else if (data.message) {
          setError(data.message);
          setFinancialData([]);
        } else {
          setError("Unexpected response format.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching financial data:", err);
        setError("Error fetching financial data.");
        setLoading(false);
      });
  }, [ticker]);

  if (loading) {
    return (
      <div className="detail-page" style={{ padding: "20px" }}>
        <h2>{ticker} - Detailed Information</h2>
        <p>Loading financial data...</p>
        <button className="back-button" onClick={() => navigate(-1)}>
          Back to Results
        </button>
      </div>
    );
  }

  if (
    error ||
    !Array.isArray(financialData) ||
    financialData.length === 0
  ) {
    return (
      <div className="detail-page" style={{ padding: "20px" }}>
        <h2>{ticker} - Detailed Information</h2>
        <p>{error || "Financial data is unavailable for this REIT."}</p>
        <button className="back-button" onClick={() => navigate(-1)}>
          Back to Results
        </button>
      </div>
    );
  }

  // Extract labels and metric data from the quarterly data
  const labels = financialData.map((item) => item.quarter);
  const ffoData = financialData.map((item) => item.ffo_ps);
  const dvdData = financialData.map((item) => item.dvd);
  const noiData = financialData.map((item) => item.noi_ps);

  // Define chart data for each Bar chart
  const ffoChartData = {
    labels,
    datasets: [
      {
        label: "FFO PS",
        data: ffoData,
        backgroundColor: "rgba(75, 192, 192, 0.6)",
      },
    ],
  };

  const dvdChartData = {
    labels,
    datasets: [
      {
        label: "Dividend",
        data: dvdData,
        backgroundColor: "rgba(153, 102, 255, 0.6)",
      },
    ],
  };

  const noiChartData = {
    labels,
    datasets: [
      {
        label: "NOI PS",
        data: noiData,
        backgroundColor: "rgba(255, 159, 64, 0.6)",
      },
    ],
  };

  // Round the scores
  const stabilityVal = stabilityScore !== null ? Math.round(stabilityScore) : 0;
  const fundamentalVal = fundamentalScore !== null ? Math.round(fundamentalScore) : 0;

  // Build donut chart data for stability
  const stabilityChartData = {
    labels: ["Stability Fill", "Remaining"],
    datasets: [
      {
        data: [stabilityVal, 100 - stabilityVal],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)", // fill color
          "#e0e0e0",                 // background color for remainder
        ],
        borderWidth: 0,
      },
    ],
  };

  // Build donut chart data for fundamental
  const fundamentalChartData = {
    labels: ["Fundamental Fill", "Remaining"],
    datasets: [
      {
        data: [fundamentalVal, 100 - fundamentalVal],
        backgroundColor: [
          "rgba(153, 102, 255, 0.6)",
          "#e0e0e0",
        ],
        borderWidth: 0,
      },
    ],
  };

  // Options for the donut charts
  const donutOptions = {
    responsive: true,
    cutout: "70%", // Creates a donut shape
    plugins: {
      legend: {
        display: false, // Hide the legend for a clean look
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.parsed;
            if (label.includes("Fill")) {
              return `${label}: ${value}%`;
            }
            return null; // Hide "Remaining" portion
          },
        },
      },
    },
  };

  // Shared chart options for the Bar charts
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: {
        display: false, // We'll use an <h3> heading instead
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Inline styles for grid layout
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    margin: "30px 0",
  };

  const blockStyle = {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
    textAlign: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  };

  return (
    <div className="detail-page" style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "20px" }}>{ticker} - Detailed Information</h2>

      {/* Grid container for the 5 blocks (2 donut charts + 3 bar charts) */}
      <div style={gridStyle}>
        {/* Stability Score Block (Donut) */}
        <div style={blockStyle}>
          <h3>Stability Percentile</h3>
          <Doughnut
            data={stabilityChartData}
            options={donutOptions}
            width={100}
            height={100}
          />
          <p style={{ marginTop: "10px" }}>
            {stabilityScore !== null ? `${stabilityVal}/100` : "N/A"}
          </p>
        </div>

        {/* Fundamental Score Block (Donut) */}
        <div style={blockStyle}>
          <h3>Fundamental Percentile</h3>
          <Doughnut
            data={fundamentalChartData}
            options={donutOptions}
            width={100}
            height={100}
          />
          <p style={{ marginTop: "10px" }}>
            {fundamentalScore !== null ? `${fundamentalVal}/100` : "N/A"}
          </p>
        </div>

        {/* FFO PS Block */}
        <div style={blockStyle}>
          <h3>FFO per Share</h3>
          <Bar data={ffoChartData} options={chartOptions} height={220} />
        </div>

        {/* Dividend Block */}
        <div style={blockStyle}>
          <h3>Dividend</h3>
          <Bar data={dvdChartData} options={chartOptions} height={220} />
        </div>

        {/* NOI PS Block */}
        <div style={blockStyle}>
          <h3>NOI per Share</h3>
          <Bar data={noiChartData} options={chartOptions} height={220} />
        </div>
      </div>

      <button className="back-button" onClick={() => navigate(-1)}>
        Back to Filter Page
      </button>
    </div>
  );
}

export default DetailPage;
