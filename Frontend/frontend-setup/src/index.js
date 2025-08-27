import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.js'; // This is correct, it uses App.css

// There is no index.css file, so we do not import it here.

// Paste your Publishable Key from the Clerk Dashboard here
const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY; 

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key from Clerk Dashboard");
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      // --- MODIFICATION START ---
      // This tells Clerk to use the proxy URL you configured
      proxyUrl="https://viserra-group.com/clerk-proxy"
      // --- MODIFICATION END ---
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
