import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSendMessage } from '../hooks/useChat';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import QuickActions from '../components/chat/QuickActions';
import type { ChatMessage } from '../types/chat';

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sendMessage = useSendMessage();

  const handleSendMessage = async (content: string) => {
    // Add user message to history
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Send to API and get response
      const response = await sendMessage.mutateAsync({ message: content });

      // Add agent response to history
      const agentMessage: ChatMessage = {
        role: 'agent',
        content: response.message,
        timestamp: new Date().toISOString(),
        toolsUsed: response.toolsUsed,
      };
      setMessages((prev) => [...prev, agentMessage]);
    } catch (error) {
      // Add error message
      const errorMessage: ChatMessage = {
        role: 'agent',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleQuickAction = (message: string) => {
    handleSendMessage(message);
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([]);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      {/* Header */}
      <header className="bg-dark-card border-b border-dark-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="text-text-muted hover:text-text transition-colors"
              title="Back to Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
                Chat with Agent
              </h1>
              <p className="text-sm text-text-muted">
                {messages.length > 0 ? `${messages.length} messages` : 'Start a conversation'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleClearHistory}
              disabled={messages.length === 0}
              className="px-3 py-1.5 text-sm text-text-muted hover:text-text border border-dark-border rounded-lg hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear History
            </button>
            <Link
              to="/settings"
              className="p-2 hover:bg-dark-card-hover rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5 text-text-muted hover:text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full">
        <MessageList messages={messages} isLoading={sendMessage.isPending} />
        <QuickActions
          onActionClick={handleQuickAction}
          disabled={sendMessage.isPending}
        />
        <ChatInput
          onSend={handleSendMessage}
          disabled={sendMessage.isPending}
        />
      </div>
    </div>
  );
}

export default Chat;
