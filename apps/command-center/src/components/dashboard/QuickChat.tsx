import { useState } from 'react';
import { useSendMessage } from '../../hooks/useChat';
import { useNavigate } from 'react-router-dom';
import Button from '../common/Button';

function QuickChat() {
  const [message, setMessage] = useState('');
  const sendMessage = useSendMessage();
  const navigate = useNavigate();

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      await sendMessage.mutateAsync({ message });
      setMessage('');
      // Navigate to full chat page to see response
      navigate('/chat');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Quick Chat</h2>

      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the agent anything... (Enter to send)"
          className="input w-full resize-none h-24"
          disabled={sendMessage.isPending}
        />

        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/chat')}
            className="text-sm text-accent hover:text-accent-light transition-colors"
          >
            View full chat →
          </button>

          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default QuickChat;
