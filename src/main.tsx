import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client'
import { Buffer } from 'buffer' // IT: Polyfill Buffer per il browser. EN: Buffer polyfill for browser.
import App from './App.tsx'
import './index.css'
import './i18n' // IT: Inizializza i18next. EN: Initializes i18next.

// IT: Rende Buffer disponibile globalmente.
// EN: Makes Buffer globally available.
window.Buffer = Buffer;

// IT: Monta l'applicazione React nel DOM.
// EN: Mounts the React application into the DOM.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* IT: Suspense per caricamento asincrono (es. traduzioni). EN: Suspense for async loading (e.g., translations). */}
    <Suspense fallback="Loading translations...">
      <App />
    </Suspense>
  </React.StrictMode>,
);