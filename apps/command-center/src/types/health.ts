export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: string;
  responseTime?: number;
  message?: string;
}

export interface IntegrationStatus {
  name: string;
  enabled: boolean;
  connected: boolean;
  lastSync?: string;
  error?: string;
}

export interface IntegrityCheck {
  id: string;
  type: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface SystemInfo {
  version: string;
  uptime: number;
  environment: string;
  services: ServiceStatus[];
  integrations: IntegrationStatus[];
}

export interface HealthMetrics {
  tasksCompleted7d: number;
  timeTracked7d: number;
  vaultEntries7d: number;
  dailyStats: Array<{
    date: string;
    tasksCompleted: number;
    timeTracked: number;
  }>;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  metadata?: Record<string, any>;
}
