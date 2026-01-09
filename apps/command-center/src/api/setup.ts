import apiClient from './client';

export interface SetupStatus {
  complete: boolean;
  currentStep: number;
  services: ServiceStatus[];
}

export interface ServiceStatus {
  name: string;
  displayName: string;
  configured: boolean;
  connected: boolean;
  required: boolean;
}

export interface InboxItem {
  id: string;
  title: string;
  description?: string;
  context?: string;
  source: string;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string;
  courseCode: string;
  professor?: string;
  canvasCourseId?: string;
  schedule?: {
    days: string[];
    startTime: string;
    endTime: string;
  };
}

export interface CanvasCourse {
  id: string;
  name: string;
  courseCode: string;
}

export interface CeremonyConfig {
  morningTime: string;
  eveningTime: string;
  weeklyDay: string;
  weeklyTime: string;
  notificationChannels: {
    telegram: { configured: boolean; chatId: string | null };
    sms: { configured: boolean; phoneNumber: string | null };
    email: { configured: boolean; email: string | null };
  };
}

export const setupApi = {
  getStatus: async (): Promise<SetupStatus> => {
    return apiClient.get('/setup/status');
  },

  getServices: async (): Promise<ServiceStatus[]> => {
    return apiClient.get('/setup/services');
  },

  testService: async (service: string): Promise<{ message: string }> => {
    return apiClient.post(`/setup/connect/${service}/test`, {});
  },

  addBrainDumpTask: async (title: string, context?: string): Promise<{ id: string; title: string }> => {
    return apiClient.post('/setup/brain-dump', { title, context });
  },

  addBulkTasks: async (tasks: Array<{ title: string; context?: string }>): Promise<Array<{ id: string; title: string }>> => {
    return apiClient.post('/setup/brain-dump/bulk', { tasks });
  },

  getInbox: async (): Promise<InboxItem[]> => {
    return apiClient.get('/setup/inbox');
  },

  getNextInboxItem: async (): Promise<{ data: InboxItem | null; remaining: number }> => {
    return apiClient.get('/setup/inbox/next');
  },

  processInboxItem: async (
    id: string,
    action: 'today' | 'upcoming' | 'someday' | 'waiting' | 'delete',
    options?: {
      dueDate?: string;
      context?: string;
      priority?: number;
      waitingFor?: string;
    }
  ): Promise<{ id: string; title: string; status: string }> => {
    return apiClient.post(`/setup/inbox/${id}/process`, { action, ...options });
  },

  getCeremonies: async (): Promise<CeremonyConfig> => {
    return apiClient.get('/setup/ceremonies');
  },

  testCeremony: async (type: string): Promise<{ channel: string; preview: any }> => {
    return apiClient.post('/setup/ceremonies/test', { type });
  },

  getClasses: async (): Promise<Class[]> => {
    return apiClient.get('/setup/classes');
  },

  addClass: async (classData: Omit<Class, 'id'>): Promise<Class> => {
    return apiClient.post('/setup/classes', classData);
  },

  getCanvasCourses: async (): Promise<CanvasCourse[]> => {
    return apiClient.get('/setup/canvas/courses');
  },

  getSummary: async (): Promise<{
    setupComplete: boolean;
    connectedServices: string[];
    pendingServices: string[];
    taskCounts: any;
    classCount: number;
    nextSteps: string[];
  }> => {
    return apiClient.get('/setup/summary');
  },

  markComplete: async (): Promise<SetupStatus> => {
    return apiClient.post('/setup/complete', {});
  },

  previewMorning: async (): Promise<{ content: any; formatted: string }> => {
    return apiClient.get('/setup/preview/morning');
  },
};
