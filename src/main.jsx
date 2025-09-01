import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import './styles/main.scss';
import { CarritoProvider } from './context/CarritoContext';

import { startVersionWatcher } from './utils/versionWatcher';

// Iniciá el watcher solo en PROD
if (!import.meta.env.DEV) {
  if (!window.__VW_STARTED) {
    window.__VW_STARTED = true; // evita duplicado por StrictMode
    startVersionWatcher({ intervalMs: 10000 }); // 10s - Balance perfecto entre responsividad y performance
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <CarritoProvider>
        <AppRouter />
      </CarritoProvider>
    </AuthProvider>
  </React.StrictMode>
);
