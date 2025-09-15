// RecDetailPage.js
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  PointElement,
} from "chart.js";
import 'chartjs-adapter-date-fns';
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  BarElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function RecDetailPage() {
  const { vehicle } = useParams();
  const navigate = useNavigate();

  // Universe Data Fields
  const [companyName, setCompanyName] = useState("");
  const [propertyTypes, setPropertyTypes] = useState("");
  const [managementFees, setManagementFees] = useState("");
  const [distributionFrequency, setDistributionFrequency] = useState("");
  const [minimumInvestment, setMinimumInvestment] = useState("");
  const [totalAssets, setTotalAssets] = useState("");
  const [website, setWebsite] = useState("");

  // Performance Series
  const [totalReturnData, setTotalReturnData] = useState([]);
  const [distributionYieldData, setDistributionYieldData] = useState([]);
  const [navGrowthData, setNavGrowthData] = useState([]);

  // Loading & Error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ----------------- Fetch Data on Mount -----------------
  useEffect(() => {
    if (!vehicle) {
      setError("Missing vehicle name in URL.");
      setLoading(false);
      return;
    }

    // A) Fetch Universe Row(s)
    fetch(`${API_BASE_URL}/api/rec/universe`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rec_universe && data.rec_universe.length > 0) {
          const row = data.rec_universe.find(
            (item) => (item.Investment_Vehicle || "").trim() === vehicle.trim()
          );
          if (!row) {
            setError(`No matching vehicle in rec_universe: ${vehicle}`);
          } else {
            // Format Management Fees as e.g. 1.0% if DB is 0.01
            const feesValue = parseFloat(row.Management_Fees);
            const displayFees = isNaN(feesValue)
              ? ""
              : `${(feesValue * 100).toFixed(1)}%`;

            // Minimum Investment => e.g. 1000 => $1,000
            const minInvestVal = parseFloat(row.Minimum_Investment);
            const displayMinInvest = isNaN(minInvestVal)
              ? ""
              : `$${Number(minInvestVal).toLocaleString()}`;

            // Total Assets => e.g. 379 => $379.0M
            const totalAssetsVal = parseFloat(row.Total_Real_Estate_Assets_M_);
            const displayTotalAssets = isNaN(totalAssetsVal)
              ? ""
              : `$${totalAssetsVal.toFixed(1)}M`;

            setCompanyName(row.Company_Name || "");
            setPropertyTypes(row.Property_Types || "");
            setManagementFees(displayFees);
            setDistributionFrequency(row.Distribution_Frequency || "");
            setMinimumInvestment(displayMinInvest);
            setTotalAssets(displayTotalAssets);
            setWebsite(row.Website || "");
          }
        } else {
          setError("No rec_universe data returned from server.");
        }
      })
      .catch((err) => {
        console.error("Error fetching rec_universe:", err);
        setError("Error fetching rec_universe.");
      });

    // B) Fetch Performance
    fetch(`${API_BASE_URL}/api/rec/${encodeURIComponent(vehicle)}/performance`)
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          setError(data.message);
        } else {
          setTotalReturnData(data.total_return || []);
          setDistributionYieldData(data.distribution_yield || []);
          setNavGrowthData(data.nav_growth || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching performance data:", err);
        setError("Error fetching time-series data.");
        setLoading(false);
      });
  }, [vehicle]);

  // -------------- Helpers ---------------
  const isEmptySeries = (arr) => !arr || arr.length === 0;

  // Build bar chart config from raw date/value data
  // data[i].value => e.g. 0.025 means +2.5%
  const makeBarData = (rawData, labelText) => {
    return {
      labels: rawData.map((item) => item.date),
      datasets: [
        {
          label: labelText,
          data: rawData.map((item) => item.value * 100),
          backgroundColor: (context) => {
            const val = context.parsed.y;
            return val >= 0
              ? "rgba(177, 45, 120, 0.8)"
              : "rgba(90, 21, 61, 0.8)";
          },
          datalabels: {
            display: false, // This disables the labels on each bar.
          },
        },
      ],
    };
  };  

  // Bar chart config
  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: true },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: function (context) {
            // e.g. 2.5 => "2.50%"
            const val = context.parsed.y;
            return `${context.dataset.label}: ${val.toFixed(2)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          parser: "yyyy-MM-dd",
          tooltipFormat: "MMM d, yyyy",
          unit: "month",  // or "quarter" if data is spaced that way
          displayFormats: {
            month: "MMM yyyy",
          },
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: false,
        // Enable grid but color only the 0% line
        grid: {
          // We'll show all horizontal lines as transparent except the zero line
          color: (context) => {
            return context.tick.value === 0
              ? "rgba(0,0,0,0.2)" // faint line at 0%
              : "transparent";   // hide other lines
          },
        },
        ticks: {
          // e.g. 2.5 => "2.50%"  or 0 => "0.00%"
          callback: (value) => `${parseFloat(value).toFixed(2)}%`,
        },
      },
    },
  };

  // -------------- Rendering ---------------
  if (loading) {
    return (
      <div className="detail-page" style={{ padding: "20px" }}>
        <h2>{vehicle} - Crowdfunding Dashboard</h2>
        <p>Loading vehicle data...</p>
        <button className="back-button" onClick={() => navigate("/Crowdfunding")}>
          Back to Crowdfunding
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="detail-page" style={{ padding: "20px" }}>
        <h2>{vehicle} - Crowdfunding Dashboard</h2>
        <p>{error}</p>
        <button className="back-button" onClick={() => navigate("/Crowdfunding")}>
          Back to Crowdfunding
        </button>
      </div>
    );
  }

  // The styling for the grey boxes
  const sectionContainer = {
    backgroundColor: "#f9f9f9",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px",
  };

  return (
    <div className="detail-page" style={{ padding: "20px" }}>

      {/* Title */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>{vehicle}</h2>
        {companyName && <p style={{ marginTop: "10px" }}>Launched by: {companyName}</p>}
      </div>

      {/* Business Statistics */}
      <div style={sectionContainer}>
        <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Vehicle Information</h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "10px",
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc", width: "40%" }}>
                Property Types
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {propertyTypes || "N/A"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>Management Fees</td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {managementFees || "N/A"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Distribution Frequency
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {distributionFrequency || "N/A"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Minimum Investment
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {minimumInvestment || "N/A"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Total Real Estate Assets
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {totalAssets || "N/A"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                Official Website
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {website ? (
                  <a
                    href={
                      website.startsWith("http") ? website : `https://${website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007bff" }}
                  >
                    {website}
                  </a>
                ) : (
                  "N/A"
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Performance Data title -> OUTSIDE the grey boxes */}
      <h3 style={{ marginBottom: "10px" }}>Performance Data</h3>

      {/* 1) TOTAL RETURN */}
      <div style={sectionContainer}>
        <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
          Total Return
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
              Indicate each monthly period’s net return, calculated by 
              (Current NAV + last month’s distribution) / (Last month’s NAV) - 1.
            </span>
          </span>
        </h4>
        {isEmptySeries(totalReturnData) ? (
          <p>No total return data available.</p>
        ) : (
          <Bar
            data={makeBarData(totalReturnData, "Monthly Total Return")}
            options={barOptions}
            height={80}
          />
        )}
      </div>

      {/* 2) DISTRIBUTION YIELD */}
      <div style={sectionContainer}>
        <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
          Distribution Yield
        </h4>
        {isEmptySeries(distributionYieldData) ? (
          <p>No distribution yield data available.</p>
        ) : (
          <Bar
            data={makeBarData(distributionYieldData, "Monthly Distribution Yield")}
            options={barOptions}
            height={80}
          />
        )}
      </div>

      {/* 3) NAV GROWTH */}
      <div style={sectionContainer}>
        <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
          NAV Growth
        </h4>
        {isEmptySeries(navGrowthData) ? (
          <p>No NAV growth data available.</p>
        ) : (
          <Bar
            data={makeBarData(navGrowthData, "Monthly NAV Growth")}
            options={barOptions}
            height={80}
          />
        )}
      </div>

      {/* Back Button */}
      <button className="back-button" onClick={() => navigate("/Crowdfunding")}>
        Back to Crowdfunding
      </button>
    </div>
  );
}

export default RecDetailPage;
