// App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import * as ReactGaModule from "react-ga4";

import HomePage from "./pages/HomePage.js";
import FilterPage from "./pages/FilterPage.js";
import DetailPage from "./pages/DetailPage.js";
import CrowdfundingPage from "./pages/Crowdfunding.js";
import RecDetailPage from "./pages/RecDetailPage.js";
import AboutUs from "./pages/AboutUs.js";
import ContactUs from "./pages/ContactUs.js";
import PricingPage from "./pages/Pricing.js";
import Login from "./pages/Login.js";
import Signup from "./pages/Signup.js";
import Useraccount from "./pages/Useraccount.js";
import Header from "./components/Header.js";

import "./App.css";

// Log to see exactly what's in ReactGaModule
console.log("ReactGaModule is:", ReactGaModule);
console.log("ReactGaModule.default is:", ReactGaModule.default);

// The second .default is your GA4 instance
const realGA = ReactGaModule.default.default;

// Now you can call .initialize on the real GA object
const TRACKING_ID = "G-HH9G61RW3G"; // Your GA4 measurement ID
realGA.initialize(TRACKING_ID);

// Track pageviews on route change
function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    realGA.send({ hitType: "pageview", page: location.pathname });
  }, [location]);
  return null;
}

function App() {
  // Track the user's plan here in App, so Header can fill it, and DetailPage can use it
  const [userPlan, setUserPlan] = useState(null);

  return (
    <div className="App">
      <Router>
        <AnalyticsTracker />

        {/* 1) Render Header, passing userPlan & setUserPlan so it can update the plan */}
        <Header userPlan={userPlan} setUserPlan={setUserPlan} />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/filter" element={<FilterPage />} />

          {/* 2) Pass userPlan to DetailPage for content gating */}
          <Route path="/reits/:ticker" element={<DetailPage userPlan={userPlan} />} />
          <Route path="/Crowdfunding" element={<CrowdfundingPage />} />
          <Route path="/Crowdfunding/:vehicle" element={<RecDetailPage userPlan={userPlan} />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/user" element={<Useraccount />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
