import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.js';

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key from Clerk Dashboard');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      // Route Clerk traffic through your own domain so the browser never hits the broken custom CNAME.
      proxyUrl="/clerk-proxy"
      // (Optional but safe) Fetch the Clerk JS bundle from the official CDN to avoid any stale custom-domain pointers.
      clerkJSUrl="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
