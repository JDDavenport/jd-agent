/**
 * MiniCalendar
 *
 * A 7-day mini calendar showing completion status as dots.
 * Used in the habits metric card.
 */

interface MiniCalendarProps {
  days: boolean[]; // 7 days, oldest to newest
  activeColor?: string;
  inactiveColor?: string;
}

export function MiniCalendar({
  days,
  activeColor = 'bg-success',
  inactiveColor = 'bg-dark-border',
}: MiniCalendarProps) {
  // Get day labels (M, T, W, T, F, S, S)
  const today = new Date();
  const dayLabels: string[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dayLabels.push(['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()]);
  }

  return (
    <div className="flex items-center gap-1.5">
      {days.map((completed, index) => (
        <div key={index} className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-text-muted">{dayLabels[index]}</span>
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              completed ? activeColor : inactiveColor
            }`}
            title={`${dayLabels[index]}: ${completed ? 'Completed' : 'Missed'}`}
          />
        </div>
      ))}
    </div>
  );
}

export default MiniCalendar;
