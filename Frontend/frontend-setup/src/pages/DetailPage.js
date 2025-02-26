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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement, // For Pie/Donut
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function DetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();

  // Basic company info
  const [companyName, setCompanyName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");

  // Additional fields
  const [propertyType, setPropertyType] = useState(null);
  const [yearFounded, setYearFounded] = useState(null);
  const [numbersEmployee, setNumbersEmployee] = useState(null);
  const [website, setWebsite] = useState(null);
  const [totalAssetsM, setTotalAssetsM] = useState(null);
  const [fiveYrFFOGrowth, setFiveYrFFOGrowth] = useState(null);

  // Financial data & scoring
  const [financialData, setFinancialData] = useState([]);
  const [stabilityScore, setStabilityScore] = useState(null);
  const [fundamentalScore, setFundamentalScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Utility: check if an array is entirely null/undefined
  const isAllNull = (arr) => arr.every((val) => val == null);

  // Utility: convert float-like values to int (treat NaN as null)
  const parseIntOrNull = (val) => {
    if (val == null) return null;
    const num = typeof val === "number" ? val : Number(val);
    if (Number.isNaN(num)) return null;
    return Math.round(num); // Round to whole number
  };

  useEffect(() => {
    if (!ticker) {
      setError("Ticker is undefined.");
      setLoading(false);
      return;
    }

    // 1) Fetch single REIT’s data
    fetch(`${API_BASE_URL}/api/reits?ticker=${ticker}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Backend data from /api/reits:", data);
        if (data.reits && data.reits.length > 0) {
          // Find the object whose Ticker matches our URL param
          const reit = data.reits.find((r) => r.Ticker === ticker);

          if (!reit) {
            console.error("No matching Ticker found in returned data:", ticker);
            return; // or set some error state
          }

          console.log("Single REIT record by ticker:", reit);
          console.log("All REIT fields:", JSON.stringify(reit, null, 2));

          setCompanyName(reit.Company_Name || "");
          setBusinessDescription(reit.Business_Description || "");

          // Additional fields
          setPropertyType(reit.Property_Type ?? null);

          // Convert yearFounded & numbersEmployee to whole integers
          setYearFounded(parseIntOrNull(reit.Year_Founded));
          setNumbersEmployee(parseIntOrNull(reit.Numbers_Employee));

          setWebsite(reit.Website ?? null);
          setTotalAssetsM(reit.Total_Real_Estate_Assets_M_ ?? null);

          // Negative FFO growth is fine; we just store the raw number:
          setFiveYrFFOGrowth(reit["5yr_FFO_Growth"] ?? null);
        }
      })
      .catch((err) => {
        console.error("Error fetching REIT info:", err);
      });

    // 2) Fetch financials + scores
    fetch(`${API_BASE_URL}/api/reits/${ticker}/financials?include_scores=true`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Backend data from /api/reits/:ticker/financials:", data);
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

  if (error || !Array.isArray(financialData) || financialData.length === 0) {
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

  // Extract metrics for bar charts
  const labels = financialData.map((item) => item.quarter);
  const ffoData = financialData.map((item) => item.ffo_ps);
  const dvdData = financialData.map((item) => item.dvd);
  const noiData = financialData.map((item) => item.noi_ps);

  // Bar chart data
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

  // Round scores
  const stabilityVal = stabilityScore != null ? Math.round(stabilityScore) : 0;
  const fundamentalVal =
    fundamentalScore != null ? Math.round(fundamentalScore) : 0;

  // Donut charts
  const stabilityChartData = {
    labels: ["Stability Fill", "Remaining"],
    datasets: [
      {
        data: [stabilityVal, 100 - stabilityVal],
        backgroundColor: ["rgba(75, 192, 192, 0.6)", "#e0e0e0"],
        borderWidth: 0,
      },
    ],
  };
  const fundamentalChartData = {
    labels: ["Fundamental Fill", "Remaining"],
    datasets: [
      {
        data: [fundamentalVal, 100 - fundamentalVal],
        backgroundColor: ["rgba(153, 102, 255, 0.6)", "#e0e0e0"],
        borderWidth: 0,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.parsed;
            if (label.includes("Fill")) {
              return `${label}: ${value}%`;
            }
            return null;
          },
        },
      },
    },
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  // Helper to safely display a field or "No Data" (treat NaN as null)
  const safeDisplay = (value) => {
    if (value == null || Number.isNaN(value)) {
      return "No Data";
    }
    return value;
  };

  // Format FFO Growth as e.g. 3.0% if input is 0.03 (allow negative numbers)
  const formatFFOGrowth = (val) => {
    if (val == null || Number.isNaN(val)) return "No Data";
    const percent = (val * 100).toFixed(1); // e.g. 0.03 => "3.0"
    return `${percent}%`;
  };

  // Format total assets as e.g. $1,234 million
  const formatAssets = (val) => {
    if (val == null) return "No Data";
    const numVal = typeof val === "number" ? val : Number(val);
    if (Number.isNaN(numVal)) {
      return "No Data";
    }
    return `$${numVal.toLocaleString()} million`;
  };

  // Inline styles for the layout
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
      {/* Name & description */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>{companyName}</h2>
        <p style={{ marginTop: "10px" }}>{businessDescription}</p>
      </div>

      {/* Business Statistics Table */}
      <div style={{ marginBottom: "30px" }}>
        <h3>Business Statistics</h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "10px",
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Property Type
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {safeDisplay(propertyType)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Year Founded
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {safeDisplay(yearFounded)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Number of Employees
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {safeDisplay(numbersEmployee)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Website
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007bff" }}
                  >
                    {website}
                  </a>
                ) : (
                  "No Data"
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Total Real Estate Assets
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {formatAssets(totalAssetsM)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                5yr FFO Growth
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {formatFFOGrowth(fiveYrFFOGrowth)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 style={{ marginBottom: "20px" }}>
        {ticker} - Detailed Information
      </h2>

      {/* 2 Donut charts + 3 Bar charts */}
      <div style={gridStyle}>
        {/* Stability */}
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

        {/* Fundamental */}
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

        {/* FFO */}
        <div style={blockStyle}>
          <h3>FFO per Share</h3>
          {isAllNull(ffoData) ? (
            <p>No FFO data available.</p>
          ) : (
            <Bar data={ffoChartData} options={chartOptions} height={220} />
          )}
        </div>

        {/* Dividend */}
        <div style={blockStyle}>
          <h3>Dividend</h3>
          {isAllNull(dvdData) ? (
            <p>No Dividend data available.</p>
          ) : (
            <Bar data={dvdChartData} options={chartOptions} height={220} />
          )}
        </div>

        {/* NOI */}
        <div style={blockStyle}>
          <h3>NOI per Share</h3>
          {isAllNull(noiData) ? (
            <p>No NOI data available.</p>
          ) : (
            <Bar data={noiChartData} options={chartOptions} height={220} />
          )}
        </div>
      </div>

      <button className="back-button" onClick={() => navigate(-1)}>
        Back to Filter Page
      </button>
    </div>
  );
}

export default DetailPage;
