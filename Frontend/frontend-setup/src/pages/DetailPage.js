import React, { useState, useEffect, useRef} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bar, Doughnut, Pie } from "react-chartjs-2";
import BottomBanner from "../components/BottomBanner.js";
import ScoringDonutOverlay from '../components/ScoringDonutOverlay.js';
import ModelTab from '../components/ModelTab.js';
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
import ChartDataLabels from 'chartjs-plugin-datalabels'

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
  Legend,
  ChartDataLabels
);

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const calloutPlugin = {
  id: 'calloutPlugin',
  afterDatasetsDraw(chart) {
    const { ctx }   = chart;
    const meta      = chart.getDatasetMeta(0);
    const data      = chart.data.datasets[0].data;
    const total     = data.reduce((a, b) => a + b, 0);

    // per‐slice radial spoke lengths (in px)
    const spokeOptions       = [8, 16, 24, 32];
    // per‐slice fallback arm lengths (in px) for collided labels
    const fallbackArmOptions = [20, 60, 100, 140];
    const armLength          = 80;   // default horizontal arm length
    const fontSize           = 12;
    const lineHeight         = fontSize + 2;

    ctx.save();
    ctx.font         = `${fontSize}px Arial`;
    ctx.fillStyle    = '#333';
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle  = '#999';
    ctx.lineWidth    = 1;

    const placed = [];  // track label boxes for collision detection

    meta.data.forEach((arc, i) => {
      if (i >= 4) return;  // only top-4 slices

      const angle   = (arc.startAngle + arc.endAngle) / 2;
      const cx      = arc.x, cy = arc.y;
      const r       = arc.outerRadius;

      // pick this slice’s spoke length
      const spoke = spokeOptions[i] ?? spokeOptions[0];

      // spoke end
      const sx = cx + Math.cos(angle) * r;
      const sy = cy + Math.sin(angle) * r;

      // after-spoke point
      const mx = cx + Math.cos(angle) * (r + spoke);
      const my = cy + Math.sin(angle) * (r + spoke);

      const baseRight = Math.cos(angle) > 0;
      const pct       = ((data[i] / total) * 100).toFixed(1) + '%';
      const lbl       = chart.data.labels[i];
      const lines     = [pct, lbl];

      // measure label
      const w  = Math.max(...lines.map(t => ctx.measureText(t).width));
      const h  = lineHeight * lines.length;
      const defaultX = baseRight
        ? mx + armLength
        : mx - armLength - w;
      const y0 = my - (lines.length - 1) * lineHeight;

      // detect collision
      const collides = placed.some(r =>
        !(defaultX + w < r.x || r.x + r.w < defaultX || y0 + h < r.y || r.y + r.h < y0)
      );

      // decide direction: flip side only on collision
      const effectiveRight = collides ? !baseRight : baseRight;
      // pick arm length
      const useArm = collides
        ? (fallbackArmOptions[i] ?? fallbackArmOptions[0])
        : armLength;
      const hx = mx + (effectiveRight ? useArm : -useArm);

      // draw connector
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(mx, my);
      ctx.lineTo(hx, my);
      ctx.stroke();

      // draw text
      ctx.textAlign = effectiveRight ? 'left' : 'right';
      let ty = my - 4;
      for (const txt of lines) {
        ctx.fillText(txt, hx, ty);
        ty -= lineHeight;
      }

      // record this label’s box
      const boxX = effectiveRight ? hx : hx - w;
      placed.push({ x: boxX, y: y0, w, h });
    });

    ctx.restore();
  }
};

