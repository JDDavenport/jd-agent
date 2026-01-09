import { format, parseISO } from 'date-fns';
import type { TomorrowPreviewData } from '@jd-agent/types';
import {
  CalendarIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

interface Props {
  preview?: TomorrowPreviewData;
}

export function TomorrowPreview({ preview }: Props) {
  if (!preview) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading tomorrow's preview...
      </div>
    );
  }

  const { events, tasks, habits } = preview;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Tomorrow Preview</h2>
        <p className="text-sm text-gray-500 mt-1">
          Get a head start on what's coming up
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Events */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">
              Events ({events.length})
            </h3>
          </div>
          <div className="p-4">
            {events.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No events scheduled
              </p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="text-xs text-gray-500 font-medium w-16 flex-shrink-0 pt-0.5">
                      {format(parseISO(event.startTime), 'h:mm a')}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {event.title}
                      </p>
                      {event.location && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                          <MapPinIcon className="w-3 h-3" />
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-5 h-5 text-green-600" />
            <h3 className="font-medium text-green-900">
              Tasks ({tasks.length})
            </h3>
          </div>
          <div className="p-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No tasks due
              </p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 8).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-50"
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority >= 3
                          ? 'bg-red-500'
                          : task.priority >= 2
                          ? 'bg-orange-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-sm text-gray-700 flex-1 truncate">
                      {task.title}
                    </span>
                    {task.projectName && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {task.projectName}
                      </span>
                    )}
                  </div>
                ))}
                {tasks.length > 8 && (
                  <p className="text-xs text-gray-400 text-center pt-2">
                    +{tasks.length - 8} more tasks
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Habits */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden md:col-span-2 lg:col-span-1">
          <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
            <ArrowPathIcon className="w-5 h-5 text-purple-600" />
            <h3 className="font-medium text-purple-900">
              Habits ({habits.length})
            </h3>
          </div>
          <div className="p-4">
            {habits.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No habits scheduled
              </p>
            ) : (
              <div className="space-y-2">
                {habits.map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                        ○
                      </span>
                      <span className="text-sm text-gray-700">{habit.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {habit.currentStreak > 0 && (
                        <span className="text-xs text-orange-500">
                          🔥 {habit.currentStreak}
                        </span>
                      )}
                      {habit.timeOfDay && (
                        <span className="text-xs text-gray-400 capitalize">
                          {habit.timeOfDay}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <p className="text-sm text-gray-600">
          Take a moment to mentally prepare for tomorrow. What's your top priority?
        </p>
      </div>
    </div>
  );
}
