import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  TrashIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  BookOpenIcon,
  MicrophoneIcon,
  LinkIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { SparklesIcon as SparklesSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { Course } from '../types/courses';
import type { ClassGPTCitation, ClassGPTMessage, ClassGPTSource } from '../api';
import {
  streamClassGPTMessage,
  getClassGPTHistory,
  clearClassGPTHistory,
  getClassGPTSources,
} from '../api';

interface ClassGPTViewProps {
  course: Course;
  canvasCourseId: string;
}

const SUGGESTED_QUESTIONS = [
  "Summarize the key concepts from the most recent lecture",
  "What are the main frameworks we've covered?",
  "Create a study guide for the upcoming exam",
  "Quiz me on the material",
  "Explain the most important takeaways from the readings",
  "What connections exist between different topics?",
];

export function ClassGPTView({ course, canvasCourseId }: ClassGPTViewProps) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Load chat history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['classGPT', 'history', canvasCourseId],
    queryFn: () => getClassGPTHistory(canvasCourseId),
    retry: false,
  });

  // Load available sources
  const { data: sourcesData } = useQuery({
    queryKey: ['classGPT', 'sources', canvasCourseId],
    queryFn: () => getClassGPTSources(canvasCourseId),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const messages = historyData?.messages || [];
  const sources = sourcesData?.sources || [];

  // Clear history mutation
  const clearMutation = useMutation({
    mutationFn: () => clearClassGPTHistory(canvasCourseId),
    onSuccess: () => {
      queryClient.setQueryData(['classGPT', 'history', canvasCourseId], { messages: [] });
    },
  });

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: ClassGPTMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };

    // Optimistically add user message to cache
    queryClient.setQueryData(
      ['classGPT', 'history', canvasCourseId],
      (old: { messages: ClassGPTMessage[] } | undefined) => ({
        messages: [...(old?.messages || []), userMessage],
      })
    );

    setInput('');
    setError(null);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      let fullContent = '';

      await streamClassGPTMessage(
        canvasCourseId,
        text.trim(),
        course.name,
        // onDelta
        (delta) => {
          fullContent += delta;
          setStreamingContent(fullContent);
        },
        // onDone
        (citations, _sources) => {
          // Add assistant message to cache
          const assistantMessage: ClassGPTMessage = {
            id: `temp-assistant-${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            citations,
            createdAt: new Date().toISOString(),
          };
          queryClient.setQueryData(
            ['classGPT', 'history', canvasCourseId],
            (old: { messages: ClassGPTMessage[] } | undefined) => ({
              messages: [...(old?.messages || []), assistantMessage],
            })
          );
          setStreamingContent('');
          setIsStreaming(false);
        },
        // onError
        (errorMsg) => {
          setError(errorMsg);
          setIsStreaming(false);
          setStreamingContent('');
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsStreaming(false);
      setStreamingContent('');
      // Refetch to get actual state
      queryClient.invalidateQueries({ queryKey: ['classGPT', 'history', canvasCourseId] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear all chat history for this course? This cannot be undone.')) {
      clearMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <SparklesSolid className={clsx('w-5 h-5', course.color)} />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Class GPT</h3>
            <p className="text-xs text-gray-500">
              {sources.length > 0
                ? `${sources.length} source${sources.length !== 1 ? 's' : ''} loaded`
                : 'Loading sources...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Sources toggle */}
          <button
            onClick={() => setShowSources(!showSources)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              showSources
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            <DocumentTextIcon className="w-3.5 h-3.5" />
            Sources
            <ChevronDownIcon className={clsx('w-3 h-3 transition-transform', showSources && 'rotate-180')} />
          </button>
          {/* New conversation */}
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={clearMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="New conversation"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Sources panel */}
      {showSources && sources.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 p-3 max-h-40 overflow-y-auto">
          <p className="text-xs font-medium text-gray-500 mb-2">Available Context Sources</p>
          <div className="space-y-1">
            {sources.map((source, i) => (
              <SourceBadge key={i} source={source} />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {historyLoading ? (
          <div className="flex items-center justify-center h-full">
            <ArrowPathIcon className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : messages.length === 0 && !streamingContent ? (
          <EmptyState
            course={course}
            onSuggestion={sendMessage}
            sourcesCount={sources.length}
          />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} course={course} />
            ))}
            {streamingContent && (
              <MessageBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  createdAt: new Date().toISOString(),
                }}
                course={course}
                isStreaming
              />
            )}
            {isStreaming && !streamingContent && (
              <div className="flex items-center gap-2 text-gray-500 px-4">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${course.shortName}...`}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className={clsx(
              'p-2.5 rounded-lg font-medium transition-all flex-shrink-0',
              input.trim() && !isStreaming
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          AI responses based on your course materials. Always verify important information.
        </p>
      </form>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function EmptyState({
  course,
  onSuggestion,
  sourcesCount,
}: {
  course: Course;
  onSuggestion: (text: string) => void;
  sourcesCount: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8">
      <div className={clsx('w-16 h-16 rounded-2xl flex items-center justify-center mb-4', course.bgColor)}>
        <SparklesIcon className={clsx('w-8 h-8', course.color)} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Class GPT</h3>
      <p className="text-sm text-gray-500 mb-2 text-center max-w-sm">
        Ask anything about {course.name}. I'll answer using your course materials and lecture recordings.
      </p>
      {sourcesCount > 0 ? (
        <p className="text-xs text-green-600 mb-6 flex items-center gap-1">
          <DocumentTextIcon className="w-3.5 h-3.5" />
          {sourcesCount} source{sourcesCount !== 1 ? 's' : ''} available
        </p>
      ) : (
        <p className="text-xs text-amber-600 mb-6 flex items-center gap-1">
          No materials loaded yet — answers will be general knowledge
        </p>
      )}

      <div className="w-full max-w-md space-y-2">
        <p className="text-xs text-gray-400 text-center mb-2">Try asking:</p>
        {SUGGESTED_QUESTIONS.slice(0, 4).map((question, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(question)}
            className={clsx(
              'block w-full text-left px-4 py-2.5 rounded-lg text-sm',
              'bg-white hover:bg-gray-100 text-gray-700',
              'transition-colors border border-gray-200 hover:border-gray-300'
            )}
          >
            <span className="text-gray-400 mr-2">→</span>
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  course,
  isStreaming = false,
}: {
  message: ClassGPTMessage;
  course: Course;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
          isUser
            ? 'bg-gray-700 text-white'
            : clsx(course.bgColor, course.color)
        )}
      >
        {isUser ? 'You' : '✨'}
      </div>

      {/* Content */}
      <div className={clsx('max-w-[80%] min-w-0')}>
        <div
          className={clsx(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-gray-800 text-white rounded-tr-sm'
              : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm shadow-sm'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:mt-3 prose-headings:mb-1">
              <MarkdownContent content={message.content} />
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.citations.map((citation, i) => (
              <CitationBadge key={i} citation={citation} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={clsx('text-xs text-gray-400 mt-1', isUser && 'text-right')}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

function CitationBadge({ citation }: { citation: ClassGPTCitation }) {
  const icon = citation.type === 'recording' ? (
    <MicrophoneIcon className="w-3 h-3" />
  ) : (
    <BookOpenIcon className="w-3 h-3" />
  );

  if (citation.url) {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
      >
        {icon}
        <span className="truncate max-w-[200px]">{citation.name}</span>
        <LinkIcon className="w-2.5 h-2.5 flex-shrink-0" />
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-600 border border-gray-200">
      {icon}
      <span className="truncate max-w-[200px]">{citation.name}</span>
    </span>
  );
}

function SourceBadge({ source }: { source: ClassGPTSource }) {
  const icon = source.type === 'recording' ? '🎙️' : source.type === 'transcript' ? '📝' : '📄';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span>{icon}</span>
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate"
        >
          {source.name}
        </a>
      ) : (
        <span className="text-gray-600 truncate">{source.name}</span>
      )}
      <span className="text-gray-400">({source.type})</span>
    </div>
  );
}

/**
 * Simple markdown renderer without external dependency.
 * Handles: bold, italic, code, headers, lists, links, line breaks.
 */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={`list-${elements.length}`} className={listType === 'ul' ? 'list-disc pl-4' : 'list-decimal pl-4'}>
          {listItems.map((item, i) => (
            <li key={i}><InlineMarkdown text={item} /></li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={i} className="font-semibold text-gray-900 text-sm mt-3 mb-1"><InlineMarkdown text={line.slice(4)} /></h4>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={i} className="font-semibold text-gray-900 mt-3 mb-1"><InlineMarkdown text={line.slice(3)} /></h3>);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={i} className="font-bold text-gray-900 text-lg mt-3 mb-1"><InlineMarkdown text={line.slice(2)} /></h2>);
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(line.replace(/^[-*]\s/, ''));
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(line.replace(/^\d+\.\s/, ''));
      continue;
    }

    flushList();

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`code-${i}`} className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs overflow-x-auto my-2">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i} className="my-1"><InlineMarkdown text={line} /></p>);
  }

  flushList();

  return <>{elements}</>;
}

function InlineMarkdown({ text }: { text: string }) {
  // Process inline markdown: **bold**, *italic*, `code`, [links](url), [Source: "name"]
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Source citation
    const sourceMatch = remaining.match(/^\[Source:\s*"?([^"\]]+)"?\]/);
    if (sourceMatch) {
      parts.push(
        <span key={key++} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-50 text-blue-700 text-xs mx-0.5">
          📄 {sourceMatch[1]}
        </span>
      );
      remaining = remaining.slice(sourceMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Regular character
    const nextSpecial = remaining.search(/[\*`\[\[]/);
    if (nextSpecial <= 0) {
      parts.push(remaining);
      break;
    }
    parts.push(remaining.slice(0, nextSpecial));
    remaining = remaining.slice(nextSpecial);
  }

  return <>{parts}</>;
}
