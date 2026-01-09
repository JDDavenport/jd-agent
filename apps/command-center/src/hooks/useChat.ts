import { useMutation } from '@tanstack/react-query';
import * as chatApi from '../api/chat';
import type { SendMessageInput } from '../types/chat';

export function useSendMessage() {
  return useMutation({
    mutationFn: (data: SendMessageInput) => chatApi.sendMessage(data),
  });
}

export function useClearChatHistory() {
  return useMutation({
    mutationFn: () => chatApi.clearChatHistory(),
  });
}
