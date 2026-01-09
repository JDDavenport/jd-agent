import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddBrainDumpTask, useAddBulkTasks, useInbox } from '../hooks/useSetup';
import Button from '../components/common/Button';

function BrainDump() {
  const [input, setInput] = useState('');
  const [sessionCount, setSessionCount] = useState(0);

  const { data: inbox } = useInbox();
  const addTask = useAddBrainDumpTask();
  const addBulk = useAddBulkTasks();

  const handleQuickAdd = async () => {
    if (!input.trim()) return;

    try {
      await addTask.mutateAsync({ title: input });
      setInput('');
      setSessionCount((prev) => prev + 1);
    } catch (error) {
      alert(`Failed to add task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBulkAdd = async () => {
    if (!input.trim()) return;

    // Split by newlines to get individual tasks
    const tasks = input
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((title) => ({ title }));

    if (tasks.length === 0) return;

    try {
      await addBulk.mutateAsync(tasks);
      setInput('');
      setSessionCount((prev) => prev + tasks.length);
    } catch (error) {
      alert(`Failed to add tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter for bulk add
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleBulkAdd();
    }
    // Plain Enter for quick add (if single line)
    else if (e.key === 'Enter' && !e.shiftKey && !input.includes('\n')) {
      e.preventDefault();
      handleQuickAdd();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Brain Dump</h1>
          <p className="text-text-muted mt-1">Get everything out of your head and into your inbox</p>
        </div>

        <Link to="/setup">
          <Button variant="secondary">Go to Setup →</Button>
        </Link>
      </div>

      {/* Main Input */}
      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            What's on your mind?
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start typing... Press Enter to add a single task, or Ctrl/Cmd+Enter to add multiple tasks (one per line)"
            className="input w-full min-h-48 font-mono text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {sessionCount > 0 && `${sessionCount} ${sessionCount === 1 ? 'task' : 'tasks'} added this session`}
          </p>

          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={handleQuickAdd}
              disabled={!input.trim() || input.includes('\n') || addTask.isPending}
            >
              Add Single Task
            </Button>
            <Button
              onClick={handleBulkAdd}
              disabled={!input.trim() || addBulk.isPending}
            >
              Add All ({input.split('\n').filter((l) => l.trim()).length} tasks)
            </Button>
          </div>
        </div>
      </div>

      {/* Stats & Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted mb-2">Total in Inbox</h3>
          <p className="text-3xl font-bold">{inbox?.length || 0}</p>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted mb-2">This Session</h3>
          <p className="text-3xl font-bold">{sessionCount}</p>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted mb-2">Ready to Process</h3>
          <Link to="/setup">
            <Button variant="secondary" className="w-full mt-2">
              Process Inbox →
            </Button>
          </Link>
        </div>
      </div>

      {/* Tips */}
      <div className="card bg-dark-card-hover">
        <h3 className="font-semibold mb-3">💡 Tips for effective brain dumping</h3>
        <ul className="space-y-2 text-sm text-text-muted">
          <li>• Don't worry about organizing - just get it all out</li>
          <li>• One thought per line for bulk adding</li>
          <li>• Include everything: tasks, ideas, worries, reminders</li>
          <li>• You'll organize and prioritize later in the inbox processing step</li>
          <li>• Do this regularly to maintain mental clarity</li>
        </ul>
      </div>

      {/* Quick Links */}
      <div className="card">
        <h3 className="font-semibold mb-3">Next Steps</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/setup">
            <Button>Process Inbox</Button>
          </Link>
          <Link to="/vault">
            <Button variant="secondary">Go to Vault</Button>
          </Link>
          <Link to="/">
            <Button variant="secondary">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default BrainDump;
