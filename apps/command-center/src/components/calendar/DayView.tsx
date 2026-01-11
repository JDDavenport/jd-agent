import {
  format,
  isSameDay,
  isToday,
  parseISO,
  getHours,
  getMinutes,
  differenceInMinutes,
  setHours,
  setMinutes,
} from 'date-fns';
import type { CalendarEvent } from '../../types/calendar';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (start: Date, end: Date) => void;
}

const HOUR_HEIGHT = 80; // Larger for day view
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-purple-500 border-purple-600',
  class: 'bg-blue-500 border-blue-600',
  deadline: 'bg-red-500 border-red-600',
  personal: 'bg-green-500 border-green-600',
  blocked_time: 'bg-yellow-500 border-yellow-600',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  meeting: 'Meeting',
  class: 'Class',
  deadline: 'Deadline',
  personal: 'Personal',
  blocked_time: 'Focus Time',
};

export default function DayView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: DayViewProps) {
  const dayEvents = events.filter((event) => {
    const eventDate = parseISO(event.startTime);
    return isSameDay(eventDate, currentDate);
  });

  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const timedEvents = dayEvents.filter((event) => !event.allDay);

  const getEventPosition = (event: CalendarEvent) => {
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    const startHour = getHours(start);
    const startMinute = getMinutes(start);
    const durationMinutes = differenceInMinutes(end, start);

    const top = (startHour - START_HOUR) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 30);

    return { top, height };
  };

  const handleSlotClick = (hour: number) => {
    const start = setMinutes(setHours(currentDate, hour), 0);
    const end = setMinutes(setHours(currentDate, hour + 1), 0);
    onSlotClick(start, end);
  };

  // Current time indicator
  const now = new Date();
  const isDayToday = isToday(currentDate);
  const currentTimeTop =
    (getHours(now) - START_HOUR) * HOUR_HEIGHT + (getMinutes(now) / 60) * HOUR_HEIGHT;
  const showCurrentTime = isDayToday && getHours(now) >= START_HOUR && getHours(now) < END_HOUR;

  return (
    <div className="flex flex-col">
      {/* Day Header */}
      <div className="flex items-center justify-center py-4 border-b border-dark-border">
        <div className="text-center">
          <div className="text-sm text-text-muted uppercase tracking-wide">
            {format(currentDate, 'EEEE')}
          </div>
          <div
            className={`text-4xl font-bold mt-1 ${
              isDayToday ? 'text-accent' : 'text-text'
            }`}
          >
            {format(currentDate, 'd')}
          </div>
          <div className="text-sm text-text-muted">{format(currentDate, 'MMMM yyyy')}</div>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-dark-border p-3">
          <div className="text-xs text-text-muted mb-2 uppercase tracking-wide">All Day</div>
          <div className="space-y-2">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className={`px-3 py-2 rounded-lg cursor-pointer hover:opacity-80 ${
                  EVENT_TYPE_COLORS[event.eventType]?.split(' ')[0] || 'bg-accent'
                } text-white`}
              >
                <div className="font-medium">{event.title}</div>
                {event.location && (
                  <div className="text-sm text-white/80 mt-0.5">{event.location}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex flex-1 overflow-y-auto" style={{ maxHeight: '500px' }}>
        {/* Time labels */}
        <div className="w-20 flex-shrink-0">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="text-sm text-text-muted text-right pr-3 relative"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="absolute -top-2 right-3">
                {format(setHours(new Date(), hour), 'h a')}
              </span>
            </div>
          ))}
        </div>

        {/* Main content area */}
        <div className={`flex-1 relative border-l border-dark-border ${isDayToday ? 'bg-accent/5' : ''}`}>
          {/* Hour grid lines */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              onClick={() => handleSlotClick(hour)}
              className="border-t border-dark-border cursor-pointer hover:bg-accent/10 transition-colors"
              style={{ height: HOUR_HEIGHT }}
            />
          ))}

          {/* Current time indicator */}
          {showCurrentTime && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: currentTimeTop }}
            >
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}

          {/* Events */}
          {timedEvents.map((event) => {
            const { top, height } = getEventPosition(event);
            const eventHour = getHours(parseISO(event.startTime));

            if (eventHour < START_HOUR || eventHour >= END_HOUR) return null;

            return (
              <div
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                className={`absolute left-2 right-4 rounded-lg px-3 py-2 cursor-pointer border-l-4 ${
                  EVENT_TYPE_COLORS[event.eventType] || 'bg-accent border-accent'
                } text-white hover:opacity-90 z-10 shadow-lg`}
                style={{ top, height, minHeight: 40 }}
              >
                <div className="font-medium text-base">{event.title}</div>
                <div className="text-sm text-white/80 mt-0.5">
                  {format(parseISO(event.startTime), 'h:mm a')} -{' '}
                  {format(parseISO(event.endTime), 'h:mm a')}
                </div>
                {height > 80 && (
                  <>
                    {event.location && (
                      <div className="text-sm text-white/70 mt-1 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {event.location}
                      </div>
                    )}
                    <div className="text-xs text-white/60 mt-1">
                      {EVENT_TYPE_LABELS[event.eventType] || 'Event'}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* No events message */}
      {dayEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg">No events scheduled</p>
          <p className="text-sm mt-1">Click on a time slot to create an event</p>
        </div>
      )}
    </div>
  );
}
