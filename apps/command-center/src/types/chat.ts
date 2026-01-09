export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
}

export interface ChatResponse {
  message: string;
  toolsUsed: string[];
  context: {
    currentTime: string;
    todaysTaskCount: number;
    upcomingEventCount: number;
  };
}

export interface SendMessageInput {
  message: string;
  clearHistory?: boolean;
}
