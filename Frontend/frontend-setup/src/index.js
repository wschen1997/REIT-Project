import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.js';

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key from Clerk Dashboard");
}

// Create an object to hold the props for ClerkProvider
const clerkProviderProps = {
  publishableKey: PUBLISHABLE_KEY,
};

// Only add the frontendApi prop if we are in production
if (process.env.NODE_ENV === 'production') {
  const FRONTEND_API = process.env.REACT_APP_CLERK_FRONTEND_API;
  if (!FRONTEND_API) {
    throw new Error("Missing Clerk Frontend API URL for production build");
  }
  clerkProviderProps.frontendApi = FRONTEND_API;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Spread the props into the ClerkProvider */}
    <ClerkProvider {...clerkProviderProps}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);