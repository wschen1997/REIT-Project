import React from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.js';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// Use your actual Auth0 values here
const domain = "dev-f76bvg6s71ylnhnz.us.auth0.com";
const clientId = "wWv9bQrDxrfWKJ6RKYBQ0augXG8NCBaG";

root.render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    authorizationParams={{
      redirect_uri: window.location.origin
    }}
  >
    <App />
  </Auth0Provider>
);
