import type { Task, Content, GoldStandard } from './types.js';

/**
 * Normalize data from all sources into unified schemas
 */

export function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map(task => ({
    ...task,
    // Ensure consistent string format for dates
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    // Clean up HTML from descriptions
    description: cleanHtml(task.description),
    // Ensure status is valid
    status: normalizeStatus(task.status),
  }));
}

export function normalizeContent(content: Content[]): Content[] {
  return content.map(c => ({
    ...c,
    // Normalize type
    type: normalizeContentType(c.type),
    // Clean title
    title: c.title.trim(),
  }));
}

function cleanHtml(html: string): string {
  if (!html) return '';
  // Basic HTML stripping
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStatus(status: string): Task['status'] {
  const normalized = status.toLowerCase();
  if (['pending', 'not_submitted', 'unsubmitted'].includes(normalized)) return 'pending';
  if (['submitted', 'complete', 'completed'].includes(normalized)) return 'submitted';
  if (['graded', 'scored'].includes(normalized)) return 'graded';
  if (['missing', 'late', 'overdue'].includes(normalized)) return 'missing';
  return 'none';
}

function normalizeContentType(type: string): Content['type'] {
  const t = type.toLowerCase();
  if (t.includes('pdf')) return 'pdf';
  if (t.includes('slide') || t.includes('ppt') || t.includes('presentation')) return 'slides';
  if (t.includes('video') || t.includes('mp4') || t.includes('mov')) return 'video';
  if (t.includes('recording') || t.includes('audio')) return 'recording';
  if (t.includes('note')) return 'note';
  if (t.includes('page')) return 'page';
  if (t.includes('link') || t.includes('url')) return 'link';
  return 'file';
}

export function mergeGoldStandard(
  existing: GoldStandard | null,
  newData: Partial<GoldStandard>
): GoldStandard {
  const now = new Date().toISOString();
  
  if (!existing) {
    return {
      generatedAt: now,
      courses: newData.courses || [],
      tasks: normalizeTasks(newData.tasks || []),
      content: normalizeContent(newData.content || []),
      modules: newData.modules || [],
      grades: newData.grades || [],
      calendarEvents: newData.calendarEvents || [],
      plaudRecordings: newData.plaudRecordings || [],
      remarkableNotes: newData.remarkableNotes || [],
    };
  }
  
  // Merge: new data wins for conflicts (by id)
  const mergeLists = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of existing) map.set(item.id, item);
    for (const item of incoming) map.set(item.id, item);
    return Array.from(map.values());
  };
  
  return {
    generatedAt: now,
    courses: mergeLists(existing.courses, newData.courses || []),
    tasks: normalizeTasks(mergeLists(existing.tasks, newData.tasks || [])),
    content: normalizeContent(mergeLists(existing.content, newData.content || [])),
    modules: mergeLists(existing.modules, newData.modules || []),
    grades: existing.grades.concat(newData.grades || []), // Grades don't have stable IDs
    calendarEvents: mergeLists(existing.calendarEvents, newData.calendarEvents || []),
    plaudRecordings: mergeLists(existing.plaudRecordings, newData.plaudRecordings || []),
    remarkableNotes: mergeLists(existing.remarkableNotes, newData.remarkableNotes || []),
  };
}

// Stats for logging
export function getGoldStandardStats(gs: GoldStandard): string {
  return [
    `Courses: ${gs.courses.length}`,
    `Tasks: ${gs.tasks.length}`,
    `Content: ${gs.content.length}`,
    `Modules: ${gs.modules.length}`,
    `Grades: ${gs.grades.length}`,
    `Calendar Events: ${gs.calendarEvents.length}`,
    `Plaud Recordings: ${gs.plaudRecordings.length}`,
    `Remarkable Notes: ${gs.remarkableNotes.length}`,
  ].join(' | ');
}
