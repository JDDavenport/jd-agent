/**
 * JD Agent - Brain Dump UI
 * 
 * A dedicated page for quick task capture at /brain-dump
 */

import { Hono } from 'hono';

const brainDumpUI = new Hono();

const brainDumpHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JD Agent - Brain Dump</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
    
    :root {
      --bg-dark: #0c0c12;
      --bg-card: #12121a;
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
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 2rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 600;
      background: linear-gradient(135deg, var(--accent), #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 1rem;
    }

    .input-section {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    #task-input {
      flex: 1;
      background: var(--bg-card);
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      color: var(--text);
      font-family: inherit;
      font-size: 1.1rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    #task-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }

    #task-input::placeholder {
      color: var(--text-muted);
    }

    .add-btn {
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
      white-space: nowrap;
    }

    .add-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px var(--accent-glow);
    }

    .add-btn:active {
      transform: translateY(0);
    }

    .counter {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .counter span {
      color: var(--accent);
      font-weight: 600;
    }

    .task-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .task-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.875rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .task-check {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--success);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      flex-shrink: 0;
    }

    .task-title {
      flex: 1;
    }

    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 3rem;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .nav-links {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      padding: 1.5rem;
      border-top: 1px solid var(--border);
    }

    .nav-links a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.2s;
    }

    .nav-links a:hover {
      color: var(--accent);
    }

  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">🧠 Brain Dump</div>
      <div class="subtitle">Get everything out of your head. Just type and hit Enter.</div>
    </header>

    <div class="input-section">
      <input type="text" id="task-input" placeholder="What's on your mind?" autocomplete="off">
      <button class="add-btn" onclick="addTask()">Add</button>
    </div>

    <div class="counter">
      <span id="count">0</span> tasks added this session
    </div>

    <div class="task-list" id="task-list">
      <div class="empty-state">
        <div class="empty-icon">💭</div>
        <div>Start typing to capture your thoughts</div>
      </div>
    </div>
  </div>

  <nav class="nav-links">
    <a href="/chat">💬 Chat</a>
    <a href="/setup">⚙️ Setup</a>
    <a href="/">🏠 Home</a>
  </nav>

  <script>
    const tasks = [];
    const input = document.getElementById('task-input');
    const list = document.getElementById('task-list');
    const countEl = document.getElementById('count');

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTask();
    });

    input.focus();

    async function addTask() {
      const title = input.value.trim();
      if (!title) return;

      try {
        const res = await fetch('/api/setup/brain-dump', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });

        const data = await res.json();

        if (data.success) {
          tasks.unshift({ id: data.data.id, title });
          renderTasks();
          input.value = '';
          input.focus();
        }
      } catch (error) {
        console.error('Failed to add task:', error);
      }
    }

    function renderTasks() {
      countEl.textContent = tasks.length;

      if (tasks.length === 0) {
        list.innerHTML = \`
          <div class="empty-state">
            <div class="empty-icon">💭</div>
            <div>Start typing to capture your thoughts</div>
          </div>
        \`;
        return;
      }

      list.innerHTML = tasks.map(task => \`
        <div class="task-item">
          <div class="task-check">✓</div>
          <div class="task-title">\${task.title}</div>
        </div>
      \`).join('');
    }
  </script>
</body>
</html>`;

brainDumpUI.get('/', (c) => {
  return c.html(brainDumpHTML);
});

export { brainDumpUI };
