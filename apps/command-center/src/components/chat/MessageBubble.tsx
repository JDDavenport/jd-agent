import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../types/chat';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-slide-up`}>
      <div
        className={`max-w-[80%] rounded-xl p-4 ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-dark-card border border-dark-border text-text'
        }`}
      >
        {/* Message Header */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-semibold ${isUser ? 'text-white' : 'text-accent'}`}>
            {isUser ? 'You' : 'Agent'}
          </span>
          <span className={`text-xs ${isUser ? 'text-white/70' : 'text-text-muted'}`}>
            {format(new Date(message.timestamp), 'h:mm a')}
          </span>
        </div>

        {/* Message Content */}
        <div
          className={`prose prose-sm max-w-none ${
            isUser ? 'prose-invert' : 'prose-dark'
          }`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Tools Used (for agent messages) */}
        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="mt-3 pt-3 border-t border-dark-border/50">
            <p className="text-xs text-text-muted mb-1">Tools used:</p>
            <div className="flex flex-wrap gap-1">
              {message.toolsUsed.map((tool, index) => (
                <span
                  key={index}
                  className="badge badge-neutral text-xs"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
