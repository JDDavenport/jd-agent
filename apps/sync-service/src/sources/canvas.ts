import { config } from '../config.js';
import type {
  Task, Content, Course, Module, Grade, CalendarEvent,
  CanvasAssignment, CanvasModule, CanvasModuleItem,
  CanvasPage, CanvasFile, CanvasAnnouncement, CanvasSubmission,
  CanvasCalendarEvent
} from '../types.js';

const BASE_URL = config.canvas.baseUrl;
const TOKEN = config.canvas.token;

async function canvasApi<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
  const allResults: T[] = [];
  let url = `${BASE_URL}/api/v1${endpoint}`;
  
  const searchParams = new URLSearchParams({ per_page: '100', ...params });
  url = `${url}?${searchParams}`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Canvas API error ${response.status}: ${text}`);
    }

    const data = await response.json() as T[];
    allResults.push(...(Array.isArray(data) ? data : [data as T]));

    // Handle pagination via Link header
    const linkHeader = response.headers.get('Link');
    url = '';
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        url = nextMatch[1];
      }
    }
  }

  return allResults;
}

async function canvasApiSingle<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}/api/v1${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Canvas API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchCourses(): Promise<Course[]> {
  return config.canvas.courses.map(c => ({
    id: c.id,
    canvasId: c.id,
    name: c.name,
    code: c.code,
    term: 'Winter 2026',
  }));
}

export async function fetchAssignments(courseId: string): Promise<CanvasAssignment[]> {
  try {
    return await canvasApi<CanvasAssignment>(`/courses/${courseId}/assignments`);
  } catch (e) {
    console.error(`Error fetching assignments for course ${courseId}:`, e);
    return [];
  }
}

export async function fetchModules(courseId: string): Promise<CanvasModule[]> {
  try {
    return await canvasApi<CanvasModule>(`/courses/${courseId}/modules`);
  } catch (e) {
    console.error(`Error fetching modules for course ${courseId}:`, e);
    return [];
  }
}

export async function fetchModuleItems(courseId: string, moduleId: number): Promise<CanvasModuleItem[]> {
  try {
    return await canvasApi<CanvasModuleItem>(`/courses/${courseId}/modules/${moduleId}/items`);
  } catch (e) {
    console.error(`Error fetching module items for ${courseId}/${moduleId}:`, e);
    return [];
  }
}

export async function fetchPages(courseId: string): Promise<CanvasPage[]> {
  try {
    const pages = await canvasApi<CanvasPage>(`/courses/${courseId}/pages`);
    // Fetch full body for each page
    const fullPages = await Promise.all(
      pages.map(async (p) => {
        try {
          return await canvasApiSingle<CanvasPage>(`/courses/${courseId}/pages/${p.url}`);
        } catch {
          return p;
        }
      })
    );
    return fullPages;
  } catch {
    // Pages often disabled per-course, that's expected
    return [];
  }
}

export async function fetchFiles(courseId: string): Promise<CanvasFile[]> {
  try {
    return await canvasApi<CanvasFile>(`/courses/${courseId}/files`);
  } catch {
    // Files access often restricted per-course
    return [];
  }
}

export async function fetchAnnouncements(courseId: string): Promise<CanvasAnnouncement[]> {
  try {
    return await canvasApi<CanvasAnnouncement>(`/courses/${courseId}/discussion_topics`, {
      only_announcements: 'true'
    });
  } catch (e) {
    console.error(`Error fetching announcements for course ${courseId}:`, e);
    return [];
  }
}

export async function fetchGrades(courseId: string): Promise<CanvasSubmission[]> {
  try {
    const submissions = await canvasApi<CanvasSubmission>(
      `/courses/${courseId}/students/submissions`,
      { student_ids: 'all', include: 'assignment' }
    );
    return submissions;
  } catch (e) {
    // Often fails due to permissions, that's ok
    return [];
  }
}

export async function fetchCalendarEvents(courseId: string): Promise<CanvasCalendarEvent[]> {
  try {
    const contextCode = `course_${courseId}`;
    return await canvasApi<CanvasCalendarEvent>(`/calendar_events`, {
      context_codes: contextCode,
      start_date: '2026-01-01',
      end_date: '2026-05-01',
    });
  } catch {
    // Calendar API sometimes fails
    return [];
  }
}

export async function fetchAllCanvasData(): Promise<{
  courses: Course[];
  tasks: Task[];
  content: Content[];
  modules: Module[];
  grades: Grade[];
  calendarEvents: CalendarEvent[];
}> {
  const courses = await fetchCourses();
  const tasks: Task[] = [];
  const content: Content[] = [];
  const modules: Module[] = [];
  const grades: Grade[] = [];
  const calendarEvents: CalendarEvent[] = [];

  for (const course of courses) {
    console.log(`  Fetching Canvas data for: ${course.name}`);

    // Assignments -> Tasks
    const assignments = await fetchAssignments(course.id);
    for (const a of assignments) {
      if (!a.published) continue;
      
      const submissionTypes = a.submission_types || [];
      let type: Task['type'] = 'assignment';
      if (submissionTypes.includes('online_quiz')) type = 'quiz';
      if (submissionTypes.includes('discussion_topic')) type = 'discussion';

      tasks.push({
        id: `canvas-task-${a.id}`,
        courseId: course.id,
        title: a.name,
        type,
        dueDate: a.due_at,
        description: a.description || '',
        status: a.has_submitted_submissions ? 'submitted' : 'pending',
        points: a.points_possible,
        url: a.html_url,
        sourceType: 'canvas',
        rawId: String(a.id),
      });
    }

    // Modules
    const courseModules = await fetchModules(course.id);
    for (const m of courseModules) {
      const items = await fetchModuleItems(course.id, m.id);
      const moduleItems = items.map(item => ({
        id: `canvas-moditem-${item.id}`,
        moduleId: `canvas-module-${m.id}`,
        title: item.title,
        type: item.type as any,
        contentId: item.content_id ? String(item.content_id) : null,
        position: item.position,
        url: item.html_url || item.external_url || null,
      }));

      modules.push({
        id: `canvas-module-${m.id}`,
        courseId: course.id,
        name: m.name,
        position: m.position,
        items: moduleItems,
      });

      // Extract content from module items
      for (const item of items) {
        if (['File', 'Page', 'ExternalUrl'].includes(item.type)) {
          content.push({
            id: `canvas-content-${item.id}`,
            courseId: course.id,
            title: item.title,
            type: item.type === 'File' ? 'file' : item.type === 'Page' ? 'page' : 'link',
            url: item.html_url || item.external_url || null,
            sourceType: 'canvas',
            rawId: String(item.content_id || item.id),
            moduleId: `canvas-module-${m.id}`,
            moduleName: m.name,
          });
        }
      }
    }

    // Pages -> Content
    const pages = await fetchPages(course.id);
    for (const p of pages) {
      // Don't duplicate if already in module items
      const exists = content.some(c => c.rawId === String(p.page_id) && c.type === 'page');
      if (!exists) {
        content.push({
          id: `canvas-page-${p.page_id}`,
          courseId: course.id,
          title: p.title,
          type: 'page',
          url: p.html_url,
          sourceType: 'canvas',
          rawId: String(p.page_id),
        });
      }
    }

    // Files -> Content
    const files = await fetchFiles(course.id);
    for (const f of files) {
      const exists = content.some(c => c.rawId === String(f.id) && c.type === 'file');
      if (!exists) {
        let type: Content['type'] = 'file';
        if (f.content_type?.includes('pdf')) type = 'pdf';
        if (f.content_type?.includes('presentation') || f.filename?.includes('.ppt')) type = 'slides';
        if (f.content_type?.includes('video')) type = 'video';

        content.push({
          id: `canvas-file-${f.id}`,
          courseId: course.id,
          title: f.display_name,
          type,
          url: f.url,
          sourceType: 'canvas',
          rawId: String(f.id),
        });
      }
    }

    // Announcements -> Tasks (as type announcement)
    const announcements = await fetchAnnouncements(course.id);
    for (const ann of announcements) {
      tasks.push({
        id: `canvas-announce-${ann.id}`,
        courseId: course.id,
        title: ann.title,
        type: 'announcement',
        dueDate: null,
        description: ann.message || '',
        status: 'none',
        points: null,
        url: ann.html_url,
        sourceType: 'canvas',
        rawId: String(ann.id),
      });
    }

    // Grades
    const submissions = await fetchGrades(course.id);
    for (const s of submissions) {
      if (s.assignment_id) {
        grades.push({
          courseId: course.id,
          assignmentId: String(s.assignment_id),
          score: s.score,
          possiblePoints: 0, // Would need to join with assignment
          grade: s.grade,
          submittedAt: s.submitted_at,
          gradedAt: s.graded_at,
        });
      }
    }

    // Calendar Events
    const events = await fetchCalendarEvents(course.id);
    for (const e of events) {
      calendarEvents.push({
        id: `canvas-event-${e.id}`,
        courseId: course.id,
        title: e.title,
        description: e.description || '',
        startAt: e.start_at,
        endAt: e.end_at,
        type: e.assignment ? 'assignment' : 'event',
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  return { courses, tasks, content, modules, grades, calendarEvents };
}
