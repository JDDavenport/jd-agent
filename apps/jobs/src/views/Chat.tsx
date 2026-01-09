import { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, TrashIcon, SparklesIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { useChat, useChatStatus } from '@/hooks/useChat';
import clsx from 'clsx';

export function Chat() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const { data: status } = useChatStatus();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const suggestedPrompts = [
    "What's my current job search status?",
    "Show me jobs I need to follow up on",
    "Find software engineer jobs at top tech companies",
    "Generate a cover letter for my top match",
    "Update my profile to target Senior roles",
  ];

  const isConfigured = status?.data?.configured ?? false;

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Job Agent</h1>
            <p className="text-sm text-gray-500">
              {isConfigured ? 'Ready to help with your job search' : 'Not configured - check API key'}
            </p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
          Clear Chat
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <SparklesIcon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Job Hunting Agent</h2>
            <p className="text-gray-500 max-w-md mb-6">
              I can help you search for jobs, track applications, generate cover letters, and more.
              Try one of the suggestions below or ask me anything!
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => setInput(prompt)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={clsx(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none">
                        <MarkdownContent content={message.content} />
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.toolsUsed && message.toolsUsed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 text-xs text-gray-400">
                      <WrenchScrewdriverIcon className="w-3 h-3" />
                      <span>{message.toolsUsed.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your job search..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '200px' }}
              disabled={!isConfigured || isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isConfigured}
            className={clsx(
              'px-4 py-3 rounded-xl flex items-center justify-center transition-colors',
              input.trim() && !isLoading && isConfigured
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </main>
  );
}

// Simple markdown renderer for chat messages
function MarkdownContent({ content }: { content: string }) {
  // Convert markdown to basic HTML
  const html = content
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br />');

  return (
    <div
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
      className="text-sm"
    />
  );
}
