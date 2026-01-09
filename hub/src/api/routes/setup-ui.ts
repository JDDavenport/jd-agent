/**
 * JD Agent - Setup Wizard UI
 * 
 * Serves the setup wizard web interface at /setup
 */

import { Hono } from 'hono';
import { html } from 'hono/html';

const setupUI = new Hono();

const setupPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JD Agent - Setup Wizard</title>
  <style>
    :root {
      --bg-dark: #0a0a0f;
      --bg-card: #12121a;
      --bg-card-hover: #1a1a25;
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.3);
      --success: #10b981;
      --warning: #f59e0b;
      --error: #ef4444;
      --text: #e5e5e5;
      --text-muted: #9ca3af;
      --border: #2a2a3a;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-dark);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .logo {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 1.1rem;
    }

    .progress-bar {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 3rem;
    }

    .progress-step {
      width: 40px;
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      transition: all 0.3s ease;
    }

    .progress-step.active {
      background: var(--accent);
      box-shadow: 0 0 10px var(--accent-glow);
    }

    .progress-step.complete {
      background: var(--success);
    }

    .step-container {
      display: none;
    }

    .step-container.active {
      display: block;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 1.5rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .card-icon {
      font-size: 2rem;
    }

    .card-title {
      font-size: 1.5rem;
      font-weight: 600;
    }

    .card-description {
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .service-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .service-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      background: var(--bg-dark);
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    .service-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .service-status {
      font-size: 1.5rem;
    }

    .service-name {
      font-weight: 500;
    }

    .service-details {
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      border: none;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: var(--accent);
      color: white;
    }

    .btn-primary:hover {
      background: #5558e3;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg-card);
      color: var(--text);
    }

    .btn-test {
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text);
    }

    .btn-test:hover {
      border-color: var(--accent);
    }

    .btn-group {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
    }

    /* Brain Dump Styles */
    .brain-dump-input {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .brain-dump-input input {
      flex: 1;
      padding: 1rem 1.25rem;
      background: var(--bg-dark);
      border: 2px solid var(--border);
      border-radius: 12px;
      color: var(--text);
      font-size: 1rem;
      transition: border-color 0.2s ease;
    }

    .brain-dump-input input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .task-list {
      max-height: 300px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .task-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--bg-dark);
      border-radius: 8px;
      animation: slideIn 0.2s ease;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-10px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .task-item .check {
      color: var(--success);
    }

    /* Inbox Processing Styles */
    .inbox-card {
      background: linear-gradient(135deg, var(--bg-card), #1a1a28);
      border: 1px solid var(--accent);
      padding: 2rem;
      border-radius: 16px;
      text-align: center;
    }

    .inbox-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .inbox-meta {
      color: var(--text-muted);
      margin-bottom: 2rem;
    }

    .inbox-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
    }

    .inbox-actions .btn {
      min-width: 120px;
    }

    .btn-today {
      background: var(--success);
      color: white;
    }

    .btn-upcoming {
      background: var(--warning);
      color: black;
    }

    .btn-someday {
      background: var(--bg-card);
      border: 1px solid var(--border);
    }

    .btn-delete {
      background: var(--error);
      color: white;
    }

    /* Class Form Styles */
    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .form-input {
      width: 100%;
      padding: 0.875rem 1rem;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      font-size: 1rem;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    /* Complete Screen */
    .complete-screen {
      text-align: center;
      padding: 3rem 2rem;
    }

    .complete-icon {
      font-size: 5rem;
      margin-bottom: 1.5rem;
    }

    .complete-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, var(--success), #34d399);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 2rem 0;
    }

    .stat-card {
      background: var(--bg-dark);
      padding: 1.5rem;
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
    }

    .stat-label {
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--text-muted);
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
    }

    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">JD Agent</div>
      <div class="subtitle">Let's get you set up</div>
    </header>

    <div class="progress-bar" id="progress-bar">
      <div class="progress-step" data-step="1"></div>
      <div class="progress-step" data-step="2"></div>
      <div class="progress-step" data-step="3"></div>
      <div class="progress-step" data-step="4"></div>
      <div class="progress-step" data-step="5"></div>
      <div class="progress-step" data-step="6"></div>
    </div>

    <!-- Step 1: Connect Services -->
    <div class="step-container" id="step-1">
      <div class="card">
        <div class="card-header">
          <span class="card-icon">🔌</span>
          <div>
            <div class="card-title">Connect Services</div>
            <div class="card-description">Let's see what's connected</div>
          </div>
        </div>
        <div class="service-list" id="service-list">
          <div class="loading">
            <div class="spinner"></div>
            <span>Checking services...</span>
          </div>
        </div>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="nextStep()">Continue →</button>
      </div>
    </div>

    <!-- Step 2: Brain Dump -->
    <div class="step-container" id="step-2">
      <div class="card">
        <div class="card-header">
          <span class="card-icon">🧠</span>
          <div>
            <div class="card-title">Brain Dump</div>
            <div class="card-description">Get everything out of your head. Just type and hit Enter.</div>
          </div>
        </div>
        <div class="brain-dump-input">
          <input type="text" id="brain-dump-input" placeholder="What's on your mind?" autocomplete="off">
          <button class="btn btn-primary" onclick="addBrainDumpTask()">Add</button>
        </div>
        <div class="task-list" id="brain-dump-list"></div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="prevStep()">← Back</button>
        <button class="btn btn-primary" onclick="nextStep()">Continue →</button>
      </div>
    </div>

    <!-- Step 3: Process Inbox -->
    <div class="step-container" id="step-3">
      <div class="card">
        <div class="card-header">
          <span class="card-icon">📥</span>
          <div>
            <div class="card-title">Process Inbox</div>
            <div class="card-description">Decide what to do with each item</div>
          </div>
        </div>
        <div id="inbox-processor">
          <div class="loading">
            <div class="spinner"></div>
            <span>Loading inbox...</span>
          </div>
        </div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="prevStep()">← Back</button>
        <button class="btn btn-primary" onclick="nextStep()">Continue →</button>
      </div>
    </div>

    <!-- Step 4: Ceremonies -->
    <div class="step-container" id="step-4">
      <div class="card">
        <div class="card-header">
          <span class="card-icon">🌅</span>
          <div>
            <div class="card-title">Set Up Ceremonies</div>
            <div class="card-description">Configure your daily briefings</div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Morning Ceremony</label>
            <input type="time" class="form-input" id="morning-time" value="06:00">
          </div>
          <div class="form-group">
            <label class="form-label">Evening Ceremony</label>
            <input type="time" class="form-input" id="evening-time" value="21:00">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notification Channel</label>
          <div id="ceremony-channels"></div>
        </div>
        <button class="btn btn-secondary" onclick="testCeremony()" style="margin-top: 1rem;">
          🧪 Send Test Notification
        </button>
        <div id="ceremony-test-result" style="margin-top: 1rem;"></div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="prevStep()">← Back</button>
        <button class="btn btn-primary" onclick="nextStep()">Continue →</button>
      </div>
    </div>

    <!-- Step 5: Add Classes -->
    <div class="step-container" id="step-5">
      <div class="card">
        <div class="card-header">
          <span class="card-icon">📚</span>
          <div>
            <div class="card-title">Add Classes</div>
            <div class="card-description">Set up your class schedule (optional for non-students)</div>
          </div>
        </div>
        <div id="class-list"></div>
        <div class="form-row" style="margin-top: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Class Name</label>
            <input type="text" class="form-input" id="class-name" placeholder="Business Analytics">
          </div>
          <div class="form-group">
            <label class="form-label">Course Code</label>
            <input type="text" class="form-input" id="class-code" placeholder="MBA 560">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Professor (optional)</label>
          <input type="text" class="form-input" id="class-professor" placeholder="Dr. Smith">
        </div>
        <button class="btn btn-secondary" onclick="addClass()">+ Add Class</button>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="prevStep()">← Back</button>
        <button class="btn btn-primary" onclick="nextStep()">Continue →</button>
      </div>
    </div>

    <!-- Step 6: Complete -->
    <div class="step-container" id="step-6">
      <div class="card">
        <div class="complete-screen">
          <div class="complete-icon">🎉</div>
          <div class="complete-title">You're All Set!</div>
          <p style="color: var(--text-muted); margin-bottom: 2rem;">
            Your personal AI agent is ready to help you stay organized and focused.
          </p>
          <div class="stats-grid" id="summary-stats"></div>
          <div id="morning-preview" style="text-align: left; margin-top: 2rem;"></div>
        </div>
      </div>
      <div class="btn-group" style="justify-content: center;">
        <button class="btn btn-primary" onclick="completeSetup()" style="padding: 1rem 3rem; font-size: 1.1rem;">
          🚀 Start Using JD Agent
        </button>
      </div>
    </div>
  </div>

  <script>
    let currentStep = 1;
    let services = [];
    let brainDumpTasks = [];
    let inboxTasks = [];
    let currentInboxIndex = 0;
    let classes = [];

    // Initialize
    document.addEventListener('DOMContentLoaded', async () => {
      await loadStatus();
      updateProgressBar();
      showStep(currentStep);
      
      // Brain dump enter key
      document.getElementById('brain-dump-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addBrainDumpTask();
      });
    });

    async function loadStatus() {
      try {
        const res = await fetch('/api/setup/status');
        const data = await res.json();
        
        if (data.success) {
          services = data.data.services;
          currentStep = data.data.currentStep;
          renderServices();
        }
      } catch (error) {
        console.error('Failed to load status:', error);
      }
    }

    function renderServices() {
      const list = document.getElementById('service-list');
      
      list.innerHTML = services.map(service => {
        const icon = service.connected ? '✅' : (service.configured ? '⚠️' : '❌');
        const statusClass = service.connected ? 'success' : (service.configured ? 'warning' : 'error');
        
        return \`
          <div class="service-item">
            <div class="service-info">
              <span class="service-status">\${icon}</span>
              <div>
                <div class="service-name">\${service.displayName}</div>
                <div class="service-details">
                  \${service.details || service.error || (service.configured ? 'Configured' : 'Not configured')}
                  \${service.required ? ' (Required)' : ''}
                </div>
              </div>
            </div>
            \${['telegram', 'twilio', 'resend', 'canvas'].includes(service.name) && service.configured ? 
              \`<button class="btn btn-test" onclick="testService('\${service.name}')">Test</button>\` : 
              ''}
          </div>
        \`;
      }).join('');
    }

    async function testService(serviceName) {
      try {
        const res = await fetch(\`/api/setup/connect/\${serviceName}/test\`, { method: 'POST' });
        const data = await res.json();
        alert(data.data?.message || data.message || 'Test complete');
      } catch (error) {
        alert('Test failed: ' + error.message);
      }
    }

    function showStep(step) {
      document.querySelectorAll('.step-container').forEach(el => {
        el.classList.remove('active');
      });
      document.getElementById(\`step-\${step}\`).classList.add('active');
      
      // Load step-specific data
      if (step === 3) loadInbox();
      if (step === 4) loadCeremonyConfig();
      if (step === 5) loadClasses();
      if (step === 6) loadSummary();
    }

    function updateProgressBar() {
      document.querySelectorAll('.progress-step').forEach(el => {
        const step = parseInt(el.dataset.step);
        el.classList.remove('active', 'complete');
        if (step < currentStep) el.classList.add('complete');
        if (step === currentStep) el.classList.add('active');
      });
    }

    function nextStep() {
      if (currentStep < 6) {
        currentStep++;
        updateProgressBar();
        showStep(currentStep);
      }
    }

    function prevStep() {
      if (currentStep > 1) {
        currentStep--;
        updateProgressBar();
        showStep(currentStep);
      }
    }

    // Brain Dump
    async function addBrainDumpTask() {
      const input = document.getElementById('brain-dump-input');
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
          brainDumpTasks.unshift(data.data);
          renderBrainDumpList();
          input.value = '';
          input.focus();
        }
      } catch (error) {
        console.error('Failed to add task:', error);
      }
    }

    function renderBrainDumpList() {
      const list = document.getElementById('brain-dump-list');
      list.innerHTML = brainDumpTasks.map(task => \`
        <div class="task-item">
          <span class="check">✓</span>
          <span>\${task.title}</span>
        </div>
      \`).join('');
    }

    // Inbox Processing
    async function loadInbox() {
      try {
        const res = await fetch('/api/setup/inbox');
        const data = await res.json();
        
        if (data.success) {
          inboxTasks = data.data;
          currentInboxIndex = 0;
          renderInboxItem();
        }
      } catch (error) {
        console.error('Failed to load inbox:', error);
      }
    }

    function renderInboxItem() {
      const container = document.getElementById('inbox-processor');
      
      if (inboxTasks.length === 0 || currentInboxIndex >= inboxTasks.length) {
        container.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">🎉</div>
            <div>Inbox is clear!</div>
          </div>
        \`;
        return;
      }
      
      const task = inboxTasks[currentInboxIndex];
      const remaining = inboxTasks.length - currentInboxIndex;
      
      container.innerHTML = \`
        <div class="inbox-card">
          <div class="inbox-title">\${task.title}</div>
          <div class="inbox-meta">
            \${task.context} • \${remaining} remaining
          </div>
          <div class="inbox-actions">
            <button class="btn btn-today" onclick="processInboxItem('today')">📅 Today</button>
            <button class="btn btn-upcoming" onclick="processInboxItem('upcoming')">📆 Upcoming</button>
            <button class="btn btn-someday" onclick="processInboxItem('someday')">💭 Someday</button>
            <button class="btn btn-delete" onclick="processInboxItem('delete')">🗑️ Delete</button>
          </div>
        </div>
      \`;
    }

    async function processInboxItem(action) {
      const task = inboxTasks[currentInboxIndex];
      
      try {
        await fetch(\`/api/setup/inbox/\${task.id}/process\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        
        currentInboxIndex++;
        renderInboxItem();
      } catch (error) {
        console.error('Failed to process:', error);
      }
    }

    // Ceremonies
    async function loadCeremonyConfig() {
      try {
        const res = await fetch('/api/setup/ceremonies');
        const data = await res.json();
        
        if (data.success) {
          const channels = data.data.notificationChannels;
          const container = document.getElementById('ceremony-channels');
          
          container.innerHTML = Object.entries(channels).map(([name, info]) => \`
            <div class="service-item" style="margin-top: 0.5rem;">
              <div class="service-info">
                <span class="service-status">\${info.configured ? '✅' : '❌'}</span>
                <div>
                  <div class="service-name">\${name.charAt(0).toUpperCase() + name.slice(1)}</div>
                  <div class="service-details">\${info.configured ? (info.chatId || info.phoneNumber || info.email || 'Configured') : 'Not configured'}</div>
                </div>
              </div>
            </div>
          \`).join('');
        }
      } catch (error) {
        console.error('Failed to load ceremony config:', error);
      }
    }

    async function testCeremony() {
      const resultEl = document.getElementById('ceremony-test-result');
      resultEl.innerHTML = '<div class="loading"><div class="spinner"></div> Sending...</div>';
      
      try {
        const res = await fetch('/api/setup/ceremonies/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'morning' }),
        });
        
        const data = await res.json();
        resultEl.innerHTML = \`<div style="color: \${data.success ? 'var(--success)' : 'var(--error)'}">\${data.message}</div>\`;
      } catch (error) {
        resultEl.innerHTML = '<div style="color: var(--error)">Failed to send test</div>';
      }
    }

    // Classes
    async function loadClasses() {
      try {
        const res = await fetch('/api/setup/classes');
        const data = await res.json();
        
        if (data.success) {
          classes = data.data;
          renderClasses();
        }
      } catch (error) {
        console.error('Failed to load classes:', error);
      }
    }

    function renderClasses() {
      const list = document.getElementById('class-list');
      
      if (classes.length === 0) {
        list.innerHTML = '<div class="empty-state"><div>No classes added yet</div></div>';
        return;
      }
      
      list.innerHTML = classes.map(cls => \`
        <div class="service-item" style="margin-bottom: 0.5rem;">
          <div class="service-info">
            <span class="service-status">📚</span>
            <div>
              <div class="service-name">\${cls.name}</div>
              <div class="service-details">\${cls.courseCode}\${cls.professor ? ' • ' + cls.professor : ''}</div>
            </div>
          </div>
        </div>
      \`).join('');
    }

    async function addClass() {
      const name = document.getElementById('class-name').value.trim();
      const courseCode = document.getElementById('class-code').value.trim();
      const professor = document.getElementById('class-professor').value.trim();
      
      if (!name || !courseCode) {
        alert('Please enter class name and code');
        return;
      }
      
      try {
        const res = await fetch('/api/setup/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, courseCode, professor }),
        });
        
        const data = await res.json();
        
        if (data.success) {
          classes.push({ id: data.data.id, name, courseCode, professor });
          renderClasses();
          document.getElementById('class-name').value = '';
          document.getElementById('class-code').value = '';
          document.getElementById('class-professor').value = '';
        }
      } catch (error) {
        console.error('Failed to add class:', error);
      }
    }

    // Summary
    async function loadSummary() {
      try {
        const res = await fetch('/api/setup/summary');
        const data = await res.json();
        
        if (data.success) {
          const stats = data.data;
          
          document.getElementById('summary-stats').innerHTML = \`
            <div class="stat-card">
              <div class="stat-value">\${stats.connectedServices.length}</div>
              <div class="stat-label">Services Connected</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">\${stats.taskCounts.inbox + stats.taskCounts.today + stats.taskCounts.upcoming}</div>
              <div class="stat-label">Tasks Tracked</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">\${stats.classCount}</div>
              <div class="stat-label">Classes</div>
            </div>
          \`;
        }
        
        // Load morning preview
        const previewRes = await fetch('/api/setup/preview/morning');
        const previewData = await previewRes.json();
        
        if (previewData.success) {
          document.getElementById('morning-preview').innerHTML = \`
            <div class="card" style="background: var(--bg-dark);">
              <div style="color: var(--text-muted); margin-bottom: 0.5rem; font-size: 0.875rem;">Preview: Your first morning briefing</div>
              <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">\${previewData.data.formatted}</pre>
            </div>
          \`;
        }
      } catch (error) {
        console.error('Failed to load summary:', error);
      }
    }

    async function completeSetup() {
      try {
        await fetch('/api/setup/complete', { method: 'POST' });
        window.location.href = '/';
      } catch (error) {
        console.error('Failed to complete setup:', error);
      }
    }
  </script>
</body>
</html>`;

/**
 * GET /setup
 * Serve the setup wizard UI
 */
setupUI.get('/', (c) => {
  return c.html(setupPageHTML);
});

export { setupUI };
