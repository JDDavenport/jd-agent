import apiClient from './client';
import type { SystemInfo, HealthMetrics, IntegrityCheck, ActivityLog, CommunicationMonitorStatus } from '../types/health';

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

// Garmin types
export interface GarminStatus {
  configured: boolean;
  installed: boolean;
  authenticated: boolean;
  displayName: string | null;
  error: string | null;
}

export interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType: string | null;
  startTime: string;
  duration: number | null;
  distance: number | null;
  calories: number | null;
  avgHR: number | null;
  maxHR: number | null;
}

export interface GarminDailyMetrics {
  steps: number | null;
  restingHR: number | null;
  sleepHours: number | null;
  sleepScore: number | null;
  stressLevel: number | null;
  bodyBattery: number | null;
}

export interface CombinedHealthData {
  timestamp: string;
  whoop: {
    recovery: {
      score: number;
      restingHeartRate: number;
      hrv: number;
    } | null;
    sleep: {
      totalSleepHours: number;
    } | null;
  } | null;
  garmin: GarminDailyMetrics | null;
}

export interface BasicHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
  };
}

export const healthApi = {
  // Basic health check for system status indicator
  checkHealth: async (): Promise<BasicHealthResponse> => {
    return apiClient.get('/health');
  },

  getSystemInfo: async (): Promise<SystemInfo> => {
    return apiClient.get('/system/info');
  },

  getHealthMetrics: async (): Promise<HealthMetrics> => {
    return apiClient.get('/analytics/health');
  },

  getIntegrityChecks: async (limit: number = 20): Promise<IntegrityCheck[]> => {
    const checks = await apiClient.get(`/system/integrity/history?limit=${limit}`);
    if (!Array.isArray(checks)) {
      return [];
    }

    return checks.map((check, index) => {
      const timestamp =
        check.timestamp
        || check.createdAt
        || check.completedAt
        || check.updatedAt
        || new Date().toISOString();
      const status: IntegrityCheck['status'] = check.status
        || (check.passed === true ? 'pass' : check.passed === false ? 'fail' : 'warning');
      const message = check.message || check.details?.message;
      const id = check.id || `${check.type || 'check'}-${timestamp}-${index}`;

      return {
        id,
        type: check.type || check.name || 'unknown',
        status,
        message,
        timestamp,
        details: check.details,
      };
    });
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

  getCommunicationStatus: async (): Promise<CommunicationMonitorStatus> => {
    return apiClient.get('/system/communications/status');
  },

  runCommunicationCheck: async (): Promise<{
    outlook: { new: number; urgent: number; notified: number };
    imessage: { new: number; urgent: number; notified: number };
    phoneCalls: { new: number; urgent: number; notified: number };
    totalNew: number;
    totalUrgent: number;
    totalNotified: number;
  }> => {
    return apiClient.post('/system/communications/check', {});
  },

  // Garmin endpoints
  getGarminStatus: async (): Promise<GarminStatus> => {
    return apiClient.get('/garmin/status');
  },

  getGarminActivities: async (limit: number = 5): Promise<GarminActivity[]> => {
    return apiClient.get(`/garmin/activities?limit=${limit}`);
  },

  getGarminMetrics: async (): Promise<GarminDailyMetrics> => {
    return apiClient.get('/garmin/metrics');
  },

  getCombinedHealth: async (): Promise<CombinedHealthData> => {
    return apiClient.get('/health/combined');
  },
};
