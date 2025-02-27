import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Load backend URL from environment variable
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function FilterPage() {
  const [reits, setReits] = useState([]);
  const [explanation, setExplanation] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedPropertyType, setSelectedPropertyType] = useState("");

  const countryOptions = ["United States", "United Kingdom", "Canada"];
  const propertyTypeOptions = [
    "Apartments",
    "Industrial Assets",
    "Office Buildings",
    "Data Centers",
    "Single Family Houses",
    "Hotels/Resorts",
    "Retail Centers",
    "Health Care Communities",
    "Self Storage",
    "Infrastructure",
    "Manufactured Homes",
    "Specialty",
    "Timber",
    "Medical Facilities",
    "Life Science Laboratories"
  ];

  const navigate = useNavigate();

  useEffect(() => {
    if (selectedCountry && selectedPropertyType) {
      fetchREITs();
    }
  }, [selectedCountry, selectedPropertyType]);

  const fetchREITs = () => {
    console.log("fetchREITs called with:", { selectedCountry, selectedPropertyType });

    const url = `${API_BASE_URL}/api/reits`;

    axios
      .get(url, {
        params: {
          country: selectedCountry,
          property_type: selectedPropertyType
        }
      })
      .then((response) => {
        console.log("Request made to:", url, {
          country: selectedCountry,
          property_type: selectedPropertyType
        });

        let responseData;
        if (typeof response.data === "string") {
          console.warn("Response data is a string, attempting to parse...");
          try {
            responseData = JSON.parse(response.data);
          } catch (err) {
            console.error("JSON parsing failed!", err);
            return;
          }
        } else {
          responseData = response.data;
        }

        console.log("Fetched Data:", responseData);
        console.log("Type of response.data:", typeof responseData);
        console.log("Keys in response.data:", Object.keys(responseData));
        console.log("Value of explanation:", responseData.explanation);

        setReits(responseData.reits || []);
        setExplanation(prev => {
          console.log("Previous explanation:", prev);
          console.log("New explanation being set:", responseData.explanation);
          return responseData.explanation || "No explanation provided.";
        });
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setReits([]);
      });
  };

  const formatWebsiteUrl = (url) => {
    if (!url) return "No website available";
    return url.startsWith("http") ? url : `https://${url}`;
  };

  return (
    <div className="filter-page">
      <h2>REIT Screener</h2>

      {/* Country Selection */}
      <label>Select Country:</label>
      <select
        value={selectedCountry}
        onChange={(e) => setSelectedCountry(e.target.value)}
      >
        <option value="">-- Select Country --</option>
        {countryOptions.map((country) => (
          <option key={country} value={country}>
            {country}
          </option>
        ))}
      </select>

      <br />

      {/* Property Type Selection */}
      <label>Select Property Type:</label>
      <select
        value={selectedPropertyType}
        onChange={(e) => setSelectedPropertyType(e.target.value)}
      >
        <option value="">-- Select Property Type --</option>
        {propertyTypeOptions.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <h2>Filtered REITs</h2>
      <p>{explanation}</p>

      <table border="1" cellPadding="6" className="reits-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Company Name</th>
            <th>Description</th>
            <th>Website</th>
          </tr>
        </thead>
        <tbody>
          {reits.length > 0 ? (
            reits.map((reit, index) => {
              console.log(
                `REIT #${index} Ticker type:`,
                typeof reit.Ticker,
                "value:",
                reit.Ticker
              );
              return (
                <tr key={index}>
                  <td>
                    <button onClick={() => navigate(`/reits/${reit.Ticker}`)}>
                      {reit.Ticker}
                    </button>
                  </td>
                  <td>{reit.Company_Name}</td>
                  <td>{reit.Business_Description || "No description available."}</td>
                  <td>
                    {reit.Website ? (
                      <a
                        href={formatWebsiteUrl(reit.Website)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Visit
                      </a>
                    ) : (
                      "No website available"
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="4">No REITs available for the selected criteria.</td>
            </tr>
          )}
        </tbody>
      </table>

      <button onClick={() => navigate("/")}>Back to Home</button>
    </div>
  );
}

export default FilterPage;
