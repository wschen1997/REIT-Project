import React, { useState, useEffect, useRef} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bar, Doughnut, Pie } from "react-chartjs-2";
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
import Loading from "../components/Loading.js";
import { useLoading } from "../context/LoadingContext.js";


const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);

  return matches;
};

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
    const { ctx, options } = chart;
    const calloutOptions = options.plugins.calloutPlugin || {};
    const textColor = calloutOptions.color || '#333'; // Default to black
    const lineColor = calloutOptions.lineColor || '#999'; // Default to grey
  
    const meta = chart.getDatasetMeta(0);
    // Safety check: If there's no data or metadata, do nothing.
    if (!meta || !chart.data.datasets[0] || !meta.data.length) {
        return;
    }
    const data = chart.data.datasets[0].data;
    const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
  
    const spokeOptions = [8, 16, 24, 32];
    const fallbackArmOptions = [20, 60, 100, 140];
    const armLength = 80;
    const fontSize = 12;
    const lineHeight = fontSize + 2;
  
    ctx.save();
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = textColor;   // Use dynamic color
    ctx.strokeStyle = lineColor; // Use dynamic color
    ctx.lineWidth = 1;

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
 * Fetches from /api/reits/<ticker>/statements/quarterly?type=...
 * Then pivots to wide layout:
 * Rows = line_item
 * Columns = each (fiscal_year, fiscal_quarter)
 **************************************************/
