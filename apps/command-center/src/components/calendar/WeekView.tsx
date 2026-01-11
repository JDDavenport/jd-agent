import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
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

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (start: Date, end: Date) => void;
}

const HOUR_HEIGHT = 60; // pixels per hour
const START_HOUR = 6; // 6 AM
const END_HOUR = 22; // 10 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-purple-500 border-purple-600',
  class: 'bg-blue-500 border-blue-600',
  deadline: 'bg-red-500 border-red-600',
  personal: 'bg-green-500 border-green-600',
  blocked_time: 'bg-yellow-500 border-yellow-600',
};

export default function WeekView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventDate = parseISO(event.startTime);
      return isSameDay(eventDate, date);
    });
  };

  const getAllDayEvents = (date: Date) => {
    return getEventsForDay(date).filter((event) => event.allDay);
  };

  const getTimedEvents = (date: Date) => {
    return getEventsForDay(date).filter((event) => !event.allDay);
  };

  const getEventPosition = (event: CalendarEvent) => {
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    const startHour = getHours(start);
    const startMinute = getMinutes(start);
    const durationMinutes = differenceInMinutes(end, start);

    const top = (startHour - START_HOUR) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20); // Minimum height of 20px

    return { top, height };
  };

  const handleSlotClick = (day: Date, hour: number) => {
    const start = setMinutes(setHours(day, hour), 0);
    const end = setMinutes(setHours(day, hour + 1), 0);
    onSlotClick(start, end);
  };

  // Current time indicator
  const now = new Date();
  const currentTimeTop =
    (getHours(now) - START_HOUR) * HOUR_HEIGHT + (getMinutes(now) / 60) * HOUR_HEIGHT;
  const showCurrentTime = getHours(now) >= START_HOUR && getHours(now) < END_HOUR;

  return (
    <div className="flex flex-col">
      {/* All-day events row */}
      <div className="flex border-b border-dark-border">
        <div className="w-16 flex-shrink-0 py-2 text-xs text-text-muted text-right pr-2">
          All day
        </div>
        <div className="flex-1 grid grid-cols-7">
          {days.map((day) => {
            const allDayEvents = getAllDayEvents(day);
            return (
              <div
                key={day.toISOString()}
                className="border-l border-dark-border min-h-[40px] p-1"
              >
                {allDayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={`px-2 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80 mb-1 ${
                      EVENT_TYPE_COLORS[event.eventType]?.split(' ')[0] || 'bg-accent'
                    } text-white`}
                  >
                    {event.title}
                  </div>
                ))}
                {allDayEvents.length > 2 && (
                  <div className="text-xs text-text-muted px-2">
                    +{allDayEvents.length - 2} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-dark-border sticky top-0 bg-dark-card z-10">
        <div className="w-16 flex-shrink-0" />
        <div className="flex-1 grid grid-cols-7">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`py-3 text-center border-l border-dark-border ${
                isToday(day) ? 'bg-accent/10' : ''
              }`}
            >
              <div className="text-xs text-text-muted uppercase">{format(day, 'EEE')}</div>
              <div
                className={`text-lg font-semibold mt-1 ${
                  isToday(day) ? 'text-accent' : 'text-text'
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex flex-1 overflow-y-auto" style={{ maxHeight: '500px' }}>
        {/* Time labels */}
        <div className="w-16 flex-shrink-0">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="text-xs text-text-muted text-right pr-2 relative"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="absolute -top-2 right-2">
                {format(setHours(new Date(), hour), 'h a')}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex-1 grid grid-cols-7 relative">
          {/* Hour grid lines */}
          <div className="absolute inset-0 pointer-events-none">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-t border-dark-border"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}
          </div>

          {/* Current time indicator */}
          {showCurrentTime && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: currentTimeTop }}
            >
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}

          {/* Day columns with events */}
          {days.map((day) => {
            const timedEvents = getTimedEvents(day);
            const isDayToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`relative border-l border-dark-border ${
                  isDayToday ? 'bg-accent/5' : ''
                }`}
              >
                {/* Clickable hour slots */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    onClick={() => handleSlotClick(day, hour)}
                    className="absolute w-full cursor-pointer hover:bg-accent/10 transition-colors"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {timedEvents.map((event) => {
                  const { top, height } = getEventPosition(event);
                  const eventHour = getHours(parseISO(event.startTime));

                  // Only show events within visible hours
                  if (eventHour < START_HOUR || eventHour >= END_HOUR) return null;

                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className={`absolute left-1 right-1 rounded-md px-2 py-1 text-xs cursor-pointer overflow-hidden border-l-4 ${
                        EVENT_TYPE_COLORS[event.eventType] || 'bg-accent border-accent'
                      } text-white hover:opacity-90 z-10`}
                      style={{ top, height, minHeight: 20 }}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      {height > 30 && (
                        <div className="text-white/80 truncate">
                          {format(parseISO(event.startTime), 'h:mm a')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
