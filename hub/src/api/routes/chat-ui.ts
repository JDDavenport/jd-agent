/**
 * JD Agent - Chat Web UI
 * 
 * A beautiful chat interface at /chat for interacting with your AI agent
 */

import { Hono } from 'hono';

const chatUI = new Hono();

const chatPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JD Agent - Chat</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    
    :root {
      --bg-dark: #0c0c12;
      --bg-chat: #111118;
      --bg-message-user: #2d2d44;
      --bg-message-agent: #1a1a24;
      --accent: #7c3aed;
      --accent-glow: rgba(124, 58, 237, 0.4);
      --success: #10b981;
      --text: #f0f0f5;
      --text-muted: #8888aa;
      --border: #2a2a3a;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-dark);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    header {
      background: linear-gradient(180deg, rgba(124, 58, 237, 0.1) 0%, transparent 100%);
      border-bottom: 1px solid var(--border);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--accent), #a855f7);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }

    .logo-text {
      font-size: 1.25rem;
      font-weight: 600;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--success);
      font-size: 0.875rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Chat Container */
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Messages */
    .message {
      max-width: 80%;
      padding: 1rem 1.25rem;
      border-radius: 16px;
      line-height: 1.6;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message.user {
      background: var(--bg-message-user);
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .message.agent {
      background: var(--bg-message-agent);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      border: 1px solid var(--border);
    }

    .message.agent .sender {
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .message-content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message-content code {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(255,255,255,0.1);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.875em;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 1rem 1.25rem;
      background: var(--bg-message-agent);
      border: 1px solid var(--border);
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      align-self: flex-start;
      max-width: 80px;
    }

    .typing-dot {
      width: 8px;
      height: 8px;
      background: var(--text-muted);
      border-radius: 50%;
      animation: typingBounce 1.4s infinite;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    /* Input Area */
    .input-area {
      background: var(--bg-chat);
      border-top: 1px solid var(--border);
      padding: 1rem 1.5rem;
    }

    .input-container {
      display: flex;
      gap: 0.75rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    #message-input {
      flex: 1;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      color: var(--text);
      font-family: inherit;
      font-size: 1rem;
      resize: none;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    #message-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }

    #message-input::placeholder {
      color: var(--text-muted);
    }

    #send-button {
      background: linear-gradient(135deg, var(--accent), #a855f7);
      border: none;
      border-radius: 12px;
      padding: 1rem 1.5rem;
      color: white;
      font-family: inherit;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    #send-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 20px var(--accent-glow);
    }

    #send-button:active {
      transform: translateY(0);
    }

    #send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    /* Quick Actions */
    .quick-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      flex-wrap: wrap;
    }

    .quick-action {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 0.5rem 1rem;
      color: var(--text-muted);
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .quick-action:hover {
      border-color: var(--accent);
      color: var(--text);
    }

    /* Welcome Message */
    .welcome {
      text-align: center;
      padding: 3rem 2rem;
      color: var(--text-muted);
    }

    .welcome h2 {
      color: var(--text);
      margin-bottom: 1rem;
      font-size: 1.5rem;
    }

    .welcome p {
      max-width: 500px;
      margin: 0 auto;
      line-height: 1.8;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .message {
        max-width: 90%;
      }

      header {
        padding: 0.75rem 1rem;
      }

      .chat-container {
        padding: 1rem;
      }

      .input-area {
        padding: 0.75rem 1rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <div class="logo-icon">🤖</div>
      <span class="logo-text">JD Agent</span>
    </div>
    <div class="status">
      <span class="status-dot"></span>
      Online
    </div>
  </header>

  <div class="chat-container" id="chat-container">
    <div class="welcome">
      <h2>👋 Hey! I'm your personal AI agent.</h2>
      <p>
        I can help you manage tasks, check your Canvas assignments, 
        look at your calendar, and stay organized. Just ask me anything!
      </p>
    </div>
  </div>

  <div class="input-area">
    <div class="input-container">
      <textarea 
        id="message-input" 
        placeholder="Message your agent..." 
        rows="1"
      ></textarea>
      <button id="send-button">
        Send
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
    <div class="quick-actions">
      <button class="quick-action" data-message="What's on my schedule today?">📅 Today</button>
      <button class="quick-action" data-message="What Canvas assignments are due this week?">📚 Due Soon</button>
      <button class="quick-action" data-message="Show me my inbox">📥 Inbox</button>
      <button class="quick-action" data-message="Give me my morning briefing">🌅 Briefing</button>
      <button class="quick-action" data-message="How is the system doing?">🔧 System</button>
    </div>
  </div>

  <script>
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const quickActions = document.querySelectorAll('.quick-action');

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });

    // Send on Enter (but Shift+Enter for new line)
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendButton.addEventListener('click', sendMessage);

    // Quick actions
    quickActions.forEach(btn => {
      btn.addEventListener('click', function() {
        const message = this.dataset.message;
        messageInput.value = message;
        sendMessage();
      });
    });

    function addMessage(content, sender) {
      // Remove welcome message if present
      const welcome = document.querySelector('.welcome');
      if (welcome) welcome.remove();

      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ' + sender;
      
      if (sender === 'agent') {
        messageDiv.innerHTML = '<div class="sender">JD Agent</div>';
      }
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = content;
      messageDiv.appendChild(contentDiv);
      
      chatContainer.appendChild(messageDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      
      return messageDiv;
    }

    function showTyping() {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'typing-indicator';
      typingDiv.id = 'typing';
      typingDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
      chatContainer.appendChild(typingDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function hideTyping() {
      const typing = document.getElementById('typing');
      if (typing) typing.remove();
    }

    async function sendMessage() {
      const message = messageInput.value.trim();
      if (!message) return;

      // Clear input
      messageInput.value = '';
      messageInput.style.height = 'auto';

      // Show user message
      addMessage(message, 'user');

      // Disable input while processing
      messageInput.disabled = true;
      sendButton.disabled = true;
      showTyping();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });

        const data = await response.json();
        hideTyping();

        if (data.success) {
          addMessage(data.data.response, 'agent');
        } else {
          addMessage('Sorry, something went wrong: ' + (data.error?.message || 'Unknown error'), 'agent');
        }
      } catch (error) {
        hideTyping();
        addMessage('Sorry, I couldn\\'t connect to the server. Is it running?', 'agent');
      }

      // Re-enable input
      messageInput.disabled = false;
      sendButton.disabled = false;
      messageInput.focus();
    }

    // Focus input on load
    messageInput.focus();
  </script>
</body>
</html>`;

chatUI.get('/', (c) => {
  return c.html(chatPageHTML);
});

export { chatUI };
