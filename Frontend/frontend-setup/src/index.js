import React from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.js';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// Use your actual Auth0 values here
const domain = "dev-f76bvg6s71ylnhnz.us.auth0.com";
const clientId = "wWv9bQrDxrfWKJ6RKYBQ0augXG8NCBaG";

// Enable debugging logs in the browser console
localStorage.setItem("auth0.debug", "true");

root.render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    authorizationParams={{
      redirect_uri: window.location.origin,
      // Uncomment and set if you're using an API (very likely needed)
      // audience: "https://your-api-identifier"
    }}
    cacheLocation="localstorage"      // So refresh tokens work reliably
    useRefreshTokens={true}           // Recommended for SPAs
  >
    <App />
  </Auth0Provider>
);
