import apiClient from './client';

export interface DashboardData {
  tasks: {
    today: number;
    overdue: number;
    upcoming: number;
    inbox: number;
  };
  calendar: {
    todayEvents: number;
    upcomingEvents: number;
  };
  vault: {
    totalEntries: number;
    thisWeek: number;
  };
  recordings: {
    total: number;
    unprocessed: number;
  };
  health?: {
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'not_configured' | 'unknown';
    recoveryScore: number | null;
    hasData: boolean;
  };
  timeTracking?: {
    todayMinutes: number;
    productiveMinutes: number;
    wasteMinutes: number;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: string;
  };
}

export const getDashboardData = async (): Promise<DashboardData> => {
  return apiClient.get('/analytics/dashboard');
};

export const getTaskAnalytics = async (period: string = '7d') => {
  const response = await apiClient.get(`/analytics/tasks?period=${period}`);
  return response;
};

export const getSystemHealth = async () => {
  const response = await apiClient.get('/analytics/health');
  return response;
};
