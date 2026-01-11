import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import type { CalendarEvent } from '../../types/calendar';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-purple-400',
  class: 'bg-blue-400',
  deadline: 'bg-red-400',
  personal: 'bg-green-400',
  blocked_time: 'bg-yellow-400',
};

export default function MonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventDate = parseISO(event.startTime);
      return isSameDay(eventDate, date);
    });
  };

  return (
    <div>
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-dark-border">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-medium text-text-muted uppercase tracking-wide"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isDayToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => onDateClick(day)}
                className={`min-h-[120px] border-b border-r border-dark-border p-2 cursor-pointer transition-colors hover:bg-dark-card-hover ${
                  !isCurrentMonth ? 'bg-dark-bg/50' : ''
                } ${dayIndex === 0 ? 'border-l' : ''} ${weekIndex === 0 ? 'border-t' : ''}`}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                      isDayToday
                        ? 'bg-accent text-white'
                        : isCurrentMonth
                        ? 'text-text'
                        : 'text-text-muted'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 3 && (
                    <span className="text-xs text-text-muted">+{dayEvents.length - 3}</span>
                  )}
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className={`px-2 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80 ${
                        EVENT_TYPE_COLORS[event.eventType] || 'bg-accent'
                      } text-white`}
                      title={event.title}
                    >
                      {event.allDay ? (
                        event.title
                      ) : (
                        <>
                          <span className="font-medium">{format(parseISO(event.startTime), 'h:mm')}</span>{' '}
                          {event.title}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
