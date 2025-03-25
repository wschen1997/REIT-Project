import React from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.js';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// Auth0 settings
const domain = "dev-f76bvg6s71ylnhnz.us.auth0.com";
const clientId = "wWv9bQrDxrfWKJ6RKYBQ0augXG8NCBaG";
const audience = "https://viserra-api"; // ✅ Replace this if your actual identifier is different

// Enable debugging logs in the browser console
localStorage.setItem("auth0.debug", "true");

root.render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    authorizationParams={{
      redirect_uri: window.location.origin,
      audience: audience,
    }}
    cacheLocation="localstorage"
    useRefreshTokens={true}
  >
    <App />
  </Auth0Provider>
);
