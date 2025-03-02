import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bar, Doughnut } from "react-chartjs-2";
import Header from "../components/Header.js";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { feature } from "topojson-client";
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

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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
  const [targetPrice, setTargetPrice] = useState(null);

  // Map&Diversification Data and Fields
  const [usInvestmentRegions, setUSInvestmentRegions] = useState([]);
  const [overseasInvestment, setOverseasInvestment] = useState([]);

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
    WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
  };  
  
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

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
    return Math.round(num);
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
          setUSInvestmentRegions(
            reit.US_Investment_Regions
              ? reit.US_Investment_Regions.split(", ")
                  .map(state => US_STATE_MAP[state.trim()]) // Convert to full names
                  .filter(Boolean) // Remove undefined values
              : []
          );          
          setOverseasInvestment(
            reit.Overseas_Investment 
              ? reit.Overseas_Investment.split(", ").map(country => country.trim()) 
              : []
          );
        }
      })
      .catch((err) => {
        console.error("Error fetching REIT info:", err);
      });

    // 2) Fetch financials + scores
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
        <Header />
        <h2>{ticker} - Analytics Dashboard</h2>
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
        <Header />
        <h2>{ticker} - Analytics Dashboard</h2>
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

  // Reusable function for bar chart options
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
          title: {
            display: false,
          },
          ticks: {
            callback: function (value) {
              return Number(value).toFixed(1);
            },
          },
          grid: { display: false },
        },
        x: {
          grid: { display: false },
        },
      },
    };
  }

  // Bar chart data
  const ffoChartData = {
    labels,
    datasets: [
      {
        label: "FFO PS",
        data: ffoData,
        backgroundColor: "rgba(177, 45, 120, 0.8)",
      },
    ],
  };
  const dvdChartData = {
    labels,
    datasets: [
      {
        label: "Dividend PS",
        data: dvdData,
        backgroundColor: "rgba(177, 45, 120, 0.8)",
      },
    ],
  };
  const noiChartData = {
    labels,
    datasets: [
      {
        label: "NOI PS",
        data: noiData,
        backgroundColor: "rgba(177, 45, 120, 0.8)",
      },
    ],
  };

  const ffoBarOptions = makeBarOptions("FFO PS");
  const dvdBarOptions = makeBarOptions("Dividend PS");
  const noiBarOptions = makeBarOptions("NOI PS");

  // Donut chart data & options
  const stabilityVal = stabilityScore != null ? Math.round(stabilityScore) : 0;
  const fundamentalVal =
    fundamentalScore != null ? Math.round(fundamentalScore) : 0;

  const stabilityChartData = {
    labels: ["Stability Fill", "Remaining"],
    datasets: [
      {
        label: "",
        data: [stabilityVal, 100 - stabilityVal],
        backgroundColor: ["rgba(90, 21, 61, 0.8)", "#e0e0e0"],
        borderWidth: 0,
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
      },
    ],
  };

  // 1) Re-enable responsive: true, maintainAspectRatio: true
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

  // Helper to safely display a field or "No Data"
  const safeDisplay = (value) => {
    if (value == null || Number.isNaN(value)) {
      return "No Data";
    }
    return value;
  };

  // Format FFO Growth
  const formatFFOGrowth = (val) => {
    if (val == null || Number.isNaN(val)) return "No Data";
    const percent = (val * 100).toFixed(1);
    return `${percent}%`;
  };

  // Format total assets
  const formatAssets = (val) => {
    if (val == null) return "No Data";
    const numVal = typeof val === "number" ? val : Number(val);
    if (Number.isNaN(numVal)) {
      return "No Data";
    }
    return `$${numVal.toLocaleString()} million`;
  };

  // 2) & 3) Use minHeight + flex, and wrap the donut in a fixed-width container
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
    minHeight: "320px" // ensures donut box matches bar box height
  };

  const sectionContainer = {
    backgroundColor: "#f9f9f9",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px",
  };

  return (
    <div className="detail-page" style={{ padding: "20px" }}>
      <Header />
      {/* Name & description */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>{companyName}</h2>
        <p style={{ marginTop: "10px" }}>{businessDescription}</p>
      </div>

      {/* Business Statistics Table */}
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.5rem" }}>Business Statistics</h2>
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
                    onClick={(e) => e.stopPropagation()}
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
                    lineHeight: "16px"
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

      <h2 style={{ marginBottom: "20px" }}>{ticker} - Analytics Dashboard</h2>

      {/* ============== Quant SCORING SECTION ============== */}
      <div style={sectionContainer}>
        <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Quantitative Scoring</h3>
        <div style={gridStyle}>
          {/* Stability Percentile */}
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
                    lineHeight: "16px"
                  }}
                >
                i
                <span className="tooltip-text">
                  Stability Percentile measures price volatility risk. Our algorithm calculates it using average daily return, standard deviation, skewness, kurtosis, and trading volume over the last five years. A higher percentile indicates lower risk.
                </span>
              </span>
            </h4>
            {/* 2) Wrap in a 200px container */}
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

          {/* Fundamental Percentile */}
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
                    lineHeight: "16px"
                  }}
                >
                i
                <span className="tooltip-text">
                  Fundamental Percentile reflects the underlying financial strength of the REIT. Our algorithm takes into account of factors like FFO Yield, FFO Payout, FFO Growth, and Dividend Predictability. A higher percentile indicates stronger fundamentals.
                </span>
              </span>
            </h4>
            {/* 2) Wrap in a 200px container */}
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

      {/* ============== FINANCIAL DATA SECTION ============== */}
      <div style={sectionContainer}>
        <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Financial Data</h3>
        <div style={gridStyle}>
          {/* FFO per Share ($) */}
          <div style={blockStyle}>
            <h4>FFO per Share ($)</h4>
            {isAllNull(ffoData) ? (
              <p>No FFO data available.</p>
            ) : (
              <Bar data={ffoChartData} options={ffoBarOptions} height={220} />
            )}
          </div>

          {/* Dividend per Share ($) */}
          <div style={blockStyle}>
            <h4>Dividend per Share ($)</h4>
            {isAllNull(dvdData) ? (
              <p>No Dividend data available.</p>
            ) : (
              <Bar data={dvdChartData} options={dvdBarOptions} height={220} />
            )}
          </div>

          {/* NOI per Share ($) */}
          <div style={blockStyle}>
            <h4>NOI per Share ($)</h4>
            {isAllNull(noiData) ? (
              <p>No NOI data available.</p>
            ) : (
              <Bar data={noiChartData} options={noiBarOptions} height={220} />
            )}
          </div>
        </div>
      </div>

      {/* ============== DIVERSIFICATION MAP SECTION ============== */}
      <div style={{ ...sectionContainer, position: "relative" }}>
        <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Diversification</h3>

        {/* White box wrapper for the map */}
        <div style={{ 
          backgroundColor: "#fff", 
          padding: "20px", 
          borderRadius: "8px", 
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)" 
        }}>
          <div style={{ textAlign: "center" }}>
            <ComposableMap projectionConfig={{ scale: 100 }} width={800} height={400}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const countryName = geo.properties.name;
                    const isInvested =
                      overseasInvestment.includes(countryName) ||
                      (countryName === "United States of America" && usInvestmentRegions.length > 0);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isInvested ? "#b12d78" : "#D6D6DA"}
                        stroke="#FFFFFF"
                        strokeWidth={0.5}
                        onMouseEnter={(event) => {
                          setTooltipPosition({ 
                            x: event.clientX + 10, // Add small offset to prevent overlap
                            y: event.clientY - 30  // Position tooltip slightly above cursor
                          });
                        
                          setHoveredCountry(
                            countryName === "United States of America" && usInvestmentRegions.length > 0
                              ? `Invested in: ${usInvestmentRegions.join(", ")}`
                              : overseasInvestment.includes(countryName)
                              ? `${countryName}`
                              : null
                          );
                        }}                        
                        onMouseMove={(event) => {
                          setTooltipPosition({ 
                            x: event.clientX + 10, // Keeps tooltip next to cursor
                            y: event.clientY - 30  
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

        {/* Floating Tooltip */}
        {hoveredCountry && (
          <div
          style={{
            position: "fixed", // Use `fixed` instead of `absolute` for better positioning
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
            zIndex: 1000, // Ensure tooltip is above other elements
          }}
        >             
            {hoveredCountry}
          </div>
        )}
      </div>

      {/* ============== Go back to filter ============== */}
      <button
        className="back-button"
        onClick={() => {
          if (window.history.length > 2) {
            navigate("/filter"); 
          } else {
            navigate("/filter"); // Otherwise, go directly to the filter page
          }
        }}
      >
        Go to Screener Page
      </button>

    </div>
  );
}

export default DetailPage;
