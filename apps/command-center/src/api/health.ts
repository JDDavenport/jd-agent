import apiClient from './client';
import type { SystemInfo, HealthMetrics, IntegrityCheck, ActivityLog } from '../types/health';

export interface PersonalHealthData {
  configured: boolean;
  authorized?: boolean;
  authorizeUrl?: string;
  recovery?: {
    score: number;
    restingHeartRate: number;
    hrv: number;
    createdAt: string;
  } | null;
  sleep?: {
    totalSleepHours: string;
    remSleepMinutes: number;
    deepSleepMinutes: number;
    lightSleepMinutes: number;
    sleepNeeded: {
      baselineHours: string;
    };
    start: string;
    end: string;
  } | null;
  timestamp: string;
  message?: string;
}

export const healthApi = {
  getSystemInfo: async (): Promise<SystemInfo> => {
    return apiClient.get('/system/info');
  },

  getHealthMetrics: async (): Promise<HealthMetrics> => {
    return apiClient.get('/analytics/health');
  },

  getIntegrityChecks: async (limit: number = 20): Promise<IntegrityCheck[]> => {
    return apiClient.get(`/system/integrity/history?limit=${limit}`);
  },

  getActivityLogs: async (limit: number = 20): Promise<ActivityLog[]> => {
    return apiClient.get(`/logs?limit=${limit}`);
  },

  triggerCeremony: async (type: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post(`/ceremonies/run/${type}`, {});
  },

  runIntegrityCheck: async (): Promise<{ success: boolean; results: IntegrityCheck[] }> => {
    return apiClient.post('/system/integrity/check', {});
  },

  getPersonalHealth: async (): Promise<PersonalHealthData> => {
    return apiClient.get('/health/personal');
  },

  getHealthStatus: async (): Promise<{
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'not_configured' | 'unknown';
    score: number;
    hasData: boolean;
  }> => {
    return apiClient.get('/health/status');
  },
};
