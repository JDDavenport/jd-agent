import apiClient from './client';
import type { ChatResponse, SendMessageInput } from '../types/chat';

export const sendMessage = async (data: SendMessageInput): Promise<ChatResponse> => {
  return apiClient.post('/chat', data);
};

export const clearChatHistory = async (): Promise<void> => {
  await apiClient.post('/chat/clear');
};

export const getChatContext = async () => {
  const response = await apiClient.get('/chat/context');
  return response;
};
