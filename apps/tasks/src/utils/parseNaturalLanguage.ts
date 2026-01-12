import { format, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, parse, isValid } from 'date-fns';

export interface ParsedTask {
  title: string;
  dueDate?: string;
  priority?: number;
  contexts?: string[];
  labels?: string[];
  timeEstimate?: number;
  recurrence?: string; // RRULE format
  rawInput: string;
}

// Day name to RRULE BYDAY mapping
const DAY_TO_RRULE: Record<string, string> = {
  'monday': 'MO', 'mon': 'MO',
  'tuesday': 'TU', 'tue': 'TU',
  'wednesday': 'WE', 'wed': 'WE',
  'thursday': 'TH', 'thu': 'TH',
  'friday': 'FR', 'fri': 'FR',
  'saturday': 'SA', 'sat': 'SA',
  'sunday': 'SU', 'sun': 'SU',
};

// Recurrence patterns with their RRULE equivalents
const RECURRENCE_PATTERNS: Array<{ pattern: RegExp; rrule: string | ((match: RegExpMatchArray) => string) }> = [
  // "daily" or "every day"
  { pattern: /\b(daily|every\s+day)\b/i, rrule: 'FREQ=DAILY' },
  // "weekly" or "every week"
  { pattern: /\b(weekly|every\s+week)\b/i, rrule: 'FREQ=WEEKLY' },
  // "bi-weekly" or "every 2 weeks" or "every other week"
  { pattern: /\b(bi-?weekly|every\s+2\s+weeks?|every\s+other\s+week)\b/i, rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  // "monthly" or "every month"
  { pattern: /\b(monthly|every\s+month)\b/i, rrule: 'FREQ=MONTHLY' },
  // "every weekday" or "weekdays"
  { pattern: /\b(every\s+weekday|weekdays)\b/i, rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  // "every Monday" or "every Tuesday" etc
  {
    pattern: /\bevery\s+(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/i,
    rrule: (match) => `FREQ=WEEKLY;BYDAY=${DAY_TO_RRULE[match[1].toLowerCase()]}`
  },
  // "every Monday and Wednesday" or "every Tuesday, Thursday"
  {
    pattern: /\bevery\s+((?:monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)(?:\s*(?:,|and)\s*(?:monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun))+)\b/i,
    rrule: (match) => {
      const days = match[1].toLowerCase().split(/\s*(?:,|and)\s*/);
      const bydays = days.map(d => DAY_TO_RRULE[d.trim()]).filter(Boolean);
      return `FREQ=WEEKLY;BYDAY=${bydays.join(',')}`;
    }
  },
  // "every N days/weeks/months"
  {
    pattern: /\bevery\s+(\d+)\s+(day|week|month)s?\b/i,
    rrule: (match) => {
      const interval = parseInt(match[1], 10);
      const freq = match[2].toUpperCase() + 'LY';
      return interval === 1 ? `FREQ=${freq}` : `FREQ=${freq};INTERVAL=${interval}`;
    }
  },
];

const DATE_KEYWORDS: Record<string, () => Date> = {
  'today': () => new Date(),
  'tod': () => new Date(),
  'tomorrow': () => addDays(new Date(), 1),
  'tom': () => addDays(new Date(), 1),
  'tmrw': () => addDays(new Date(), 1),
  'monday': () => nextMonday(new Date()),
  'mon': () => nextMonday(new Date()),
  'tuesday': () => nextTuesday(new Date()),
  'tue': () => nextTuesday(new Date()),
  'wednesday': () => nextWednesday(new Date()),
  'wed': () => nextWednesday(new Date()),
  'thursday': () => nextThursday(new Date()),
  'thu': () => nextThursday(new Date()),
  'friday': () => nextFriday(new Date()),
  'fri': () => nextFriday(new Date()),
  'saturday': () => nextSaturday(new Date()),
  'sat': () => nextSaturday(new Date()),
  'sunday': () => nextSunday(new Date()),
  'sun': () => nextSunday(new Date()),
  'next week': () => addDays(new Date(), 7),
  'in a week': () => addDays(new Date(), 7),
};

const TIME_PATTERNS = [
  { pattern: /(\d+)\s*min(?:ute)?s?/i, multiplier: 1 },
  { pattern: /(\d+)\s*hr?(?:our)?s?/i, multiplier: 60 },
  { pattern: /(\d+(?:\.\d+)?)\s*h/i, multiplier: 60 },
];

export function parseNaturalLanguage(input: string): ParsedTask {
  let text = input.trim();
  const result: ParsedTask = {
    title: '',
    rawInput: input,
  };

  // Extract priority (p1, p2, p3, p4 or !!, !, !!!)
  const priorityMatch = text.match(/\bp([1-4])\b/i) || text.match(/(!{1,3})/);
  if (priorityMatch) {
    if (priorityMatch[1].startsWith('!')) {
      // ! = p3, !! = p2, !!! = p1
      result.priority = 4 - priorityMatch[1].length;
    } else {
      // p1 = priority 4, p2 = priority 3, etc.
      result.priority = 5 - parseInt(priorityMatch[1], 10);
    }
    text = text.replace(priorityMatch[0], '').trim();
  }

  // Extract @contexts
  const contextMatches = text.match(/@(\w+)/g);
  if (contextMatches) {
    result.contexts = contextMatches.map((m) => m.slice(1).toLowerCase());
    text = text.replace(/@\w+/g, '').trim();
  }

  // Extract #labels
  const labelMatches = text.match(/#(\w+)/g);
  if (labelMatches) {
    result.labels = labelMatches.map((m) => m.slice(1).toLowerCase());
    text = text.replace(/#\w+/g, '').trim();
  }

  // Extract time estimates
  for (const { pattern, multiplier } of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.timeEstimate = Math.round(parseFloat(match[1]) * multiplier);
      text = text.replace(match[0], '').trim();
      break;
    }
  }

  // Extract recurrence patterns
  for (const { pattern, rrule } of RECURRENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.recurrence = typeof rrule === 'function' ? rrule(match) : rrule;
      text = text.replace(match[0], '').trim();

      // Set the first due date based on recurrence type
      if (result.recurrence) {
        const rruleParts = result.recurrence.split(';');
        const byday = rruleParts.find(p => p.startsWith('BYDAY='))?.replace('BYDAY=', '');
        const freq = rruleParts.find(p => p.startsWith('FREQ='))?.replace('FREQ=', '');

        if (byday) {
          // Get the first day in the BYDAY list and set due date to next occurrence
          const firstDay = byday.split(',')[0];
          const dayMap: Record<string, () => Date> = {
            'MO': () => nextMonday(new Date()),
            'TU': () => nextTuesday(new Date()),
            'WE': () => nextWednesday(new Date()),
            'TH': () => nextThursday(new Date()),
            'FR': () => nextFriday(new Date()),
            'SA': () => nextSaturday(new Date()),
            'SU': () => nextSunday(new Date()),
          };
          if (dayMap[firstDay]) {
            result.dueDate = format(dayMap[firstDay](), 'yyyy-MM-dd');
          }
        } else if (freq === 'DAILY') {
          // Daily tasks start today
          result.dueDate = format(new Date(), 'yyyy-MM-dd');
        } else if (freq === 'WEEKLY') {
          // Weekly without specific day starts next week
          result.dueDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
        } else if (freq === 'MONTHLY') {
          // Monthly starts today (same day next month)
          result.dueDate = format(new Date(), 'yyyy-MM-dd');
        }
      }
      break;
    }
  }

  // Extract date keywords (can override recurrence-inferred date)
  for (const [keyword, getDate] of Object.entries(DATE_KEYWORDS)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(text)) {
      result.dueDate = format(getDate(), 'yyyy-MM-dd');
      text = text.replace(regex, '').trim();
      break;
    }
  }

  // Try to match date patterns like "Jan 15", "1/15", "15 Jan"
  if (!result.dueDate) {
    // Match "Jan 15" or "January 15"
    const monthDayMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (monthDayMatch) {
      const dateStr = `${monthDayMatch[1]} ${monthDayMatch[2]}, ${new Date().getFullYear()}`;
      const parsed = parse(dateStr, 'MMM d, yyyy', new Date());
      if (isValid(parsed)) {
        // If the date is in the past, assume next year
        if (parsed < new Date()) {
          parsed.setFullYear(parsed.getFullYear() + 1);
        }
        result.dueDate = format(parsed, 'yyyy-MM-dd');
        text = text.replace(monthDayMatch[0], '').trim();
      }
    }

    // Match "1/15" or "01/15"
    const slashDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (slashDateMatch) {
      const month = parseInt(slashDateMatch[1], 10);
      const day = parseInt(slashDateMatch[2], 10);
      let year = slashDateMatch[3] ? parseInt(slashDateMatch[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;

      const parsed = new Date(year, month - 1, day);
      if (isValid(parsed)) {
        if (parsed < new Date() && !slashDateMatch[3]) {
          parsed.setFullYear(parsed.getFullYear() + 1);
        }
        result.dueDate = format(parsed, 'yyyy-MM-dd');
        text = text.replace(slashDateMatch[0], '').trim();
      }
    }
  }

  // Clean up the title
  result.title = text.replace(/\s+/g, ' ').trim();

  return result;
}

// Convert RRULE to human-readable text
export function rruleToText(rrule: string): string {
  if (!rrule) return '';

  const parts = rrule.split(';');
  const freq = parts.find(p => p.startsWith('FREQ='))?.replace('FREQ=', '');
  const interval = parts.find(p => p.startsWith('INTERVAL='))?.replace('INTERVAL=', '');
  const byday = parts.find(p => p.startsWith('BYDAY='))?.replace('BYDAY=', '');

  const dayNames: Record<string, string> = {
    'MO': 'Mon', 'TU': 'Tue', 'WE': 'Wed', 'TH': 'Thu',
    'FR': 'Fri', 'SA': 'Sat', 'SU': 'Sun'
  };

  let text = '';
  const intervalNum = interval ? parseInt(interval, 10) : 1;

  switch (freq) {
    case 'DAILY':
      text = intervalNum === 1 ? 'Daily' : `Every ${intervalNum} days`;
      break;
    case 'WEEKLY':
      if (byday) {
        const days = byday.split(',').map(d => dayNames[d] || d).join(', ');
        if (byday === 'MO,TU,WE,TH,FR') {
          text = 'Weekdays';
        } else {
          text = intervalNum === 1 ? `Weekly · ${days}` : `Every ${intervalNum} weeks · ${days}`;
        }
      } else {
        text = intervalNum === 1 ? 'Weekly' : `Every ${intervalNum} weeks`;
      }
      break;
    case 'MONTHLY':
      text = intervalNum === 1 ? 'Monthly' : `Every ${intervalNum} months`;
      break;
    default:
      text = rrule;
  }

  return text;
}

export function formatParsedPreview(parsed: ParsedTask): string[] {
  const parts: string[] = [];

  if (parsed.dueDate) {
    const date = new Date(parsed.dueDate + 'T12:00:00');
    parts.push(`📅 ${format(date, 'MMM d')}`);
  }

  if (parsed.recurrence) {
    parts.push(`🔄 ${rruleToText(parsed.recurrence)}`);
  }

  if (parsed.priority) {
    parts.push(`🏷️ P${5 - parsed.priority}`);
  }

  if (parsed.contexts?.length) {
    parts.push(`@${parsed.contexts.join(', @')}`);
  }

  if (parsed.labels?.length) {
    parts.push(`#${parsed.labels.join(', #')}`);
  }

  if (parsed.timeEstimate) {
    if (parsed.timeEstimate >= 60) {
      parts.push(`⏱️ ${Math.round(parsed.timeEstimate / 60)}h`);
    } else {
      parts.push(`⏱️ ${parsed.timeEstimate}m`);
    }
  }

  return parts;
}
