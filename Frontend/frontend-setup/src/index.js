import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

// Grab the root element from the DOM
const rootElement = document.getElementById('root');

// Create a root and render your <App /> into it
const root = createRoot(rootElement);
root.render(<App />);


