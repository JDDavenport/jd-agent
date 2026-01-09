import { format, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, parse, isValid } from 'date-fns';

export interface ParsedTask {
  title: string;
  dueDate?: string;
  priority?: number;
  contexts?: string[];
  labels?: string[];
  timeEstimate?: number;
  rawInput: string;
}

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

  // Extract date keywords
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

export function formatParsedPreview(parsed: ParsedTask): string[] {
  const parts: string[] = [];

  if (parsed.dueDate) {
    const date = new Date(parsed.dueDate + 'T12:00:00');
    parts.push(`📅 ${format(date, 'MMM d')}`);
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
