// Crowdfunding.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.js";

// Load backend URL from environment variable
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function CrowdfundingPage() {
  const [recVehicles, setRecVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchRecVehicles();
  }, []);

  const fetchRecVehicles = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/rec/universe`);
      if (response.data && response.data.rec_universe) {
        setRecVehicles(response.data.rec_universe);
      } else {
        setRecVehicles([]);
      }
    } catch (error) {
      console.error("Error fetching REC universe:", error);
      setRecVehicles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatWebsiteUrl = (url) => {
    if (!url) return "";
    return url.startsWith("http") ? url : `https://${url}`;
  };

  const handleViewDetails = (vehicleName) => {
    // URL-encode in case of spaces or special chars
    const encodedName = encodeURIComponent(vehicleName);
    navigate(`/crowdfunding/${encodedName}`);
  };

  return (
    <div className="crowdfunding-page">
      <Header />
      <h2>All Real Estate Crowdfunding Vehicles</h2>

      {isLoading ? (
        <p>Loading crowdfundings...</p>
      ) : (
        <>
          {recVehicles.length === 0 ? (
            <p>No crowdfunding vehicles found.</p>
          ) : (
            <table border="1" cellPadding="6" className="crowdfunding-table">
              <thead>
                <tr>
                  <th>Vehicle Name</th>
                  <th>Company Name</th>
                  <th>Property Types</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {recVehicles.map((vehicle, index) => {
                  const vehicleName = vehicle.Investment_Vehicle || "Unknown Vehicle";
                  return (
                    <tr key={index}>
                      {/* Use a button to navigate to detail page */}
                      <td>
                        <button onClick={() => handleViewDetails(vehicleName)}>
                          {vehicleName}
                        </button>
                      </td>
                      <td>
                        {vehicle.Company_Name || "No company info"}
                      </td>
                      <td>
                        {vehicle.Property_Types || "No property info"}
                      </td>
                      <td>
                        {vehicle.Website ? (
                          <a
                            href={formatWebsiteUrl(vehicle.Website)}
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
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      <button onClick={() => navigate("/")}>Back to Home</button>
    </div>
  );
}

export default CrowdfundingPage;
