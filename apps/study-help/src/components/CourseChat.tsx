import { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { sendCourseChat, type ChatMessage } from '../api';
import type { Course } from '../types/courses';
import ReactMarkdown from 'react-markdown';

interface CourseChatProps {
  course: Course;
}

const SUGGESTED_QUESTIONS = [
  "What will be on the exam?",
  "Summarize last week's lectures",
  "Explain the key concepts in simple terms",
  "Quiz me on recent material",
  "What should I focus on for this class?",
];

export function CourseChat({ course }: CourseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendCourseChat(course.id, text, messages);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className={clsx('p-4 border-b', course.bgColor)}>
        <div className="flex items-center gap-2">
          <SparklesIcon className={clsx('w-5 h-5', course.color)} />
          <h3 className="font-semibold text-gray-900">Ask AI about {course.shortName}</h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          I know your lectures, notes, and readings. Ask me anything!
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <SparklesIcon className={clsx('w-12 h-12 mx-auto mb-4', course.color, 'opacity-50')} />
            <p className="text-gray-600 mb-6">Start a conversation about {course.name}</p>
            
            {/* Suggested Questions */}
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-3">Try asking:</p>
              {SUGGESTED_QUESTIONS.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(question)}
                  className={clsx(
                    'block w-full text-left px-4 py-2 rounded-lg text-sm',
                    'bg-gray-50 hover:bg-gray-100 text-gray-700',
                    'transition-colors border border-gray-200'
                  )}
                >
                  "{question}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={clsx(
                'max-w-[85%] rounded-xl px-4 py-3',
                msg.role === 'user'
                  ? clsx('ml-auto', course.bgColor, course.color)
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this course..."
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-blue-600 text-white hover:bg-blue-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
