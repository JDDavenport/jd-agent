import { useState, useRef, useEffect } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useCreateTask } from '../hooks/useTasks';
import type { TaskStatus } from '../api';

interface InlineAddTaskProps {
  context?: string;
  status?: TaskStatus;
  placeholder?: string;
  projectId?: string;
  onAdd?: () => void;
}

export function InlineAddTask({
  context = 'Personal',
  status = 'inbox',
  placeholder = 'Add a task...',
  projectId,
  onAdd,
}: InlineAddTaskProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createTask.mutateAsync({
      title: title.trim(),
      context,
      status,
      source: 'manual',
      projectId,
    });

    setTitle('');
    setIsEditing(false);
    onAdd?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTitle('');
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (!title.trim()) {
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        <span>Add task</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!title.trim() || createTask.isPending}
          className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle('');
            setIsEditing(false);
          }}
          className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
