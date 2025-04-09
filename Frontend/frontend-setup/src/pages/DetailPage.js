import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bar, Doughnut } from "react-chartjs-2";
import BottomBanner from "../components/BottomBanner.js";
import ScatterPlotOverlay from "../components/ScatterPlotOverlay.js";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { feature } from "topojson-client";
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,   
  PointElement,  
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  TimeScale,
  LineElement, 
  PointElement, 
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

/**************************************************
 * 1) SUBCOMPONENT: FinancialsTable
 *    Fetches from /api/reits/<ticker>/statements/quarterly?type=...
 *    Then pivots to wide layout:
 *      Rows = line_item
 *      Columns = each (fiscal_year, fiscal_quarter)
 **************************************************/
function FinancialsTable({ ticker, subTab }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Safely parse JSON, replacing "NaN" with null
  async function fetchAndParseJSON(url) {
    const response = await fetch(url);
    const rawText = await response.text();
    const safeText = rawText.replace(/\bNaN\b/g, "null");
    return JSON.parse(safeText);
  }

  useEffect(() => {
    if (!ticker) return;

    async function fetchData() {
      setLoading(true);
      setError("");
      setRows([]);

      try {
        const data = await fetchAndParseJSON(
          `${API_BASE_URL}/api/reits/${ticker}/statements/quarterly?type=${subTab}`
        );
        console.log("Fetched financial statements data:", data);

        if (data.error) {
          setError(data.error);
        } else if (data.message) {
          setError(data.message);
        } else {
          setRows(data.rows || []);
        }
      } catch (err) {
        console.error("Failed to load financial statements:", err);
        setError("Network error while fetching statements.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ticker, subTab]);

  if (loading) return <p>Loading {subTab.toUpperCase()}...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (rows.length === 0) return <p>No data available for {subTab.toUpperCase()}.</p>;

  // Pivot rows => wide format
  const pivotMap = {};
  const allCols = new Set();

  rows.forEach((r) => {
    const {
      line_item,
      fiscal_year,
      fiscal_quarter,
      value,
      excel_row_index
    } = r;
  
    // If it's the first time we see this line_item:
    if (!pivotMap[line_item]) {
      pivotMap[line_item] = {
        excelRowIndex: excel_row_index,
        columns: {}
      };
    } else {
      // If line_item repeats with a different excel_row_index, keep the earliest
      pivotMap[line_item].excelRowIndex = Math.min(
        pivotMap[line_item].excelRowIndex,
        excel_row_index
      );
    }
  
    const qPart = fiscal_quarter ? `Q${fiscal_quarter}` : "Annual";
    const colLabel = `${qPart}-${fiscal_year}`;
  
    pivotMap[line_item].columns[colLabel] = value; 
  
    // Collect this colLabel for later sorting
    allCols.add(colLabel);
  });  

  // Sort columns by year & quarter ascending
  const sortedCols = Array.from(allCols).sort((a, b) => {
    const [qA, yA] = a.split("-");
    const [qB, yB] = b.split("-");
    const yearA = parseInt(yA, 10);
    const yearB = parseInt(yB, 10);
    const quarterA = qA.startsWith("Q") ? parseInt(qA.slice(1), 10) : 4;
    const quarterB = qB.startsWith("Q") ? parseInt(qB.slice(1), 10) : 4;
    if (yearA !== yearB) return yearA - yearB;
    return quarterA - quarterB;
  });

  const lineItems = Object.keys(pivotMap).sort((a, b) => {
    return pivotMap[a].excelRowIndex - pivotMap[b].excelRowIndex;
  });  

  // Let the table horizontally scroll
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table
        style={{
          borderCollapse: "collapse",
          whiteSpace: "nowrap",
          minWidth: "700px" // ensures table doesn't collapse too narrowly
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f2f2f2" }}>
            <th
              style={{
                border: "1px solid #ccc",
                padding: "8px",
                position: "sticky",
                left: 0,
                // Use a solid color (not transparent) for the first column
                backgroundColor: "#f2f2f2",
                textAlign: "left"
              }}
            >
              Line Item
            </th>
            {sortedCols.map((colLabel) => (
              <th
                key={colLabel}
                style={{
                  border: "1px solid #ccc",
                  padding: "8px",
                  minWidth: "100px"
                }}
              >
                {colLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li, idx) => {
            // Alternate row background
            const rowBackground = idx % 2 === 1 ? "#fafafa" : "#fff";
            // IMPORTANT: Access the nested 'columns' property.
            const colMap = pivotMap[li].columns;
            return (
              <tr key={li} style={{ backgroundColor: rowBackground }}>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "8px",
                    position: "sticky",
                    left: 0,
                    backgroundColor: rowBackground
                  }}
                >
                  {li}
                </td>
                {sortedCols.map((colLabel) => {
                  // Get the complete cell object instead of just a value
                  const val = colMap[colLabel];
                  const displayVal = val != null ? val.toLocaleString() : "";
                  return (
                    <td
                      key={colLabel}
                      style={{
                        border: "1px solid #ccc",
                        padding: "8px",
                        minWidth: "100px"
                      }}
                    >
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/****************************************************
 * 2) MAIN COMPONENT: DetailPage
 ****************************************************/
function DetailPage({ userPlan }) {
  const { ticker } = useParams();
  const navigate = useNavigate();

  // Keep the exact states – no new states, no reordering
  const [activeTab, setActiveTab] = useState("overview");
  const [financialSubTab, setFinancialSubTab] = useState("is");

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
  const [targetPrice, setTargetPrice] = useState(null);

  // Map & Diversification Fields
  const [usInvestmentRegions, setUSInvestmentRegions] = useState([]);
  const [overseasInvestment, setOverseasInvestment] = useState([]);

  // Price data for the line chart
  const [priceData, setPriceData] = useState([]);

  // Financial data & scoring
  const [financialData, setFinancialData] = useState([]);
  const [stabilityScore, setStabilityScore] = useState(null);
  const [fundamentalScore, setFundamentalScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // For the geographical map
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Overlay
  const [showOverlay, setShowOverlay] = useState(false);

  // Utility
  const isAllNull = (arr) => arr.every((val) => val == null);
  const parseIntOrNull = (val) => {
    if (val == null) return null;
    const num = typeof val === "number" ? val : Number(val);
    if (Number.isNaN(num)) return null;
    return Math.round(num);
  };

  // For propertyType array
  const propertyTypeArray = propertyType ? propertyType.split(",").map(t => t.trim()) : [];

  // US State map, if it's needed
  const US_STATE_MAP = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
    KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
    MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
    NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
    ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
    RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
    TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
    WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
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
        if (data.reits && data.reits.length > 0) {
          const reit = data.reits.find((r) => r.Ticker === ticker);
          if (!reit) {
            console.error("No matching Ticker found in returned data:", ticker);
            return;
          }
          setCompanyName(reit.Company_Name || "");
          setBusinessDescription(reit.Business_Description || "");
          setPropertyType(reit.Property_Type ?? null);
          setYearFounded(parseIntOrNull(reit.Year_Founded));
          setNumbersEmployee(parseIntOrNull(reit.Numbers_Employee));
          setWebsite(reit.Website ?? null);
          setTotalAssetsM(reit.Total_Real_Estate_Assets_M_ ?? null);
          setTargetPrice(reit["Target_Price"] ?? null);
          setFiveYrFFOGrowth(reit["5yr_FFO_Growth"] ?? null);

          // Convert US states
          if (reit.US_Investment_Regions) {
            const statesList = reit.US_Investment_Regions.split(", ")
              .map((st) => st.trim())
              .filter(Boolean);
            // Map to full names
            const fullStates = statesList
              .map((st) => US_STATE_MAP[st] || st)
              .filter(Boolean);
            setUSInvestmentRegions(fullStates);
          }
          // Convert overseas
          if (reit.Overseas_Investment) {
            setOverseasInvestment(
              reit.Overseas_Investment.split(", ").map((c) => c.trim())
            );
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching REIT info:", err);
      });

    // 2) Fetch daily price & volume
    fetch(`${API_BASE_URL}/api/reits/${ticker}/price`)
      .then((res) => res.json())
      .then((data) => {
        if (data.price_data && data.price_data.length > 0) {
          setPriceData(data.price_data);
        } else if (data.message) {
          console.warn(data.message);
        }
      })
      .catch((err) => {
        console.error("Error fetching price data:", err);
      });

    // 3) Fetch financials + scores
    fetch(`${API_BASE_URL}/api/reits/${ticker}/financials?include_scores=true`)
      .then((res) => res.json())
      .then((data) => {
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
        <h2>{ticker} - Analytics Dashboard</h2>
        <p>Loading Analytics Dashboard...</p>
        <button className="back-button" onClick={() => navigate(-1)}>
          Back to Results
        </button>
      </div>
    );
  }

  // ------------------------------------
  // Chart logic (Overview)
  // ------------------------------------
  const labels = financialData.map((item) => item.quarter);
  const ffoData = financialData.map((item) => item.ffo_ps);
  const dvdData = financialData.map((item) => item.dvd);
  const noiData = financialData.map((item) => item.noi_ps);

  function makeBarOptions(labelText) {
    return {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.parsed.y;
              return `${labelText}: $${val.toFixed(1)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { display: false },
          ticks: {
            callback: function (value) {
              return Number(value).toFixed(1);
            },
          },
        },
        x: { grid: { display: false } },
      },
    };
  }

  const ffoChartData = {
    labels,
    datasets: [
      {
        label: "FFO per Share",
        data: ffoData,
        backgroundColor: "rgba(177, 45, 120, 0.8)",
        datalabels: { display: false },
      },
    ],
  };
  const dvdChartData = {
    labels,
    datasets: [
      {
        label: "Dividend per Share",
        data: dvdData,
        backgroundColor: "rgba(177, 45, 120, 0.8)",
        datalabels: { display: false },
      },
    ],
  };
  const noiChartData = {
    labels,
    datasets: [
      {
        label: "NOI per Share",
        data: noiData,
        backgroundColor: "rgba(177, 45, 120, 0.8)",
        datalabels: { display: false },
      },
    ],
  };

  // Price & Volume
  const priceLabels = priceData.map((d) => d.date);
  const closePrices = priceData.map((d) => d.close_price);
  const volumes = priceData.map((d) => d.volume);

  const priceVolumeChartData = {
    labels: priceLabels,
    datasets: [
      {
        label: "Close Price",
        data: closePrices,
        type: "line",
        borderColor: "rgba(177, 45, 120, 0.8)",
        backgroundColor: "rgba(177, 45, 120, 0.1)",
        yAxisID: "y-axis-price",
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 5,
        datalabels: { display: false },
      },
      {
        label: "Volume",
        data: volumes,
        type: "bar",
        backgroundColor: "rgba(90, 21, 61, 0.8)",
        yAxisID: "y-axis-volume",
        datalabels: { display: false },
      },
    ],
  };

  const priceVolumeChartOptions = {
    responsive: true,
    plugins: {
      tooltip: { mode: "index", intersect: false },
      legend: { display: true },
      title: { display: false },
    },
    scales: {
      x: {
        type: "time",
        bounds: "data",
        offset: false,
        time: {
          parser: "yyyy-MM-dd",
          tooltipFormat: "MMM d, yyyy",
          unit: "year",
          displayFormats: { year: "yyyy" },
        },
        ticks: { maxRotation: 60, minRotation: 45 },
        grid: { display: false },
      },
      "y-axis-price": {
        type: "linear",
        position: "left",
        grid: { display: false },
        ticks: {
          callback: (value) => `$${value}`,
        },
      },
      "y-axis-volume": {
        type: "linear",
        position: "right",
        grid: { display: false },
        ticks: {
          callback: (value) => Number(value).toLocaleString(),
        },
      },
    },
  };

  // Donut charts
  const stabilityVal = stabilityScore != null ? Math.round(stabilityScore) : 0;
  const fundamentalVal = fundamentalScore != null ? Math.round(fundamentalScore) : 0;

  const stabilityChartData = {
    labels: ["Stability Fill", "Remaining"],
    datasets: [
      {
        label: "",
        data: [stabilityVal, 100 - stabilityVal],
        backgroundColor: ["rgba(90, 21, 61, 0.8)", "#e0e0e0"],
        borderWidth: 0,
        datalabels: { display: false },
      },
    ],
  };
  const fundamentalChartData = {
    labels: ["Fundamental Fill", "Remaining"],
    datasets: [
      {
        label: "",
        data: [fundamentalVal, 100 - fundamentalVal],
        backgroundColor: ["rgba(90, 21, 61, 0.8)", "#e0e0e0"],
        borderWidth: 0,
        datalabels: { display: false },
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: () => "",
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

  const safeDisplay = (value) => {
    if (value == null || Number.isNaN(value)) {
      return "No Data";
    }
    return value;
  };

  const formatFFOGrowth = (val) => {
    if (val == null || Number.isNaN(val)) return "No Data";
    const percent = (val * 100).toFixed(1);
    return `${percent}%`;
  };

  const formatAssets = (val) => {
    if (val == null) return "No Data";
    const numVal = typeof val === "number" ? val : Number(val);
    if (Number.isNaN(numVal)) {
      return "No Data";
    }
    return `$${numVal.toLocaleString()} Million`;
  };

  // (1) MAKE TABS LOOK LIKE REAL TABS
  const mainTabBarStyle = {
    display: "flex",
    gap: "20px",
    // We remove "marginBottom: 20px" or reduce it to "10px"
    marginBottom: "10px",
    borderBottom: "1px solid #ccc",
  };
  // For the main tabs, add bottom border if active
  const mainTabStyle = (isActive) => ({
    position: "relative",
    padding: "10px 20px",
    cursor: "pointer",
    backgroundColor: "transparent",
    border: "none",
    fontWeight: isActive ? "bold" : "normal",
    outline: "none",
    transition: "background-color 0.3s, color 0.3s",
    color: isActive ? "#5A153D" : "#333",
    // We keep the underline for the main tab
    borderBottom: isActive
      ? "3px solid #5A153D"
      : "3px solid transparent",
  });

  // We'll do the same approach for sub-tabs
  const subTabBarStyle = {
    display: "flex",
    gap: "10px",
    margin: "0 0 15px 0",
  };
  // Remove underline for the active sub-tab
  const subTabStyle = (isActive) => ({
    position: "relative",
    padding: "8px 16px",
    cursor: "pointer",
    backgroundColor: "transparent",
    border: "none",
    fontWeight: isActive ? "bold" : "normal",
    outline: "none",
    transition: "background-color 0.3s, color 0.3s",
    color: isActive ? "#5A153D" : "#333",
    // No underline at all:
    borderBottom: "3px solid transparent",
  });

  const sectionContainer = {
    backgroundColor: "#f9f9f9",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px",
  };
  const financialGridStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    margin: "20px 0",
  };
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    margin: "20px 0",
  };
  const blockStyle = {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
    textAlign: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-around",
    alignItems: "center",
    minHeight: "320px",
    datalabels: { display: false },
  };

  return (
    <div className="detail-page" style={{ padding: "20px" }}>
      {/* (2) ALWAYS SHOW COMPANY + TICKER ON TOP */}
      <div style={{ marginBottom: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>
          {companyName}
        </h2>
      </div>

      {/* (1) MAIN TAB BAR with new style */}
      <div style={mainTabBarStyle}>
        {[
          { id: "overview", label: "Overview" },
          { id: "financials", label: "Financials" },
          { id: "metrics", label: "Real Estate Specific Metrics" },
          { id: "leasing", label: "Leasing" },
          { id: "portfolio", label: "Portfolio Breakdown" },
        ].map((tab) => {
          const isActive = (tab.id === activeTab);

          return (
            <button
              key={tab.id}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#faf0fb";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              onClick={() => setActiveTab(tab.id)}
              style={mainTabStyle(isActive)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1) OVERVIEW TAB */}
      {activeTab === "overview" && (
        <>
          {/* Only Business Description in the overview now */}
          <div style={{ marginBottom: "20px" }}>
            <p style={{ marginTop: "10px" }}>{businessDescription}</p>
          </div>

          {/* Business Statistics Table (Now inside Grey Background) */}
          <div style={sectionContainer}>
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Business Statistics</h3>
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
                    Investment Property Type
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
                        href={website.startsWith("http") ? website : `https://${website}`}
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
                    Annualized Historical FFO Growth
                    <span
                      className="tooltip-icon"
                      style={{
                        marginLeft: "6px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        width: "14px",
                        height: "14px",
                        display: "inline-block",
                        textAlign: "center",
                        lineHeight: "16px",
                      }}
                    >
                      i
                      <span className="tooltip-text">
                        This represents the CAGR of a REIT's FFO over the last five years. If a CAGR is unavailable—due to a sign change or both the starting and ending values being negative—the average annual growth over five years is displayed.
                      </span>
                    </span>
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                    {formatFFOGrowth(fiveYrFFOGrowth)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={sectionContainer}>
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Daily Price & Volume</h3>
            {priceData.length > 0 ? (
              <Line
                data={priceVolumeChartData}
                options={priceVolumeChartOptions}
                height={80}
              />
            ) : (
              <p>No price data available.</p>
            )}
          </div>

          <div style={sectionContainer}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h3 style={{ margin: 0 }}>Quantitative Scoring</h3>
              <button
                onClick={() => setShowOverlay(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#faf0fb";
                  e.currentTarget.style.color = "#5A153D";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#5A153D";
                  e.currentTarget.style.color = "#fff";
                }}
                style={{
                  padding: "10px 20px",
                  fontSize: "16px",
                  borderRadius: "5px",
                  backgroundColor: "#5A153D",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  transition: "background-color 0.3s ease, color 0.3s ease",
                }}
              >
                See Peer Comparison
              </button>
            </div>
            <div style={gridStyle}>
              {/* Stability */}
              <div style={blockStyle}>
                <h4>
                  Stability Percentile
                  <span
                    className="tooltip-icon"
                    style={{
                      marginLeft: "6px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      width: "14px",
                      height: "14px",
                      display: "inline-block",
                      textAlign: "center",
                      lineHeight: "16px",
                    }}
                  >
                    i
                    <span className="tooltip-text">
                      Stability Percentile measures price volatility risk. Our algorithm calculates
                      it using average daily return, standard deviation, skewness, kurtosis, and
                      trading volume over the last five years. A higher percentile indicates lower
                      risk.
                    </span>
                  </span>
                </h4>
                <div style={{ width: "200px", margin: "0 auto" }}>
                  <Doughnut
                    data={stabilityChartData}
                    options={donutOptions}
                  />
                </div>
                <p style={{ marginTop: "10px" }}>
                  {stabilityScore !== null ? `${stabilityVal}/100` : "N/A"}
                </p>
              </div>

              {/* Fundamental */}
              <div style={blockStyle}>
                <h4>
                  Fundamental Percentile
                  <span
                    className="tooltip-icon"
                    style={{
                      marginLeft: "6px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      width: "14px",
                      height: "14px",
                      display: "inline-block",
                      textAlign: "center",
                      lineHeight: "16px",
                    }}
                  >
                    i
                    <span className="tooltip-text">
                      Fundamental Percentile reflects the underlying financial strength of the REIT.
                      Our algorithm takes into account of factors like FFO Yield, FFO Payout, FFO
                      Growth, and Dividend Predictability. A higher percentile indicates stronger
                      fundamentals.
                    </span>
                  </span>
                </h4>
                <div style={{ width: "200px", margin: "0 auto" }}>
                  <Doughnut
                    data={fundamentalChartData}
                    options={donutOptions}
                  />
                </div>
                <p style={{ marginTop: "10px" }}>
                  {fundamentalScore !== null ? `${fundamentalVal}/100` : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Bar Charts (FFO, DVD, NOI) */}
          <div style={sectionContainer}>
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Financial Data</h3>
            <div style={financialGridStyle}>
              <div style={blockStyle}>
                <h4>FFO History</h4>
                {isAllNull(ffoData) ? (
                  <p>No FFO data available.</p>
                ) : (
                  <Bar data={ffoChartData} options={makeBarOptions("FFO PS")} height={70} />
                )}
              </div>

              <div style={blockStyle}>
                <h4>Dividend History</h4>
                {isAllNull(dvdData) ? (
                  <p>No Dividend data available.</p>
                ) : (
                  <Bar data={dvdChartData} options={makeBarOptions("Dividend PS")} height={70} />
                )}
              </div>

              <div style={blockStyle}>
                <h4>NOI History</h4>
                {isAllNull(noiData) ? (
                  <p>No NOI data available.</p>
                ) : (
                  <Bar data={noiChartData} options={makeBarOptions("NOI PS")} height={70} />
                )}
              </div>
            </div>
          </div>

          {/* Geographical Diversification */}
          <div style={{ ...sectionContainer, position: "relative" }}>
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>
              Geographical Diversification
            </h3>
            <div
              style={{
                backgroundColor: "#fff",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <ComposableMap projectionConfig={{ scale: 100 }} width={800} height={400}>
                  <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const countryName = geo.properties.name;
                        const isInvested =
                          overseasInvestment.includes(countryName) ||
                          (countryName === "United States of America" &&
                            usInvestmentRegions.length > 0);

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={isInvested ? "#b12d78" : "#D6D6DA"}
                            stroke="#FFFFFF"
                            strokeWidth={0.5}
                            onMouseEnter={(event) => {
                              setTooltipPosition({
                                x: event.clientX + 10,
                                y: event.clientY - 30,
                              });
                              setHoveredCountry(
                                countryName === "United States of America" &&
                                  usInvestmentRegions.length > 0
                                  ? `States invested: ${usInvestmentRegions.join(", ")}`
                                  : overseasInvestment.includes(countryName)
                                  ? `${countryName}`
                                  : null
                              );
                            }}
                            onMouseMove={(event) => {
                              setTooltipPosition({
                                x: event.clientX + 10,
                                y: event.clientY - 30,
                              });
                            }}
                            onMouseLeave={() => setHoveredCountry(null)}
                            style={{
                              default: { outline: "none" },
                              hover: { fill: "#5A153D", outline: "none" },
                              pressed: { fill: "#2A0920", outline: "none" },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>
              </div>
            </div>

            {hoveredCountry && (
              <div
                style={{
                  position: "fixed",
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y}px`,
                  backgroundColor: "#fff",
                  padding: "8px",
                  borderRadius: "5px",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                  fontSize: "14px",
                  pointerEvents: "none",
                  maxWidth: "200px",
                  wordWrap: "break-word",
                  whiteSpace: "normal",
                  textAlign: "left",
                  zIndex: 1000,
                }}
              >
                {hoveredCountry}
              </div>
            )}
          </div>

          <BottomBanner />
          {showOverlay && (
            <ScatterPlotOverlay
              propertyTypes={propertyTypeArray}
              onClose={() => setShowOverlay(false)}
              currentREIT={{
                ticker,
                xValue: stabilityScore !== null ? Math.round(stabilityScore) : 50,
                yValue: fundamentalScore !== null ? Math.round(fundamentalScore) : 50,
              }}
              API_BASE_URL={API_BASE_URL}
            />
          )}
        </>
      )}

      {/* 2) FINANCIALS TAB (WITH SUB-TABS) */}
      {activeTab === "financials" && (
        <div>
          {/* Remove the extra heading; sub-tabs are snug against the bar */}
          <div style={subTabBarStyle}>
            {[
              { id: "is", label: "Income Statement" },
              { id: "bs", label: "Balance Sheet" },
              { id: "cf", label: "Cash Flow" },
            ].map((sub) => {
              const isActive = (sub.id === financialSubTab);
              return (
                <button
                  key={sub.id}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "#faf0fb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  onClick={() => setFinancialSubTab(sub.id)}
                  style={subTabStyle(isActive)}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>

          <FinancialsTable ticker={ticker} subTab={financialSubTab} />
        </div>
      )}

      {/* 3) REAL ESTATE SPECIFIC METRICS */}
      {activeTab === "metrics" && (
        <div>
          <FinancialsTable ticker={ticker} subTab="industry" />
        </div>
      )}

      {/* 4) LEASING TAB (Placeholder) */}
      {activeTab === "leasing" && (
        <div>
          <h2>Leasing</h2>
          <p>TODO: Implement leasing details here.</p>
        </div>
      )}

      {/* 5) PORTFOLIO BREAKDOWN (Placeholder) */}
      {activeTab === "portfolio" && (
        <div>
          <h2>Portfolio Breakdown</h2>
          <p>TODO: Implement portfolio breakdown here.</p>
        </div>
      )}
    </div>
  );
}

export default DetailPage;
