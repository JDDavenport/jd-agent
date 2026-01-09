const API_BASE = '/api/jobs';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.error?.message || error.message || 'Request failed');
  }

  return response.json();
}

// Jobs API
export const jobsApi = {
  list: (filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return fetchApi<{ data: any[]; count: number }>(`${API_BASE}${params}`);
  },

  get: (id: string) => fetchApi<{ data: any }>(`${API_BASE}/${id}`),

  create: (data: any) => fetchApi<{ data: any }>(`${API_BASE}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  createManual: (data: any) => fetchApi<{ data: any }>(`${API_BASE}/manual`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => fetchApi<{ data: any }>(`${API_BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => fetchApi<{ success: boolean }>(`${API_BASE}/${id}`, {
    method: 'DELETE',
  }),

  markApplied: (id: string, data?: any) => fetchApi<{ data: any }>(`${API_BASE}/${id}/apply`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  }),

  archive: (id: string) => fetchApi<{ data: any }>(`${API_BASE}/${id}/archive`, {
    method: 'POST',
  }),

  getStats: () => fetchApi<{ data: any }>(`${API_BASE}/stats`),

  getFollowUps: () => fetchApi<{ data: any[] }>(`${API_BASE}/follow-ups`),

  getHistory: (id: string) => fetchApi<{ data: any[] }>(`${API_BASE}/${id}/history`),
};

// Resumes API
export const resumesApi = {
  list: () => fetchApi<{ data: any[] }>(`${API_BASE}/resumes`),

  get: (id: string) => fetchApi<{ data: any }>(`${API_BASE}/resumes/${id}`),

  getDefault: () => fetchApi<{ data: any }>(`${API_BASE}/resumes/default`),

  create: (data: any) => fetchApi<{ data: any }>(`${API_BASE}/resumes`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => fetchApi<{ data: any }>(`${API_BASE}/resumes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  setDefault: (id: string) => fetchApi<{ data: any }>(`${API_BASE}/resumes/${id}/set-default`, {
    method: 'POST',
  }),

  delete: (id: string) => fetchApi<{ success: boolean }>(`${API_BASE}/resumes/${id}`, {
    method: 'DELETE',
  }),

  selectForJob: (jobId: string) => fetchApi<{ data: any }>(`${API_BASE}/resumes/select/${jobId}`, {
    method: 'POST',
  }),
};

// Profile API
export const profileApi = {
  get: () => fetchApi<{ data: any }>(`${API_BASE}/profile`),

  update: (data: any) => fetchApi<{ data: any }>(`${API_BASE}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

// Screening API
export const screeningApi = {
  list: () => fetchApi<{ data: any[] }>(`${API_BASE}/screening`),

  create: (data: any) => fetchApi<{ data: any }>(`${API_BASE}/screening`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => fetchApi<{ data: any }>(`${API_BASE}/screening/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => fetchApi<{ success: boolean }>(`${API_BASE}/screening/${id}`, {
    method: 'DELETE',
  }),

  match: (question: string) => fetchApi<{ data: any }>(`${API_BASE}/screening/match`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  }),
};

// Chat API
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  jobsAffected?: string[];
  timestamp: Date;
}

export interface ChatResponse {
  success: boolean;
  data: {
    message: string;
    toolsUsed: string[];
    jobsAffected?: string[];
  };
}

export const chatApi = {
  send: (message: string) => fetchApi<ChatResponse>(`${API_BASE}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),

  clear: () => fetchApi<{ success: boolean }>(`${API_BASE}/chat/clear`, {
    method: 'POST',
  }),

  status: () => fetchApi<{ data: { configured: boolean; historyLength: number } }>(`${API_BASE}/chat/status`),
};
