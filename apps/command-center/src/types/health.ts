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
  message?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface SystemInfo {
  name?: string;
  version: string;
  phase?: string;
  status?: string;
  uptime: number | string;
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

export interface ChannelStatus {
  enabled: boolean;
  status: 'healthy' | 'degraded' | 'error' | 'disabled';
  lastCheckAt: string | null;
  lastSuccessAt: string | null;
  unreadCount: number;
  urgentCount: number;
  error?: string;
  sessionValid?: boolean; // For Outlook
  hasAccess?: boolean; // For iMessage/Phone
}

export interface CommunicationMonitorStatus {
  gmail: ChannelStatus;
  outlook: ChannelStatus;
  imessage: ChannelStatus;
  phoneCalls: ChannelStatus;
  lastTriageRun: string | null;
  alertsSentToday: number;
  pendingInTriage: number;
}
