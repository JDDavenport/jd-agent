import { useState, useRef, useEffect, useCallback } from 'react';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { api } from '../api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  sources?: Array<{
    id: string;
    title: string;
    type: string;
  }>;
  isLoading?: boolean;
}

interface VaultChatProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPage?: (pageId: string) => void;
  embedded?: boolean; // When true, renders without the slide-in panel wrapper
}

export function VaultChat({ isOpen, onClose, onNavigateToPage, embedded = false }: VaultChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Add user message and loading indicator
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepend vault context to help the agent understand
      const contextMessage = `[Context: User is in the Vault app asking about their knowledge base. Use vault_search and vault_get tools to find relevant information before answering.]\n\n${userMessage.content}`;

      const response = await api.chat(contextMessage);

      // Update the loading message with actual response
      setMessages((prev) => {
        const updated = [...prev];
        const loadingIndex = updated.findIndex((m) => m.isLoading);
        if (loadingIndex !== -1) {
          updated[loadingIndex] = {
            id: updated[loadingIndex].id,
            role: 'assistant',
            content: response.message,
            timestamp: new Date(),
            toolsUsed: response.toolsUsed,
          };
        }
        return updated;
      });
    } catch (error) {
      console.error('Chat error:', error);
      // Update loading message with error
      setMessages((prev) => {
        const updated = [...prev];
        const loadingIndex = updated.findIndex((m) => m.isLoading);
        if (loadingIndex !== -1) {
          updated[loadingIndex] = {
            id: updated[loadingIndex].id,
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request. Please try again.',
            timestamp: new Date(),
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClearHistory = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      await fetch(`${baseUrl}/api/chat/clear`, { method: 'POST' });
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  if (!isOpen) return null;

  // Embedded mode: just render the chat content without wrapper
  const chatContent = (
    <>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <SparklesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Ask me anything about your vault
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              I can search your notes, find information, and help you understand your knowledge base.
            </p>
            <div className="space-y-2">
              {[
                'What notes do I have about productivity?',
                'Summarize my recent meeting notes',
                'Find everything related to project planning',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-500">Searching vault...</span>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {/* Tools used indicator */}
                  {message.toolsUsed && message.toolsUsed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Used: {message.toolsUsed.join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Source citations */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                      <p className="text-xs text-gray-500 font-medium">Sources:</p>
                      {message.sources.map((source) => (
                        <button
                          key={source.id}
                          onClick={() => onNavigateToPage?.(source.id)}
                          className="flex items-center gap-1.5 text-xs text-purple-600 hover:underline"
                        >
                          <DocumentTextIcon className="w-3 h-3" />
                          {source.title}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your vault..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </>
  );

  // Embedded mode: return just the content for use in bottom sheet
  if (embedded) {
    return <div className="flex flex-col h-full">{chatContent}</div>;
  }

  // Desktop mode: return the slide-in panel
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-gray-900">Ask about your vault</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
            title="Clear chat history"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {chatContent}
    </div>
  );
}
