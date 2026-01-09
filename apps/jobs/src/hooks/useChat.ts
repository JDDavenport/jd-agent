import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, type ChatMessage } from '@/lib/api';

export function useChatStatus() {
  return useQuery({
    queryKey: ['chat-status'],
    queryFn: () => chatApi.status(),
    refetchInterval: 30000,
  });
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatApi.send(content);

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.data.message,
        toolsUsed: response.data.toolsUsed,
        jobsAffected: response.data.jobsAffected,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Invalidate job queries if jobs were affected
      if (response.data.jobsAffected?.length || response.data.toolsUsed?.length) {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['job-stats'] });
        queryClient.invalidateQueries({ queryKey: ['job-follow-ups'] });
      }

      return assistantMessage;
    } catch (error) {
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  const clearChat = useCallback(async () => {
    try {
      await chatApi.clear();
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
  };
}

export function useClearChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => chatApi.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-status'] });
    },
  });
}
