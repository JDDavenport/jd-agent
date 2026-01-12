import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { PlusIcon, XMarkIcon, SparklesIcon, ArrowPathIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import { useCreateTask, useCreateSubtask } from '../hooks/useTasks';
import { parseNaturalLanguage, formatParsedPreview, rruleToText } from '../utils/parseNaturalLanguage';

const RECURRENCE_PRESETS = [
  { label: 'None', value: '' },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekdays', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Bi-weekly', value: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
] as const;

interface QuickAddTaskProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultProjectName?: string;
  parentTaskId?: string;
  parentTaskTitle?: string;
}

const CONTEXTS = ['Personal', 'Work', 'MBA', 'Health', 'Admin'];

const PRIORITY_TO_LEVEL = {
  4: 'high',
  3: 'high',
  2: 'low',
  1: 'low',
} as const;

export function QuickAddTask({
  isOpen,
  onClose,
  defaultProjectId,
  defaultProjectName,
  parentTaskId,
  parentTaskTitle,
}: QuickAddTaskProps) {
  const [input, setInput] = useState('');
  const [context, setContext] = useState('Personal');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualDueDate, setManualDueDate] = useState('');
  const [manualRecurrence, setManualRecurrence] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();
  const createSubtask = useCreateSubtask();
  const isSubtask = !!parentTaskId;

  const parsed = useMemo(() => parseNaturalLanguage(input), [input]);
  const preview = useMemo(() => formatParsedPreview(parsed), [parsed]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Set default project when modal opens
      setProjectId(defaultProjectId);
      setProjectName(defaultProjectName);
    } else {
      // Reset state when closed
      setInput('');
      setManualDueDate('');
      setManualRecurrence('');
      setShowAdvanced(false);
      setProjectId(undefined);
      setProjectName(undefined);
    }
  }, [isOpen, defaultProjectId, defaultProjectName]);

  // Update context if parsed from input
  useEffect(() => {
    if (parsed.contexts?.length) {
      const matchedContext = CONTEXTS.find(
        (c) => c.toLowerCase() === parsed.contexts![0].toLowerCase()
      );
      if (matchedContext) {
        setContext(matchedContext);
      }
    }
  }, [parsed.contexts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.title.trim()) return;

    const dueDate = manualDueDate || parsed.dueDate;
    const recurrence = manualRecurrence || parsed.recurrence;

    const taskInput = {
      title: parsed.title.trim(),
      context,
      dueDate: dueDate || undefined,
      source: 'manual' as const,
      priority: parsed.priority,
      timeEstimateMinutes: parsed.timeEstimate,
      energyLevel: parsed.priority
        ? PRIORITY_TO_LEVEL[parsed.priority as keyof typeof PRIORITY_TO_LEVEL]
        : undefined,
      projectId: projectId || undefined,
      recurrenceRule: recurrence || undefined,
    };

    if (isSubtask && parentTaskId) {
      // Create subtask
      await createSubtask.mutateAsync({
        parentTaskId,
        input: taskInput,
      });
    } else {
      // Create regular task
      await createTask.mutateAsync(taskInput);
    }

    setInput('');
    setManualDueDate('');
    setManualRecurrence('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-start justify-center pt-20 px-4">
        <Dialog.Panel data-testid="quick-add-modal" className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
          <form data-testid="quick-add-form" onSubmit={handleSubmit}>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${isSubtask ? 'bg-purple-100' : 'bg-blue-100'} rounded-full flex items-center justify-center`}>
                  {isSubtask ? (
                    <ListBulletIcon className="w-5 h-5 text-purple-600" />
                  ) : (
                    <PlusIcon className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <Dialog.Title data-testid="quick-add-title" className="text-lg font-semibold">
                  {isSubtask ? 'Add Subtask' : 'Quick Add Task'}
                </Dialog.Title>
                <button
                  type="button"
                  data-testid="quick-add-close"
                  onClick={onClose}
                  className="ml-auto p-1 hover:bg-gray-100 rounded"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Parent task banner (when adding subtask) */}
              {isSubtask && parentTaskTitle && (
                <div className="mb-4 p-3 bg-purple-50 rounded-lg flex items-center gap-2">
                  <ListBulletIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="text-sm text-purple-900">
                    Adding subtask to: <strong>{parentTaskTitle}</strong>
                  </span>
                </div>
              )}

              <input
                ref={inputRef}
                data-testid="quick-add-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buy groceries tomorrow @home #errands p2"
                className="w-full px-4 py-3 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Smart Parse Preview */}
              {input.trim() && (preview.length > 0 || parsed.title !== input) && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <SparklesIcon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-blue-900 truncate">
                        {parsed.title || '(empty title)'}
                      </div>
                      {preview.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {preview.map((part, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded"
                            >
                              {part}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Project Badge (if selected) */}
              {projectName && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Project:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-purple-500 rounded-full" />
                    {projectName}
                    <button
                      type="button"
                      onClick={() => {
                        setProjectId(undefined);
                        setProjectName(undefined);
                      }}
                      className="ml-1 hover:bg-purple-200 rounded-full p-0.5"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}

              {/* Context Selection */}
              <div className="mt-4 flex flex-wrap gap-2">
                {CONTEXTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setContext(c)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      context === c
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
              >
                {showAdvanced ? '− Hide options' : '+ More options'}
              </button>

              {showAdvanced && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={manualDueDate}
                        onChange={(e) => setManualDueDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        <ArrowPathIcon className="w-3 h-3 inline mr-1" />
                        Repeat
                      </label>
                      <select
                        value={manualRecurrence || parsed.recurrence || ''}
                        onChange={(e) => setManualRecurrence(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {RECURRENCE_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {(manualRecurrence || parsed.recurrence) && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <ArrowPathIcon className="w-3 h-3" />
                      <span>{rruleToText(manualRecurrence || parsed.recurrence || '')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Input Help */}
              <div className="mt-4 text-xs text-gray-400 space-y-1">
                <p><strong>Tips:</strong> Use natural language</p>
                <p>
                  <code className="bg-gray-100 px-1 rounded">tomorrow</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">friday</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">jan 15</code> for dates
                </p>
                <p>
                  <code className="bg-gray-100 px-1 rounded">daily</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">every monday</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">weekly</code> for recurrence
                </p>
                <p>
                  <code className="bg-gray-100 px-1 rounded">@work</code> for context,{' '}
                  <code className="bg-gray-100 px-1 rounded">#urgent</code> for labels,{' '}
                  <code className="bg-gray-100 px-1 rounded">p1</code>-
                  <code className="bg-gray-100 px-1 rounded">p4</code> for priority
                </p>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
              <button
                type="button"
                data-testid="quick-add-cancel"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="quick-add-submit"
                disabled={!parsed.title.trim() || createTask.isPending || createSubtask.isPending}
                className={`px-4 py-2 ${isSubtask ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {createTask.isPending || createSubtask.isPending
                  ? 'Adding...'
                  : isSubtask
                    ? 'Add Subtask'
                    : 'Add Task'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
