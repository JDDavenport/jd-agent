import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Prevent default context menu in Tauri to allow custom right-click menus
document.addEventListener('contextmenu', (e) => {
  // Only prevent if we're in Tauri (window.__TAURI__ exists)
  if (window.__TAURI__) {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
