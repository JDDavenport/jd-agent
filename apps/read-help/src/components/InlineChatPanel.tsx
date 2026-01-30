import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  XMarkIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { chat } from '../api';
import clsx from 'clsx';

interface InlineChatPanelProps {
  bookId: string;
  chapterId: string;
  chapterTitle: string;
}

export function InlineChatPanel({ bookId, chapterId, chapterTitle }: InlineChatPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      setChatHistory((prev) => [...prev, { role: 'user', content: message }]);
      const result = await chat(bookId, message, {
        chapterId,
        conversationId: conversationId || undefined,
      });
      setConversationId(result.conversationId);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: result.response }]);
      return result;
    },
  });

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && !chatMutation.isPending) {
      chatMutation.mutate(chatInput.trim());
      setChatInput('');
    }
  };

  const suggestedQuestions = [
    'What is the main problem in this case?',
    'What are the key strategic options?',
    'Summarize the key facts and data',
    'What frameworks apply here?',
    'What should the company do?',
  ];

  return (
    <div
      className={clsx(
        'fixed right-0 top-0 h-full bg-gray-800 border-l border-gray-700 transition-all duration-300 shadow-2xl z-50',
        isExpanded ? 'w-96' : 'w-14'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 bg-gray-800 border border-gray-700 border-r-0 rounded-l-lg p-2 hover:bg-gray-700 transition-colors"
        title={isExpanded ? 'Collapse chat' : 'Expand chat'}
      >
        {isExpanded ? (
          <ChevronDownIcon className="h-5 w-5 text-gray-400 rotate-90" />
        ) : (
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Chat panel content */}
      {isExpanded && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-white">Ask AI</h3>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Ask questions about this case
            </p>
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 && (
              <div className="text-center py-8">
                <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                <p className="text-sm text-gray-400 mb-4">
                  Ask me anything about:<br />
                  <span className="text-gray-300 font-medium">{chapterTitle}</span>
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Suggested questions:</p>
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setChatInput(q);
                        chatMutation.mutate(q);
                      }}
                      className="block w-full text-left rounded-lg bg-gray-700/50 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={clsx(
                  'rounded-lg p-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white ml-4'
                    : 'bg-gray-700 text-gray-200 mr-4'
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="rounded-lg bg-gray-700 p-3 mr-4">
                <ArrowPathIcon className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSendChat} className="border-t border-gray-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatMutation.isPending}
                className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
