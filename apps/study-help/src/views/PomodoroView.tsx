import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useSchoolTasks, useCompleteTask } from '../hooks/useStudy';
import type { Task } from '../types';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

const DURATIONS: Record<TimerMode, number> = {
  work: 25 * 60, // 25 minutes
  shortBreak: 5 * 60, // 5 minutes
  longBreak: 15 * 60, // 15 minutes
};

const MODE_LABELS: Record<TimerMode, string> = {
  work: 'Focus Time',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

export function PomodoroView() {
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(DURATIONS.work);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: tasks } = useSchoolTasks();
  const completeTask = useCompleteTask();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filter incomplete tasks
  const incompleteTasks = tasks?.filter((t) => t.status !== 'done') || [];

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    return () => {
      audioRef.current = null;
    };
  }, []);

  const playNotification = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Silently fail if audio can't play
      });
    }
  }, [soundEnabled]);

  const switchMode = useCallback((newMode: TimerMode) => {
    setMode(newMode);
    setTimeLeft(DURATIONS[newMode]);
    setIsRunning(false);
  }, []);

  // Handle timer completion
  const handleTimerComplete = useCallback(() => {
    playNotification();
    setIsRunning(false);

    if (mode === 'work') {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);

      // Suggest break
      if (newCount % 4 === 0) {
        switchMode('longBreak');
      } else {
        switchMode('shortBreak');
      }
    } else {
      switchMode('work');
    }
  }, [mode, completedPomodoros, playNotification, switchMode]);

  // Timer logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, handleTimerComplete, timeLeft]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(DURATIONS[mode]);
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = ((DURATIONS[mode] - timeLeft) / DURATIONS[mode]) * 100;

  // Get course color for task
  const getCourseColor = (context: string): string => {
    const upper = context?.toUpperCase() || '';
    if (upper.includes('MBA560')) return 'bg-blue-100 text-blue-800';
    if (upper.includes('MBA580')) return 'bg-purple-100 text-purple-800';
    if (upper.includes('MBA654')) return 'bg-green-100 text-green-800';
    if (upper.includes('MBA664')) return 'bg-amber-100 text-amber-800';
    if (upper.includes('MBA677')) return 'bg-rose-100 text-rose-800';
    if (upper.includes('MBA693R')) return 'bg-cyan-100 text-cyan-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Study Timer</h1>
        <p className="text-gray-600 mt-1">
          Focus with the Pomodoro technique • {completedPomodoros} sessions completed today
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timer Section */}
        <div
          className={clsx(
            'rounded-2xl p-8 text-center transition-all duration-500',
            mode === 'work'
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 timer-glow'
              : 'bg-gradient-to-br from-green-500 to-emerald-600 timer-glow-break'
          )}
        >
          {/* Mode selector */}
          <div className="flex justify-center gap-2 mb-8">
            {(['work', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  mode === m
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Timer display */}
          <div className="relative w-64 h-64 mx-auto mb-8">
            {/* Progress ring */}
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="8"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 120}
                strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
                className="transition-all duration-1000"
              />
            </svg>
            {/* Time */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl font-bold text-white tabular-nums">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            <button
              onClick={resetTimer}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Reset"
            >
              <ArrowPathIcon className="w-6 h-6" />
            </button>
            <button
              onClick={toggleTimer}
              className="p-4 rounded-full bg-white text-blue-600 hover:bg-gray-100 transition-colors"
            >
              {isRunning ? (
                <PauseIcon className="w-8 h-8" />
              ) : (
                <PlayIcon className="w-8 h-8" />
              )}
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? (
                <SpeakerWaveIcon className="w-6 h-6" />
              ) : (
                <SpeakerXMarkIcon className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Current task */}
          {selectedTaskId && (
            <div className="mt-6 p-3 bg-white/10 rounded-lg">
              <p className="text-sm text-white/70">Working on:</p>
              <p className="text-white font-medium">
                {tasks?.find((t) => t.id === selectedTaskId)?.title}
              </p>
            </div>
          )}
        </div>

        {/* Tasks Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Select a task to focus on</h2>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {incompleteTasks.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {incompleteTasks.slice(0, 10).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                    className={clsx(
                      'w-full text-left p-4 transition-colors',
                      selectedTaskId === task.id
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={clsx(
                          'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          selectedTaskId === task.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        )}
                      >
                        {selectedTaskId === task.id && (
                          <CheckCircleIcon className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={clsx('text-xs px-2 py-0.5 rounded', getCourseColor(task.context))}>
                            {task.context?.split('-')[0] || 'Task'}
                          </span>
                          {task.timeEstimateMinutes && (
                            <span className="text-xs text-gray-500">
                              ~{task.timeEstimateMinutes}m
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-gray-500">No tasks available</p>
            )}
          </div>

          {/* Mark complete button */}
          {selectedTaskId && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  completeTask.mutate(selectedTaskId);
                  setSelectedTaskId(null);
                }}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Mark Task Complete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Session history */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Today's Progress</h3>
        <div className="flex gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                i < completedPomodoros
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {completedPomodoros} of 8 sessions • ~{completedPomodoros * 25} minutes focused
        </p>
      </div>
    </div>
  );
}
