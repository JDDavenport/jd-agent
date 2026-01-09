import apiClient from './client';
import type { CeremonyConfig, Class } from './setup';

export interface CeremonyStatus {
  notificationsConfigured: boolean;
  availableChannels: string[];
  lastCeremonies: {
    morning: { sentAt: string; status: string } | null;
    evening: { sentAt: string; status: string } | null;
    weekly: { sentAt: string; status: string } | null;
  };
  schedule: {
    morning: string;
    evening: string;
    weekly: string;
  };
}

export const settingsApi = {
  getCeremonyStatus: async (): Promise<CeremonyStatus> => {
    return apiClient.get('/ceremonies/status');
  },

  getCeremonyConfig: async (): Promise<CeremonyConfig> => {
    return apiClient.get('/setup/ceremonies');
  },

  testCeremony: async (type: string): Promise<{ channel: string; preview: any }> => {
    return apiClient.post('/setup/ceremonies/test', { type });
  },

  previewCeremony: async (type: string): Promise<{ content: any; formatted: string }> => {
    return apiClient.get(`/ceremonies/preview/${type}`);
  },

  getClasses: async (): Promise<Class[]> => {
    return apiClient.get('/setup/classes');
  },

  addClass: async (classData: Omit<Class, 'id'>): Promise<Class> => {
    return apiClient.post('/setup/classes', classData);
  },

  deleteClass: async (id: string): Promise<void> => {
    return apiClient.delete(`/setup/classes/${id}`);
  },
};
