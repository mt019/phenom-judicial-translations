import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { bootSitePalette } from '@phenomcanvas/ui';
import './tailwind.css';
import '@phenomcanvas/ui/styles.css';
import App from './App.jsx';

bootSitePalette();

hydrateRoot(
  document.getElementById('root'),
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
