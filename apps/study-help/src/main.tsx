import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './index.css';

console.log('=== STUDY-HELP LOADING ===');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
    },
  },
});

const rootEl = document.getElementById('root');
console.log('Root element:', rootEl);

if (rootEl) {
  try {
    console.log('Creating React root...');
    const root = ReactDOM.createRoot(rootEl);
    console.log('Rendering app...');
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log('Render called successfully');
  } catch (e) {
    console.error('FATAL RENDER ERROR:', e);
    rootEl.innerHTML = '<pre style="color:red">RENDER ERROR: ' + String(e) + '</pre>';
  }
} else {
  console.error('ROOT ELEMENT NOT FOUND!');
}
