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
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { ThemeProvider } from './context/ThemeContext.js';
import VerifyEmail from "./pages/VerifyEmail.js";
import ResetPassword from "./pages/ResetPassword.js";
import BottomBanner from "./components/BottomBanner.js";
import { LoadingProvider, useLoading } from './context/LoadingContext.js';
import Loading from "./components/Loading.js";
import "./App.css";

// Log to see exactly what's in ReactGaModule
console.log("ReactGaModule is:", ReactGaModule);
console.log("ReactGaModule.default is:", ReactGaModule.default);

// The second .default is your GA4 instance
const realGA = ReactGaModule.default.default;

// Now you can call .initialize on the real GA object
const TRACKING_ID = "G-HH9G61RW3G"; // Your GA4 measurement ID
realGA.initialize(TRACKING_ID);


const MainLayout = ({ children }) => {
  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
      {children}
    </main>
  );
};

// Track pageviews on route change
function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    realGA.send({ hitType: "pageview", page: location.pathname });
  }, [location]);
  return null;
}

// This new component contains your original app logic.
// It's needed so we can call the `useLoading` hook inside the LoadingProvider.
const AppContent = () => {
  const { isLoading } = useLoading(); // Get global loading state
  const [userPlan, setUserPlan] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("%cAuth state changed in App.js!", "color: blue; font-weight: bold;", user); //
      setCurrentUser(user); // Set the user object when auth state changes
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="App">
      {isLoading && <Loading />} {/* Conditionally render the Loading component */}
      <Router>
        <AnalyticsTracker />
        <Header currentUser={currentUser} userPlan={userPlan} setUserPlan={setUserPlan} />
        <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/filter" element={<FilterPage />} />
          <Route path="/reits/:ticker" element={<DetailPage userPlan={userPlan} />} />
          <Route path="/Crowdfunding" element={<CrowdfundingPage />} />
          <Route path="/Crowdfunding/:vehicle" element={<RecDetailPage userPlan={userPlan} />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/pricing" element={<PricingPage currentUser={currentUser} userPlan={userPlan} />} />
          <Route path="/user" element={<Useraccount />} />
          <Route path="/login" element={<Login currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
          <Route path="/signup" element={<Signup currentUser={currentUser} />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
        </main>
        <BottomBanner />
      </Router>
    </div>
  );
};

// The main App component now simply wraps everything with the necessary providers.
function App() {
  return (
    <ThemeProvider>
      <LoadingProvider>
        <AppContent />
      </LoadingProvider>
    </ThemeProvider>
  );
}

export default App;