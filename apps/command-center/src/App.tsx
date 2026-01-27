import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import VaultExplorer from './pages/VaultExplorer';
import VaultRedirect from './pages/VaultRedirect';
import SystemHealth from './pages/SystemHealth';
import PersonalHealth from './pages/PersonalHealth';
import CanvasIntegrity from './pages/CanvasIntegrity';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import Setup from './pages/Setup';
import BrainDump from './pages/BrainDump';
import Goals from './pages/Goals';
import Habits from './pages/Habits';
import Progress from './pages/Progress';
import Journal from './pages/Journal';
import Recordings from './pages/Recordings';
import Remarkable from './pages/Remarkable';
import Acquisition from './pages/Acquisition';
import Roadmap from './pages/Roadmap';
import WeeklyPlanning from './pages/WeeklyPlanning';
import Finance from './pages/Finance';
import FinanceReports from './pages/FinanceReports';
import FinanceSettings from './pages/FinanceSettings';
import ErrorBoundary from './components/common/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: true, // Enable for desktop app - refresh when user switches back
      refetchOnReconnect: true, // Refresh when network reconnects
      retry: 2, // Increased retry attempts
      gcTime: 1000 * 60 * 15, // Keep unused data in cache for 15 minutes (was cacheTime)
    },
  },
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  // Trigger Plaud sync when app opens
  useEffect(() => {
    fetch(`${API_URL}/api/recordings/sync`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('[App] Plaud sync triggered on app load');
        }
      })
      .catch(err => {
        // Silently fail - sync is best-effort
        console.debug('[App] Plaud sync trigger failed:', err);
      });
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Main app with sidebar layout */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/weekly-planning" element={<WeeklyPlanning />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/acquisition" element={<Acquisition />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/finance/reports" element={<FinanceReports />} />
              <Route path="/finance/settings" element={<FinanceSettings />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/habits" element={<Habits />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/vault" element={<VaultExplorer />} />
              <Route path="/vault/new" element={<VaultRedirect />} />
              <Route path="/vault/:id" element={<VaultRedirect />} />
              <Route path="/health" element={<SystemHealth />} />
              <Route path="/personal-health" element={<PersonalHealth />} />
              <Route path="/canvas" element={<CanvasIntegrity />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/remarkable" element={<Remarkable />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Full-screen pages (no sidebar) */}
            <Route path="/chat" element={<Chat />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/brain-dump" element={<BrainDump />} />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
