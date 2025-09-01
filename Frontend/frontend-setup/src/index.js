import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.js';

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key from Clerk Dashboard');
}

// Use the proxy only in production (Vercel rewrite exists there).
const clerkProps =
  process.env.NODE_ENV === 'production'
    ? {
        publishableKey: PUBLISHABLE_KEY,
        proxyUrl: '/clerk-proxy',
        // Safe: load the Clerk JS bundle from the official CDN
        clerkJSUrl:
          'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js',
      }
    : {
        publishableKey: PUBLISHABLE_KEY,
      };

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider {...clerkProps}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