function FinancialsTable({ ticker, subTab }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Regular bold rows with indentation
  const boldKeywords = ["Total Owned Rooms","Rent/Sq. Meter Leased, Avg. - Total","Rent/Sq. Meter Leased, Avg. - Total  ","Rent/Sq. Ft. Leased, Avg. - Total","Sq. Meters Leased, Gross - Total","Sq. Ft. Leased, Gross - Total","Gross Operating Revenue","Total Hotels and Gaming Revenue","Total Tables, Incl. JVs","Total Slot Machines, Incl. JVs","Total Casinos, Incl. JVs","Total Rooms","Total Units","Total Real Estate Asset","Total Dividends Paid","Total Debt Repaid","Total Debt Issued","Total Asset","Total Equity","Property Statistics","Total Properties","Properties Data","Total Operating Expenses","Total Operating Revenue","Total Rental Revenue","Net Change in Cash","Cash from Financing","Depreciation & Amort., Total","Total Operating Exp.","Total Revenue","Total Common Equity","Total Pref. Equity","Total Liabilities","Total Real Estate Assets","Net Property, Plant & Equipment","Operating Income","Net Interest Exp.","EBT Incl. Unusual Items"," Earnings from Cont. Ops.","Net Income to Company","Net Income","NI to Common Incl Extra Items","NI to Common Excl. Extra Items","Cash from Ops.","Net Sale/Acq. of Real Estate Assets","Cash from Investing","EBT Excl. Unusual Items"];
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

  if (loading) return <Loading isOverlay={false} />;
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
      className="financials-table-container"
    >
      <table className="financials-table">
        <thead>
          <tr className="financials-table-header-row">
            <th className="financials-table-sticky-header">
              For the Fiscal Period
            </th>
            {sortedCols.map((colLabel) => (
              <th key={colLabel} className="financials-table-header-cell">
                {colLabel}
              </th>
            ))}
          </tr>
          {/*ITALIC SUB-NOTE ROW */}
            <tr className="financials-table-header-row">
              {/* First cell: the italic text, aligned under 'For the Fiscal Period' */}
              <td className="financials-table-sub-note">
                In Millions of the reported currency, except per share items.
              </td>
              {/* Render empty cells for the rest of the columns, so everything stays aligned */}
              {sortedCols.map((_, index) => (
                <td key={index} className="financials-table-empty-sub-note" />
              ))}
            </tr>
        </thead>
        <tbody>
          {lineItems.map((li, idx) => {
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
            const hasItemName      = li && li.trim() !== "";       // first cell non‑blank?
            const allNullDataCells = sortedCols.every(col => colMap[col] == null);
            const rowIsCompletelyEmpty = !hasItemName && allNullDataCells;
            const isIndented = regularBold && !specialRow && subTab !== "industry" && !extraSpaceRow;

            return (
              <React.Fragment key={li}>
                {/* If this row is flagged as an extra-space row, insert an extra spacing row above */}
                {extraSpaceRow && (
                  <tr className="financials-table-spacer-row">
                    {/* grey bar under the first column */}
                    <td className="financials-table-spacer-cell-sticky" />
                    {/* white bar under the data columns */}
                    <td
                      colSpan={sortedCols.length}
                      className="financials-table-spacer-cell"
                    />
                  </tr>
                )}
                <tr style={{ fontWeight: isBold ? 'bold' : 'normal' }}>
                  <td className={`financials-table-sticky-cell ${isIndented ? 'indented' : ''}`}>
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
                      <td key={colLabel} className="financials-table-data-cell">
                        {displayVal}
                      </td>
                    );
                  })}

                </tr>
                {/* Render separator row (after the row) for regular bold, only bold or special rows,
                    but skip it for extraSpace rows (since we already added a spacing row above) */}
                {(!extraSpaceRow && (regularBold || onlyBoldCondition || specialRow)) && (
                  <tr className="financials-table-spacer-row">
                    <td className="financials-table-spacer-cell-sticky" />
                    <td
                      colSpan={sortedCols.length}
                      className="financials-table-spacer-cell"
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

// Determine chart colors based on current theme
const getChartColors = () => {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const rootStyles = getComputedStyle(document.documentElement);

    return {
        isDarkMode: isDarkMode, 
        lineColor: isDarkMode
            ? rootStyles.getPropertyValue('--text-color-mild-light').trim()
            : 'rgba(177, 45, 120, 0.8)',
        volumeColor: isDarkMode
            ? rootStyles.getPropertyValue('--text-color-muted').trim()
            : 'rgba(90, 21, 61, 0.8)',
        textColor: rootStyles.getPropertyValue('--text-color-dark').trim(),
        barColor: isDarkMode
            ? rootStyles.getPropertyValue('--text-color-light').trim() 
            : '#5A153D', // Original light mode purple
        barColorNegative: isDarkMode
            ? '#a24c4cff'  // Muted red for dark mode negative values
            : '#808080',   // Original light mode grey
        mapBaseColorRgb: isDarkMode ? '255, 255, 255' : '90, 21, 61', // White for dark, purple for light
        mapEmptyColor: isDarkMode ? '#2a2a2a' : '#e0e0e0', // Dark grey for dark, light grey for light
    };
};

/****************************************************
 * 2) MAIN COMPONENT: DetailPage
 ****************************************************/
function DetailPage({ userPlan }) {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)'); 
  const [chartColors, setChartColors] = useState(getChartColors());

  useEffect(() => {
    // This observer listens for changes to the data-theme attribute on the <html> tag
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          setChartColors(getChartColors());
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });

    // Cleanup the observer when the component is removed
    return () => observer.disconnect();
  }, []);

  // Donut chart colors
  const lightModeDonutColors = [ "#5A153D", "#B12D78", "#FFC857", "#119DA4", "#19647E", "#FF7B24", "#9A031E" ];
  const darkModeDonutColors = [ "#844ee2", "#A375F5", "#C7A7FF", "#6530B8", "#4C248A", "#757575", "#9e9e9e" ];

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
  const { setLoading } = useLoading();
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
        return;
      }

      setLoading(true); // Turn the GLOBAL loader ON

      const reitInfoPromise = fetch(`${API_BASE_URL}/api/reits?ticker=${ticker}`).then(res => res.json());
      const pricePromise = fetch(`${API_BASE_URL}/api/reits/${ticker}/price`).then(res => res.json());
      const financialsPromise = fetch(`${API_BASE_URL}/api/reits/${ticker}/financials?include_scores=true`).then(res => res.json());
      const breakdownsPromise = fetch(`${API_BASE_URL}/api/reits/${ticker}/breakdowns`).then(res => res.json());

      Promise.all([reitInfoPromise, pricePromise, financialsPromise, breakdownsPromise])
        .then(([reitData, priceData, financialData, breakdownData]) => {
          // --- Process REIT Info ---
          if (reitData.reits && reitData.reits.length > 0) {
            const reit = reitData.reits.find((r) => r.Ticker === ticker);
            if (reit) {
              setCompanyName(reit.Company_Name || "");
              setBusinessDescription(reit.Business_Description || "");
              setPropertyType(reit.Property_Type ?? null);
              setYearFounded(parseIntOrNull(reit.Year_Founded));
              setNumbersEmployee(parseIntOrNull(reit.Numbers_Employee));
              setWebsite(reit.Website ?? null);
              setTotalAssetsM(reit.Total_Real_Estate_Assets_M_ ?? null);
              setTargetPrice(reit["Target_Price"] ?? null);
              setFiveYrFFOGrowth(reit["5yr_FFO_Growth"] ?? null);
              if (reit.US_Investment_Regions) {
                  const statesList = reit.US_Investment_Regions.split(", ").map((st) => st.trim()).filter(Boolean);
                  const fullStates = statesList.map((st) => US_STATE_MAP[st] || st).filter(Boolean);
                  setUSInvestmentRegions(fullStates);
              }
              if (reit.Overseas_Investment) {
                  setOverseasInvestment(reit.Overseas_Investment.split(", ").map((c) => c.trim()));
              }
            }
          }

          // --- Process Price Data ---
          if (priceData.price_data && priceData.price_data.length > 0) {
            setPriceData(priceData.price_data);
          } else if (priceData.message) {
            console.warn(priceData.message);
          }

          // --- Process Financials + Scores ---
          if (financialData.quarterly_data) {
            setFinancialData(financialData.quarterly_data);
            setStabilityScore(financialData.stability_percentile);
            setFundamentalScore(financialData.fundamental_percentile);
          } else if (financialData.message) {
            setError(financialData.message);
            setFinancialData([]);
          }

          // --- Process Breakdowns ---
          if (breakdownData.breakdowns) {
            setBreakdowns(breakdownData.breakdowns);
          } else if (breakdownData.error) {
            setErrorBreakdowns(breakdownData.error);
          }
        })
        .catch((err) => {
          console.error("Error fetching page data:", err);
          setError("A network error occurred while fetching data.");
        })
        .finally(() => {
          setLoading(false); // Turn the GLOBAL loader OFF
          setLoadingBreakdowns(false); // Also update individual state if needed
        });
    }, [ticker, setLoading]); // Add setLoading to the dependency array


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
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          onClick: null,
          labels: {
            // This will now work correctly without the override
            color: chartColors.textColor, 
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
            color: chartColors.textColor,
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
        x: { 
            grid: { display: false },
            ticks: {color: chartColors.textColor } 
        },
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
          return value < 0 ? chartColors.barColorNegative : chartColors.barColor;
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
          return value < 0 ? chartColors.barColorNegative : chartColors.barColor;
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
          return value < 0 ? chartColors.barColorNegative : chartColors.barColor;
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
        borderColor: chartColors.lineColor,        // CHANGED: Uses our new dynamic color
        backgroundColor: 'transparent',
        yAxisID: "y-axis-price",
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 1.5,                     // ADDED: Makes the line thinner
        datalabels: { display: false },
      },
      {
        label: "Volume",
        data: volumes,
        type: "bar",
        backgroundColor: chartColors.volumeColor,     // CHANGED: Uses our new dynamic color
        yAxisID: "y-axis-volume",
        datalabels: { display: false },
      },
    ],
  };

  const priceVolumeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: { mode: "index", intersect: false },
      legend: { position: 'bottom' },
      labels: {color: chartColors.textColor},
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
        ticks: { maxRotation: 60, minRotation: 45, color: chartColors.textColor },
        grid: { display: false },
      },
      "y-axis-price": {
        type: "linear",
        position: "left",
        grid: { display: false },
        ticks: {
          callback: (value) => `$${value}`, color: chartColors.textColor
        },
      },
      "y-axis-volume": {
        type: "linear",
        position: "right",
        grid: { display: false },
        ticks: {
          callback: (value) => Number(value).toLocaleString(), color: chartColors.textColor
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
      tooltip: {        // override _only_ the tooltip with pie-specific callbacks
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

  return (
    <div className="detail-page">
      <div className="detail-header">
        <h2 className="detail-company-name">
          {companyName}
        </h2>
      </div>

      <div className="detail-main-tabs">
        {[
          { id: "overview", label: "Overview" },
          { id: "financials", label: "Financials" },
          { id: "metrics", label: "REIT Specific Metrics" },
          { id: "portfolio", label: "Portfolio Breakdown" },
        ].map((tab) => {
          const isActive = (tab.id === activeTab);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`detail-tab-main ${isActive ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      
      {activeTab === "modeling" && (
        <ModelTab ticker={ticker} />
      )}
      
      {activeTab === "overview" && (
        <>
          <div className="detail-description-container">
            <p className="detail-description-text">{businessDescription}</p>
          </div>
          
          <div className="detail-section-container">
            <div className="detail-section-header">
              <h3>Daily Price & Volume</h3>
              <button
                onClick={() => setShowScoringOverlay(true)}
                className="btn btn-primary btn-sm"
              >
                AI-Powered Analysis
              </button>
            </div>
            
            {priceData.length > 0 ? (
              <div className="chart-scroll-wrapper">
                <div className="chart-inner-container">
                  <Line
                    data={priceVolumeChartData}
                    options={priceVolumeChartOptions}
                  />
                </div>
              </div>
            ) : (
              <p>No price data available.</p>
            )}
          </div>

          <div className="detail-section-container">
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Key Financials</h3>
            <div className="detail-financial-grid">
              <div className="detail-chart-block">
                <h4>Dividends History</h4>
                {isAllNull(dividendsData) ? (
                  <p>No Dividends per Share data available.</p>
                ) : (
                  <div className="chart-scroll-wrapper"> {/* Add this wrapper */}
                    <div className="chart-inner-container"> {/* Add this wrapper */}
                      <Bar data={dividendsChartData} options={makeBarOptions("Dividends per Share", "currency")} />
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-chart-block">
                <h4>FFO History</h4>
                {isAllNull(ffoData) ? (
                  <p>No FFO data available.</p>
                ) : (
                  <div className="chart-scroll-wrapper"> {/* Add this wrapper */}
                    <div className="chart-inner-container"> {/* Add this wrapper */}
                      <Bar data={ffoChartData} options={makeBarOptions("FFO", "number")} />
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-chart-block">
                <h4>FFO / Total Revenue %</h4>
                {isAllNull(ffoRevenuePctData) ? (
                  <p>No FFO / Revenue % data available.</p>
                ) : (
                  <div className="chart-scroll-wrapper"> {/* Add this wrapper */}
                    <div className="chart-inner-container"> {/* Add this wrapper */}
                      <Bar data={ffoRevenuePctChartData} options={makeBarOptions("FFO / Revenue %", "percent")} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showScoringOverlay && (
            <ScoringDonutOverlay
              ticker={ticker} 
              score={stabilityScore}
              title="Overall Stability Percentile"
              tooltipText="Stability Percentile measures price volatility risk. Our algorithm calculates it using average daily return, standard deviation, skewness, kurtosis, and trading volume over the last five years. A higher percentile indicates lower risk."
              donutOptions={donutOptions}
              onClose={() => setShowScoringOverlay(false)}
            />
          )}

          
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

      {activeTab === "financials" && (
        <div>
          <div className="detail-sub-tabs">
            {[
              { id: "is", label: "Income Statement" },
              { id: "bs", label: "Balance Sheet" },
              { id: "cf", label: "Cash Flow" },
            ].map((sub) => {
              const isActive = (sub.id === financialSubTab);
              return (
                <button
                  key={sub.id}
                  onClick={() => setFinancialSubTab(sub.id)}
                  className={`detail-tab-sub ${isActive ? 'active' : ''}`}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
          <FinancialsTable ticker={ticker} subTab={financialSubTab} />
        </div>
      )}

      {activeTab === "metrics" && (
        <div>
          <FinancialsTable ticker={ticker} subTab="industry" />
        </div>
      )}

      {activeTab === "leasing" && (
        <div>
          <h2>Leasing</h2>
          <p>TODO: Implement leasing details here.</p>
        </div>
      )}

      {activeTab === "portfolio" && (
        <>
          {loadingBreakdowns ? (
            <p>Loading portfolio data…</p>
          ) : errorBreakdowns || !breakdowns ? (
            <p>Property & portfolio data unavailable.</p>
          ) : (
            <div className="portfolio-grid">
              {/* Replace your existing .map loop with this one */}
              {[
                { key: "property_type", label: "Property Types" },
                { key: "secondary_type", label: "Secondary Property Types (If Reported)" },
              ].map(({ key, label }) => {
                const arr = breakdowns[key] || [];
                const values = arr.map(d => d.rba_gla);
                const labelsArr = arr.map(d => d.category);
                const total = values.reduce((sum, v) => sum + v, 0);

                const colors = chartColors.isDarkMode ? darkModeDonutColors : lightModeDonutColors;
                const bgColors = labelsArr.map((_, i) => colors[i % colors.length]);

                const chartData = {
                  labels: labelsArr,
                  datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 0 }]
                };

                // ==================== THIS IS THE NEW LOGIC ====================
                // Define different options for desktop and mobile
                const desktopDonutOptions = {
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "70%",
                  layout: { padding: { top: 65, right: 40, bottom: 40, left: 40 } },
                  plugins: {
                    title: { display: false },
                    calloutPlugin: { color: chartColors.textColor, lineColor: chartColors.volumeColor },
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: { enabled: true, /* ... rest of your tooltip config ... */ }
                  }
                };

                // AFTER
                // REPLACE WITH THIS
                const mobileDonutOptions = {
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "70%",
                  plugins: {
                    title: { display: false },
                    calloutPlugin: false,
                    tooltip: { enabled: true },
                    
                    // --- Disables all built-in labels/legends ---
                    legend: { display: false },
                    datalabels: { display: false },
                  }
                };

                // Use the isMobile variable to choose which options to use
                const chartOptions = isMobile ? mobileDonutOptions : desktopDonutOptions;
                // ================================================================

                return (
                  <div key={key} className="portfolio-chart-wrapper">
                    <h4 className="portfolio-chart-title">{label}</h4>
                    <div className="portfolio-chart-box">
                      <div className="portfolio-chart-inner-sizer">
                        <Doughnut data={chartData} options={chartOptions} />
                      </div>
                    </div>

                    
                    <div className="custom-legend-container">
                      {chartData.labels.map((legendLabel, index) => {
                        const value = chartData.datasets[0].data[index];
                        const backgroundColor = chartData.datasets[0].backgroundColor[index];
                        const total = chartData.datasets[0].data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100);

                        if (percentage < 1) return null;

                        return (
                          <div key={index} className="custom-legend-item">
                            <span 
                              className="custom-legend-swatch" 
                              style={{ backgroundColor: backgroundColor }}
                            ></span>
                            <span className="custom-legend-label">
                              {`${legendLabel} ${percentage.toFixed(0)}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                );
              })}

              <div className="portfolio-geo-panel">
                <h4 className="portfolio-chart-title">
                  Geographical Breakdown
                </h4>
                <div className="portfolio-geo-box">
                  <div className="portfolio-map-toggle-row">
                    <button
                      onClick={() => setMapView('state')}
                      className={`portfolio-map-toggle-btn ${mapView === 'state' ? 'active' : ''}`}
                    >
                      US Allocation
                    </button>
                    <button
                      onClick={() => setMapView('country')}
                      className={`portfolio-map-toggle-btn ${mapView === 'country' ? 'active' : ''}`}
                    >
                      International Allocation
                    </button>
                  </div>
                  
                  <div className="portfolio-map-container">
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
                                  ? chartColors.mapEmptyColor
                                  : `rgba(${chartColors.mapBaseColorRgb},${opacity})`;

                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={fill}
                                  className="map-geography"
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
                                    ? chartColors.mapEmptyColor
                                    : `rgba(${chartColors.mapBaseColorRgb},${opacity})`;

                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={fill}
                                  className="map-geography"
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
                    {hoveredGeo && (
                      <div
                        className="map-tooltip"
                        style={{
                          top:  tooltipPos.y + 10,
                          left: tooltipPos.x + 10,
                        }}
                      >
                        <strong>{hoveredGeo.name}</strong><br/>
                        {hoveredGeo.pct}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DetailPage;