ChartJS.register(calloutPlugin);

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
  // Regular bold rows with indentation
  const boldKeywords = ["Total Owned Rooms","Rent/Sq. Meter Leased, Avg. - Total","Rent/Sq. Meter Leased, Avg. - Total	","Rent/Sq. Ft. Leased, Avg. - Total","Sq. Meters Leased, Gross - Total","Sq. Ft. Leased, Gross - Total","Gross Operating Revenue","Total Hotels and Gaming Revenue","Total Tables, Incl. JVs","Total Slot Machines, Incl. JVs","Total Casinos, Incl. JVs","Total Rooms","Total Units","Total Real Estate Asset","Total Dividends Paid","Total Debt Repaid","Total Debt Issued","Total Asset","Total Equity","Property Statistics","Total Properties","Properties Data","Total Operating Expenses","Total Operating Revenue","Total Rental Revenue","Net Change in Cash","Cash from Financing","Depreciation & Amort., Total","Total Operating Exp.","Total Revenue","Total Common Equity","Total Pref. Equity","Total Liabilities","Total Real Estate Assets","Net Property, Plant & Equipment","Operating Income","Net Interest Exp.","EBT Incl. Unusual Items"," Earnings from Cont. Ops.","Net Income to Company","Net Income","NI to Common Incl Extra Items","NI to Common Excl. Extra Items","Cash from Ops.","Net Sale/Acq. of Real Estate Assets","Cash from Investing","EBT Excl. Unusual Items"];
  // Do not bold these rows
  const exceptKeywords = ["Total Rooms ADR","FFO / Total Revenue %","Interest and Invest. Income, Total (Rev)","Interest Expense, Total","Normalized Net Income","As Reported Total Revenue","Total Shares Out. on Filing Date","Total Shares Out. on Balance Sheet Date","Total Minority Interest","Total Asset Writedown"];
  // Bolded but no indentation
  const onlyBoldKeywords = ["Occupancy Rate - Total","Sq. Meters Leased, Net - Total","Sq. Ft. Leased, Net - Total","NLA (Sq. Meters) - Total","NLA (Sq. Ft.) - Total","Total Beds","GLA (Sq. Meters) - Total","GLA (Sq. Ft.) - Total","Total Sq. Ft.","Same Property Aggregate GLA (Sq. Ft.)","Total Other Property Operating Revenue","Reconciliation to FFO/AFFO/FAD ","ASSET","LIABILITIES","Supplemental Items","Per Share Items","Supplemental Operating Expense Items"];
  // Add new rows but no bold and no indentation
  const specialRowKeyword = ["Total Properties RevPAR","Normalized Net Income","Expense Reimbursements / Rental Revenue %","Funds Available for Distribution","Interest on Long Term Debt","FFO Payout Ratio %","Normalized Diluted EPS","Weighted Avg. Basic Shares Out.","Weighted Avg. Diluted Shares Out.","Repurchase of Preferred Stock"];
  // Add upper extra space row
  const extraSpaceRowKeyword = ["Total Rooms Occupancy","Casino Revenue","Investment Properties","Rents / Average Properties %"];
  // Don't show null value as "-"
  const dashBlankKeywords = ["Supplemental Operating Expense Items","Supplemental Items","Per Share Items","ASSET", "LIABILITIES"];
  const containerRef = useRef(null); // For scrolling

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
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) {
          // Set scrollLeft or scrollRight based on the scroll direction
          el.scrollright = el.scrollWidth - el.clientWidth;
        }
      }}
      style={{ overflowX: 'auto', maxWidth: '100%' }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          border: "1px solid #ccc",
          whiteSpace: "nowrap",
          minWidth: "700px" // ensures table doesn't collapse too narrowly
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f2f2f2" }}>
            <th
              style={{
                padding: "8px",
                position: "sticky",
                left: 0,
                zIndex: 2,
                // Use a solid color (not transparent) for the first column
                backgroundColor: "#f2f2f2",
                textAlign: "left"
              }}
            >
              For the Fiscal Period
            </th>
            {sortedCols.map((colLabel) => (
              <th
                key={colLabel}
                style={{
                  padding: "8px",
                  minWidth: "100px",
                  textAlign: "left",
                }}
              >
                {colLabel}
              </th>
            ))}
          </tr>
          {/*ITALIC SUB-NOTE ROW */}
            <tr style={{ backgroundColor: "#f2f2f2" }}>
              {/* First cell: the italic text, aligned under 'For the Fiscal Period' */}
              <td
                style={{
                  padding: "4px",
                  position: "sticky",
                  left: 0,
                  zIndex: 2,
                  backgroundColor: "#f2f2f2",
                  textAlign: "left",
                  fontStyle: "italic",
                  fontSize: "0.8rem",
                  color: "#555",
                }}
              >
                In Millions of the reported currency, except per share items.
              </td>
              {/* Render empty cells for the rest of the columns, so everything stays aligned */}
              {sortedCols.map(() => (
                <td style={{ backgroundColor: "#f2f2f2" }} />
              ))}
            </tr>
        </thead>
        <tbody>
          {lineItems.map((li, idx) => {
            // Alternate row background
            const firstColBackground = "#fafafa";   // light‑grey for the item‑name column
            const rowBackground      = "#fff";      // keep all data cells pure white

            // Determine regular bold conditions (case sensitive)
            const regularBold = boldKeywords.some(keyword => li.includes(keyword))
                                && !exceptKeywords.some(keyword => li.includes(keyword));
            const onlyBoldCondition = onlyBoldKeywords.some(keyword => li.includes(keyword));
            // Check if the current line item matches any extra spacing keyword.
            const extraSpaceRow = extraSpaceRowKeyword.some(keyword => li.includes(keyword));
            // Also check for your existing "special row" condition
            const specialRow = specialRowKeyword.some(keyword => li.includes(keyword));

            // If this row is an extra-space row, force it to be not bold.
            const isBold = extraSpaceRow ? false : (onlyBoldCondition || regularBold);
            const colMap = pivotMap[li].columns;
            const hasItemName      = li && li.trim() !== "";        // first cell non‑blank?
            const allNullDataCells = sortedCols.every(col => colMap[col] == null);
            const rowIsCompletelyEmpty = !hasItemName && allNullDataCells;

            return (
              <React.Fragment key={li}>
                {/* If this row is flagged as an extra-space row, insert an extra spacing row above */}
                {extraSpaceRow && (
                  <tr>
                    {/* grey bar under the first column */}
                    <td
                      style={{
                        backgroundColor: firstColBackground,
                        padding: "2px",
                        height: "10px",
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                      }}
                    />
                    {/* white bar under the data columns */}
                    <td
                      colSpan={sortedCols.length}
                      style={{ backgroundColor: "#fff", padding: "2px", height: "10px" }}
                    />
                  </tr>
                )}
                <tr style={{ backgroundColor: "#fff", fontWeight: isBold ? 'bold' : 'normal' }}>
                  <td
                    style={{
                      padding: "8px",
                      position: "sticky",
                      zIndex: 2,
                      left: 0,
                      backgroundColor: firstColBackground,
                      // Add extra left padding only for regular bold rows (and not if extraSpaceRow is true)
                      ...((regularBold && !specialRow && subTab !== "industry" && !extraSpaceRow) ? { paddingLeft: "16px" } : {})
                    }}
                  >
                    {li}
                  </td>
                  {sortedCols.map((colLabel) => {
                    // decide if this row is a percentage row
                    const isPercentRow =
                      li.includes("%") || li.includes("Payout") || li.includes("Growth") ||
                      li.includes("Occupancy") || li.includes("Margin");

                    const val = colMap[colLabel];

                    // header rows that should stay blank when value is null
                    const skipDash = rowIsCompletelyEmpty ||
                                     dashBlankKeywords.some(keyword => li.startsWith(keyword));

                    let displayVal = "";

                    if (val == null) {
                      // show "-" for null unless this is a header row
                      displayVal = skipDash ? "" : "-";
                    } else {
                      // ---------- normal formatting ----------
                      if (isPercentRow) {
                        const numVal = Number(val) * 100;
                        displayVal =
                          numVal < 0
                            ? `(${Math.abs(numVal).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}%)`
                            : `${numVal.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}%`;
                      } else {
                        const isCurrencyRow =
                          li.includes("EPS") || li.includes("/Share") ||
                          li.includes("per Share (Basic)") || li.includes("per Share (Diluted)") ||
                          li.includes("Dividends per Share");

                        const numVal = Number(val);
                        const formatted =
                          numVal < 0
                            ? `(${Math.abs(numVal).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })})`
                            : numVal.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });

                        displayVal = isCurrencyRow ? `$ ${formatted}` : formatted;
                      }
                      // ---------------------------------------
                    }

                    return (
                      <td
                        key={colLabel}
                        style={{
                          padding: "8px",
                          minWidth: "100px",
                          textAlign: "left",
                        }}
                      >
                        {displayVal}
                      </td>
                    );
                  })}

                </tr>
                {/* Render separator row (after the row) for regular bold, only bold or special rows,
                    but skip it for extraSpace rows (since we already added a spacing row above) */}
                {(!extraSpaceRow && (regularBold || onlyBoldCondition || specialRow)) && (
                  <tr>
                    <td
                            style={{
                              backgroundColor: firstColBackground,
                              padding: "2px",
                              height: "10px",
                              position: "sticky",
                              left: 0,
                              zIndex: 2,
                            }}                      
                    />
                    <td
                      colSpan={sortedCols.length}
                      style={{ backgroundColor: "#fff", padding: "2px", height: "10px" }}
                    />
                  </tr>
                )}
              </React.Fragment>
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

  // Overlay for quant scoring
  const [showScoringOverlay, setShowScoringOverlay] = useState(false);

  // Price data for the line chart
  const [priceData, setPriceData] = useState([]);

  // Financial data & scoring
  const [financialData, setFinancialData] = useState([]);
  const [stabilityScore, setStabilityScore] = useState(null);
  const [fundamentalScore, setFundamentalScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Portfolio breakdowns
  const [breakdowns, setBreakdowns] = useState(null);
  const [loadingBreakdowns, setLoadingBreakdowns] = useState(true);
  const [errorBreakdowns, setErrorBreakdowns] = useState("");
  const [mapView, setMapView] = useState('state');
  const [hoveredGeo, setHoveredGeo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });


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

    // 4) Fetch portfolio breakdowns
    fetch(`${API_BASE_URL}/api/reits/${ticker}/breakdowns`)
    .then((res) => res.json())
    .then((data) => {
      if (data.breakdowns) {
        setBreakdowns(data.breakdowns);
      } else if (data.error) {
        setErrorBreakdowns(data.error);
      }
    })
    .catch((err) => {
      console.error("Error fetching breakdowns:", err);
      setErrorBreakdowns("Network error loading breakdowns.");
    })
    .finally(() => {
      setLoadingBreakdowns(false);
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
  const dividendsData = financialData.map((item) => item.dividends_per_share);
  const ffoData = financialData.map((item) => item.ffo);
  const ffoRevenuePctData = financialData.map((item) => item.ffo_per_revenue_pct);

  function makeBarOptions(labelText, dataType = 'number') {
    return {
      responsive: true,
      plugins: {
        legend: {
          // --- START: MODIFIED SECTION ---
          position: 'bottom', // <<< CHANGE #1: Moves the legend to the bottom
          onClick: null,      // <<< CHANGE #2: Disables the click-to-hide action
          // --- END: MODIFIED SECTION ---
          labels: {
            // This function generates custom legend items
            generateLabels: function(chart) {
              const data = chart.data.datasets[0].data;
              const hasNegativeValues = data.some(value => value < 0);

              // 1. Always create the primary legend item
              const primaryLabel = {
                text: labelText,
                fillStyle: '#5A153D',
                strokeStyle: '#5A153D',
                lineWidth: 1,
                hidden: false,
                index: 0
              };

              const legendItems = [primaryLabel];

              // 2. If negative values exist, add a second item for them
              if (hasNegativeValues) {
                legendItems.push({
                  text: 'Negative Value',
                  fillStyle: '#808080', // Use the same grey color
                  strokeStyle: '#808080',
                  lineWidth: 1,
                  hidden: false,
                  index: 1
                });
              }

              return legendItems;
            }
          }
        },
        title: { display: false },
        tooltip: {
          callbacks: {
            title: function(context) {
              return context[0].label;
            },
            label: function (context) {
              let val = context.parsed.y;
              if (val === null) return null;

              let displayVal = '';
              if (dataType === 'number') {
                displayVal = `$${val.toFixed(0)}M`;
              } else if (dataType === 'currency') {
                displayVal = val.toLocaleString("en-US", { style: "currency", currency: "USD" });
              } else if (dataType === 'percent') {
                displayVal = (val * 100).toFixed(1) + '%';
              } else {
                displayVal = val.toLocaleString("en-US");
              }
              return `${labelText}: ${displayVal}`;
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
              if (dataType === 'number') {
                return '$' + value.toFixed(0) + 'M';
              }
              if (dataType === 'currency') {
                  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
              }
              if (dataType === 'percent') {
                return (value * 100).toFixed(0) + '%';
              }
              return value.toLocaleString();
            },
          },
        },
        x: { grid: { display: false } },
      },
    };
  }

  const dividendsChartData = {
    labels,
    datasets: [
      {
        label: "Dividends per Share",
        data: dividendsData,
        // Conditionally set bar color
        backgroundColor: (context) => {
          const value = context.raw;
          return value < 0 ? '#808080' : '#5A153D'; // Grey for negative, purple for positive
        },
        datalabels: { display: false },
      },
    ],
  };

  const ffoChartData = {
    labels,
    datasets: [
      {
        label: "FFO (in Millions)",
        data: ffoData,
        // Conditionally set bar color
        backgroundColor: (context) => {
          const value = context.raw;
          return value < 0 ? '#808080' : '#5A153D'; // Grey for negative, purple for positive
        },
        datalabels: { display: false },
      },
    ],
  };

  const ffoRevenuePctChartData = {
    labels,
    datasets: [
      {
        label: "FFO / Total Revenue %",
        data: ffoRevenuePctData,
        // Conditionally set bar color
        backgroundColor: (context) => {
          const value = context.raw;
          return value < 0 ? '#808080' : '#5A153D'; // Grey for negative, purple for positive
        },
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
      legend: { position: 'bottom' },
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
      calloutPlugin: false,
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

  // Custom tooltip callbacks for the 4 portfolio pies
  const pieTooltipCallbacks = {
    callbacks: {
      title: (ctx) => ctx[0].label,
      label: (ctx) => {
        const raw = ctx.parsed;
        const pct = (raw * 100).toFixed(2) + '%';
        // raw is in SF since rba_gla is in SF units; convert to millions:
        const millions = (raw / 1_000_000).toFixed(1);
        return `${pct} — ${millions}M SF`;
      }
    }
  };

  const pieOptions = {
    ...donutOptions,        // keeps your responsive / maintainAspectRatio / etc
    cutout: "0%",
    plugins: {
      // keep everything in donutOptions.plugins _except_ tooltip
      ...donutOptions.plugins,
      tooltip: {            // override _only_ the tooltip with pie-specific callbacks
        ...pieTooltipCallbacks
      },
      legend: {
        display: false
      }
    }
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
          { id: "metrics", label: "REIT Specific Metrics" },
          { id: "portfolio", label: "Portfolio Breakdown" },
          { id: "modeling", label: "Modeling" },
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
      {/* MODELING TAB */}
      {activeTab === "modeling" && (
        <ModelTab ticker={ticker} />
      )}
      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <>
          {/* Only Business Description in the overview now */}
          <div style={{ marginBottom: "20px" }}>
            <p style={{ marginTop: "10px" }}>{businessDescription}</p>
          </div>

          

          <div style={sectionContainer}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "30px",
              }}
            >
              <h3 style={{ margin: 0 }}>Daily Price & Volume</h3>
              {/* New Button, styled like the Peer Comparison one */}
              <button
                onClick={() => setShowScoringOverlay(true)}
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
                AI-Powered Analysis
              </button>
            </div>
            
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


          {/* Additional Bar Charts (FFO, DVD, NOI) */}
          <div style={sectionContainer}>
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Key Financials</h3>
            <div style={financialGridStyle}>
              <div style={blockStyle}>
                <h4>Dividends History</h4>
                {isAllNull(dividendsData) ? (
                  <p>No Dividends per Share data available.</p>
                ) : (
                  <Bar data={dividendsChartData} options={makeBarOptions("Dividends per Share", "currency")} height={70} />
                )}
              </div>

              <div style={blockStyle}>
                <h4>FFO History</h4>
                {isAllNull(ffoData) ? (
                  <p>No FFO data available.</p>
                ) : (
                  <Bar data={ffoChartData} options={makeBarOptions("FFO", "number")} height={70} />
                )}
              </div>

              <div style={blockStyle}>
                <h4>FFO / Total Revenue %</h4>
                {isAllNull(ffoRevenuePctData) ? (
                  <p>No FFO / Revenue % data available.</p>
                ) : (
                  <Bar data={ffoRevenuePctChartData} options={makeBarOptions("FFO / Revenue %", "percent")} height={70} />
                )}
              </div>
            </div>
          </div>

          {/* --- 4. ADD THE CONDITIONAL RENDER FOR THE NEW OVERLAY --- */}
          {showScoringOverlay && (
              <ScoringDonutOverlay
                ticker={ticker} 
                score={stabilityScore}
                title="Overall Stability Percentile"
                tooltipText="Stability Percentile measures price volatility risk. Our algorithm calculates it using average daily return, standard deviation, skewness, kurtosis, and trading volume over the last five years. A higher percentile indicates lower risk."
                donutOptions={donutOptions} // Pass the existing options from DetailPage
                onClose={() => setShowScoringOverlay(false)}
              />
          )}
          {/* --- END NEW OVERLAY LOGIC --- */}

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

      {/* FINANCIALS TAB (WITH SUB-TABS) */}
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

      {/* REIT SPECIFIC METRICS */}
      {activeTab === "metrics" && (
        <div>
          <FinancialsTable ticker={ticker} subTab="industry" />
        </div>
      )}

      {/* LEASING TAB (Placeholder, Hault) */}
      {activeTab === "leasing" && (
        <div>
          <h2>Leasing</h2>
          <p>TODO: Implement leasing details here.</p>
        </div>
      )}

      {/* PORTFOLIO BREAKDOWN */}
      {activeTab === "portfolio" && (
        <>
          {loadingBreakdowns ? (
            <p>Loading portfolio data…</p>
          ) : errorBreakdowns || !breakdowns ? (
            <p>Property & portfolio data unavailable.</p>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              margin: "20px 0"
            }}>

              
              {[
                { key: "property_type",   label: "Property Types" },
                { key: "secondary_type",  label: "Secondary Property Types (If Reported)" },
              ].map(({ key, label }) => {
                const arr       = breakdowns[key] || [];
                const values    = arr.map(d => d.rba_gla);
                const labelsArr = arr.map(d => d.category);
                const total     = values.reduce((sum, v) => sum + v, 0);

                // DEBUG: log donut init
                console.log("[Portfolio Breakdowns] init donut for:", key, labelsArr, values);

                // generate a palette of diverse colors
                const colors = [
                  "#5A153D", "#B12D78", "#FFC857", "#119DA4", "#19647E",
                  "#FF7B24", "#9A031E", "#FB8B24", "#E36414", "#0F4C5C"
                ];
                const bgColors = labelsArr.map((_, i) => colors[i % colors.length]);

                const chartData = {
                  labels: labelsArr,
                  datasets: [{
                    data: values,
                    backgroundColor: bgColors,
                    borderWidth: 0
                  }]
                };

                // donut options (reuse your main donutOptions style)
                const breakdownDonutOptions = {
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "70%",
                  layout: {
                    padding: {
                      top:    65,
                      right:  40,
                      bottom: 40,
                      left:   40
                    }
                  },
                  plugins: {
                    title: { display: false },
                    calloutPlugin: {},
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: {
                      enabled: true,
                      mode: 'nearest',
                      intersect: false,
                      callbacks: {
                        title: items => items[0].label,
                        label: ({ parsed: raw }) => {
                          const pct = total
                            ? ((raw / total) * 100).toFixed(2) + "%"
                            : "0%";
                          const mSF = (raw / 1e6).toFixed(1) + " M SF";
                          return `${pct}`;
                        }
                      }
                    }
                  }
                };

                return (
                  <div
                    key={key}
                    style={{
                      position: 'relative',    // ← new wrapper
                      overflow: 'visible',     // ← allow callouts to spill out
                      width: '660px',          // ← keep your fixed width
                      margin: "0 auto"
                    }}
                  >
                    {/* panel title pulled outside the box */}
                    <h4
                      style={{
                        position: 'absolute',
                        top: '-1.2em',
                        left: '0px',
                        margin: 0,
                        background: '#fff',
                        padding: '12px 4px',           // ← add vertical padding
                        textDecoration: 'underline',  // ← underline the label
                        fontSize: '16px'
                      }}
                    >
                      {label}
                    </h4>

                    {/* inner bordered box */}
                    <div style={{
                      border: "1px solid #ccc",
                      borderRadius: "0px",
                      padding: '20px',
                      boxSizing: 'border-box',
                      background: "#fff",
                      width: '100%',
                      height: '400px',
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      overflow: 'visible',     // ← also allow spill-out here
                      marginTop: '1.5em'  
                    }}>
                      <div style={{ width: "600px", height: "600px", position: 'relative', overflow: 'visible' }}>
                        <Doughnut
                          data={chartData}
                          options={breakdownDonutOptions}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ——— Geographical Breakdown panel ——— */}
              <div
                style={{
                  position: 'relative',
                  overflow: 'visible',
                  // span exactly the two 660px panels + the 20px gap
                  gridColumn: '1 / span 2',
                  width: 'calc(670px * 2 + 20px)',
                  margin: '0 auto'
                }}
              >
                {/* panel title pulled outside the box */}
                <h4
                  style={{
                    position: 'absolute',
                    top: '-1.2em',
                    left: '0px',
                    margin: 0,
                    background: '#fff',
                    padding: '12px 4px',
                    textDecoration: 'underline',
                    fontSize: '16px'
                  }}
                >
                  Geographical Breakdown
                </h4>

                {/* inner bordered box */}
                <div
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: '0px',
                    padding: '10px',
                    boxSizing: 'border-box',
                    background: '#fff',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'visible',
                    marginTop: '1.5em'
                  }}
                >
                  {/* ——— Map toggle row ——— */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginTop: '5px',
                      marginBottom: '0px'
                    }}
                  >
                    <button
                    onClick={() => setMapView('state')}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = "#faf0fb";
                      e.currentTarget.style.color = "#5A153D";
                    }}
                    onMouseLeave={e => {
                      const active = mapView === 'state';
                      e.currentTarget.style.backgroundColor = active ? "#5A153D" : "#fff";
                      e.currentTarget.style.color = active ? "#fff"   : "#333";
                    }}
                    style={{
                      padding: '6px 12px',
                      marginRight: '10px',
                      background: mapView === 'state' ? '#5A153D' : '#fff',
                      color:      mapView === 'state' ? '#fff'   : '#333',
                      border: '1px solid #ccc',
                      cursor: 'pointer'
                    }}
                    >
                    US Allocation
                    </button>

                    <button
                    onClick={() => setMapView('country')}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = "#faf0fb";
                      e.currentTarget.style.color = "#5A153D";
                    }}
                    onMouseLeave={e => {
                      const active = mapView === 'country';
                      e.currentTarget.style.backgroundColor = active ? "#5A153D" : "#fff";
                      e.currentTarget.style.color = active ? "#fff"   : "#333";
                    }}
                    style={{
                      padding: '6px 12px',
                      background: mapView === 'country' ? '#5A153D' : '#fff',
                      color:      mapView === 'country' ? '#fff'   : '#333',
                      border: '1px solid #ccc',
                      cursor: 'pointer'
                    }}
                    >
                    International Allocation
                    </button>
                  </div>

                  {/* ——— Choropleth map container ——— */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      margin: '0 auto'
                    }}
                  >
                    {mapView === 'state' ? (
                      <ComposableMap
                        projection="geoAlbersUsa"
                        projectionConfig={{ scale: 1000, center: [-97, 38] }}
                        style={{ width: '100%', height: '600px' }}
                      >
                        <Geographies geography="https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json">
                          {({ geographies }) => {
                            const data   = breakdowns.state || [];
                            const maxPct = data.length
                              ? Math.max(...data.map(d => Number(d.pct)))
                              : 0;
                            const nameToCode = {};
                            Object.entries(US_STATE_MAP).forEach(([code, name]) => {
                              nameToCode[name] = code;
                            });

                            return geographies.map(geo => {
                              const fullName = geo.properties.name;
                              const code     = nameToCode[fullName];
                              const entry    = data.find(d => d.category === code);
                              const pct      = entry ? Number(entry.pct) : 0;
                              const rel      = maxPct > 0 ? pct / maxPct : 0;
                              const opacity  = 0.2 + 0.8 * rel;
                              const fill     = pct === 0
                                ? '#e0e0e0'
                                : `rgba(90,21,61,${opacity})`;

                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={fill}
                                  stroke="#fff"
                                  onMouseEnter={evt => {
                                    setTooltipPos({ x: evt.clientX, y: evt.clientY });
                                    setHoveredGeo({
                                      name: fullName,
                                      pct:  `${(pct * 100).toFixed(2)}%`
                                    });
                                  }}
                                  onMouseMove={evt =>
                                    setTooltipPos({ x: evt.clientX, y: evt.clientY })
                                  }
                                  onMouseLeave={() => setHoveredGeo(null)}
                                />
                              );
                            });
                          }}
                        </Geographies>
                      </ComposableMap>
                    ) : (
                      <ComposableMap
                        projectionConfig={{ scale: 150 }}
                        style={{ width: '100%', height: '600px' }}
                      >
                        <Geographies geography={geoUrl}>
                          {({ geographies }) => {
                            const data   = breakdowns.country || [];
                            const maxPct = data.length
                              ? Math.max(...data.map(d => Number(d.pct)))
                              : 0;

                            return geographies.map(geo => {
                              const name      = geo.properties.name;
                              const lowerName = name.toLowerCase();
                              const entry     = data.find(d => {
                                const cat = d.category.toLowerCase();
                                return (
                                  lowerName === cat ||
                                  lowerName.includes(cat) ||
                                  cat.includes(lowerName)
                                );
                              });
                              const pct     = entry ? Number(entry.pct) : 0;
                              const rel     = maxPct > 0 ? pct / maxPct : 0;
                              const opacity = 0.2 + 0.8 * rel;
                              const fill    = pct === 0
                                ? '#e0e0e0'
                                : `rgba(90,21,61,${opacity})`;

                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={fill}
                                  stroke="#fff"
                                  onMouseEnter={evt => {
                                    setTooltipPos({ x: evt.clientX, y: evt.clientY });
                                    setHoveredGeo({
                                      name,
                                      pct:  `${(pct * 100).toFixed(2)}%`
                                    });
                                  }}
                                  onMouseMove={evt =>
                                    setTooltipPos({ x: evt.clientX, y: evt.clientY })
                                  }
                                  onMouseLeave={() => setHoveredGeo(null)}
                                />
                              );
                            });
                          }}
                        </Geographies>
                      </ComposableMap>
                    )}
                    {/* ——— Hover tooltip ——— */}
                    {hoveredGeo && (
                      <div
                        style={{
                          position: 'fixed',
                          top:    tooltipPos.y + 10,
                          left:   tooltipPos.x + 10,
                          background: '#fff',
                          padding:    '6px 8px',
                          borderRadius: '4px',
                          boxShadow:  '0 2px 4px rgba(0,0,0,0.2)',
                          pointerEvents: 'none',
                          fontSize: '0.85rem',
                          zIndex: 1000
                        }}
                      >
                        <strong>{hoveredGeo.name}</strong><br/>
                        {hoveredGeo.pct}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* ——— FOOTNOTE ——— */}
              <div style={{
                gridColumn: "1 / span 2",
                marginTop:  "12px",
                fontSize:   "0.8rem",
                color:      "#555",
                fontStyle:  "italic",
                textAlign:  "left"
              }}>
                As an analytics platform, Viserra strives to present every data point on a consistent basis. Property data and classification are sourced from public records (eg. transaction deeds, county appraisal databases, etc.) to reflect the most up to date transaction information. All percentages here are calculated on a square-foot basis, so figures may differ from those on the company’s website or in investor presentations.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DetailPage;
