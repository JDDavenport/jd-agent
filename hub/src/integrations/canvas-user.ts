/**
 * Per-User Canvas Integration (Enhanced)
 * 
 * A Canvas API client that uses user-specific tokens.
 * Supports comprehensive extraction: courses, assignments, modules,
 * pages, files, discussions, quizzes, announcements, syllabus, tabs.
 * 
 * Handles Canvas pagination via Link headers properly.
 */

// ============================================
// Types
// ============================================

export interface CanvasUserCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
  workflow_state: 'unpublished' | 'available' | 'completed' | 'deleted';
  syllabus_body?: string;
  default_view?: string;
}

export interface CanvasUserAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number;
  course_id: number;
  html_url: string;
  submission_types: string[];
  published: boolean;
  grading_type: string;
  rubric?: Array<{
    id: string;
    description: string;
    long_description?: string;
    points: number;
    ratings: Array<{ id: string; description: string; points: number }>;
  }>;
  allowed_extensions?: string[];
  group_category_id?: number | null;
  peer_reviews?: boolean;
  has_submitted_submissions?: boolean;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  unlock_at: string | null;
  state: string;
  items_count: number;
  published: boolean;
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  type: 'File' | 'Page' | 'Discussion' | 'Assignment' | 'Quiz' | 'SubHeader' | 'ExternalUrl' | 'ExternalTool';
  html_url: string;
  content_id?: number;
  page_url?: string;
  external_url?: string;
  indent: number;
  published: boolean;
}

export interface CanvasPage {
  url: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  published: boolean;
  front_page: boolean;
}

export interface CanvasFile {
  id: number;
  uuid: string;
  folder_id: number;
  display_name: string;
  filename: string;
  content_type: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface CanvasDiscussion {
  id: number;
  title: string;
  message: string;
  html_url: string;
  posted_at: string;
  due_at: string | null;
  assignment?: CanvasUserAssignment;
  published: boolean;
}

export interface CanvasQuiz {
  id: number;
  title: string;
  html_url: string;
  description: string | null;
  quiz_type: string;
  due_at: string | null;
  lock_at: string | null;
  unlock_at: string | null;
  points_possible: number;
  question_count: number;
  time_limit: number | null;
  published: boolean;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  context_code: string;
  html_url: string;
}

export interface CanvasTab {
  id: string;
  label: string;
  type: string;
  position: number;
  visibility: string;
  html_url: string;
}

// ============================================
// Rate limiting
// ============================================

class RateLimiter {
  private remaining = 700;
  private resetAt = 0;

  update(headers: Headers) {
    const remaining = headers.get('x-rate-limit-remaining');
    if (remaining) this.remaining = parseInt(remaining);
    // Canvas doesn't always send reset header, but we track remaining
  }

  async throttle() {
    if (this.remaining < 50) {
      // Getting close to limit, slow down
      await new Promise(r => setTimeout(r, 1000));
    } else if (this.remaining < 100) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

// ============================================
// UserCanvasClient
// ============================================

export class UserCanvasClient {
  private baseUrl: string;
  private token: string;
  private termFilter: string | null;
  private rateLimiter = new RateLimiter();

  constructor(baseUrl: string, token: string, termFilter?: string | null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.termFilter = termFilter || null;
  }

  /**
   * Make an authenticated request to Canvas API.
   * Returns { data, response } to allow Link header parsing.
   */
  private async rawRequest<T>(url: string, options: RequestInit = {}): Promise<{ data: T; response: Response }> {
    await this.rateLimiter.throttle();

    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}/api/v1${url}`;
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    this.rateLimiter.update(response.headers);

    if (response.status === 403) {
      const text = await response.text();
      if (text.includes('Rate Limit') || text.includes('rate limit')) {
        // Rate limited — wait and retry once
        await new Promise(r => setTimeout(r, 2000));
        return this.rawRequest(url, options);
      }
      throw new Error(`Canvas API 403: ${text}`);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canvas API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as T;
    return { data, response };
  }

  /**
   * Simple request that returns just data
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { data } = await this.rawRequest<T>(endpoint, options);
    return data;
  }

  /**
   * Parse Link header for pagination
   */
  private parseLinkHeader(linkHeader: string | null): { next?: string } {
    if (!linkHeader) return {};
    const links: Record<string, string> = {};
    const parts = linkHeader.split(',');
    for (const part of parts) {
      const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match) {
        links[match[2]] = match[1];
      }
    }
    return links;
  }

  /**
   * Fetch all pages of a paginated endpoint using Link headers
   */
  private async requestAll<T>(endpoint: string): Promise<T[]> {
    const results: T[] = [];
    const separator = endpoint.includes('?') ? '&' : '?';
    let url = `${endpoint}${separator}per_page=100`;

    while (url) {
      const { data, response } = await this.rawRequest<T[]>(url);
      if (!data || !Array.isArray(data) || data.length === 0) break;
      results.push(...data);

      // Follow Link: <...>; rel="next" header
      const linkHeader = response.headers.get('link');
      const links = this.parseLinkHeader(linkHeader);
      url = links.next || '';
    }

    return results;
  }

  // ============================================
  // Profile
  // ============================================

  async getProfile(): Promise<{ id: number; name: string; email?: string; avatar_url?: string }> {
    return this.request('/users/self');
  }

  // ============================================
  // Courses
  // ============================================

  async getCourses(): Promise<CanvasUserCourse[]> {
    const courses = await this.requestAll<CanvasUserCourse>(
      '/courses?include[]=term&include[]=syllabus_body&state[]=available&state[]=unpublished'
    );

    if (this.termFilter) {
      const filters = this.termFilter.split(',').map(f => f.trim().toLowerCase());
      return courses.filter(course => {
        if (!course.name) return false;
        const courseName = course.name.toLowerCase();
        const courseCode = (course.course_code || '').toLowerCase();
        return filters.some(filter => 
          courseName.includes(filter) || courseCode.includes(filter)
        );
      });
    }

    return courses.filter(c => c.name);
  }

  async getCurrentCourses(): Promise<CanvasUserCourse[]> {
    const allCourses = await this.getCourses();
    const now = new Date();

    return allCourses.filter(course => {
      if (!course.name) return false;
      if (course.workflow_state === 'deleted') return false;

      const courseEnd = course.end_at ? new Date(course.end_at) : null;
      const courseStart = course.start_at ? new Date(course.start_at) : null;

      const isNotEnded = !courseEnd || courseEnd > now;
      const isStartedOrUpcoming = !courseStart || 
        (courseStart.getTime() - now.getTime()) < 60 * 24 * 60 * 60 * 1000;

      return isNotEnded && isStartedOrUpcoming;
    });
  }

  // ============================================
  // Assignments
  // ============================================

  async getAssignments(courseId: number): Promise<CanvasUserAssignment[]> {
    try {
      return await this.requestAll<CanvasUserAssignment>(
        `/courses/${courseId}/assignments?order_by=due_at&include[]=submission`
      );
    } catch {
      return [];
    }
  }

  async getUpcomingAssignments(): Promise<Array<CanvasUserAssignment & { courseName: string }>> {
    const courses = await this.getCurrentCourses();
    const now = new Date();
    const assignments: Array<CanvasUserAssignment & { courseName: string }> = [];

    for (const course of courses) {
      if (course.workflow_state !== 'available') continue;
      try {
        const courseAssignments = await this.getAssignments(course.id);
        for (const a of courseAssignments) {
          if (!a.published) continue;
          if (a.due_at && new Date(a.due_at) > now) {
            assignments.push({ ...a, courseName: course.name });
          }
        }
      } catch {}
    }

    assignments.sort((a, b) => {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    return assignments;
  }

  // ============================================
  // Modules
  // ============================================

  async getModules(courseId: number): Promise<CanvasModule[]> {
    try {
      return await this.requestAll<CanvasModule>(`/courses/${courseId}/modules`);
    } catch {
      return [];
    }
  }

  async getModuleItems(courseId: number, moduleId: number): Promise<CanvasModuleItem[]> {
    try {
      return await this.requestAll<CanvasModuleItem>(
        `/courses/${courseId}/modules/${moduleId}/items`
      );
    } catch {
      return [];
    }
  }

  // ============================================
  // Pages
  // ============================================

  async getPages(courseId: number): Promise<CanvasPage[]> {
    try {
      return await this.requestAll<CanvasPage>(`/courses/${courseId}/pages`);
    } catch {
      return [];
    }
  }

  async getPage(courseId: number, pageUrl: string): Promise<CanvasPage | null> {
    try {
      return await this.request<CanvasPage>(`/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`);
    } catch {
      return null;
    }
  }

  // ============================================
  // Files
  // ============================================

  async getFiles(courseId: number): Promise<CanvasFile[]> {
    try {
      return await this.requestAll<CanvasFile>(`/courses/${courseId}/files`);
    } catch {
      return [];
    }
  }

  // ============================================
  // Discussions
  // ============================================

  async getDiscussions(courseId: number): Promise<CanvasDiscussion[]> {
    try {
      return await this.requestAll<CanvasDiscussion>(`/courses/${courseId}/discussion_topics`);
    } catch {
      return [];
    }
  }

  // ============================================
  // Quizzes
  // ============================================

  async getQuizzes(courseId: number): Promise<CanvasQuiz[]> {
    try {
      return await this.requestAll<CanvasQuiz>(`/courses/${courseId}/quizzes`);
    } catch {
      return [];
    }
  }

  // ============================================
  // Announcements
  // ============================================

  async getAnnouncements(courseId: number): Promise<CanvasAnnouncement[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // Last 90 days
      return await this.request<CanvasAnnouncement[]>(
        `/announcements?context_codes[]=course_${courseId}&start_date=${startDate.toISOString()}&per_page=50`
      );
    } catch {
      return [];
    }
  }

  // ============================================
  // Syllabus
  // ============================================

  async getSyllabus(courseId: number): Promise<string | null> {
    try {
      const course = await this.request<CanvasUserCourse>(
        `/courses/${courseId}?include[]=syllabus_body`
      );
      return course.syllabus_body || null;
    } catch {
      return null;
    }
  }

  // ============================================
  // Tabs
  // ============================================

  async getTabs(courseId: number): Promise<CanvasTab[]> {
    try {
      return await this.request<CanvasTab[]>(`/courses/${courseId}/tabs`);
    } catch {
      return [];
    }
  }

  // ============================================
  // Deep Course Scan
  // ============================================

  /**
   * Comprehensive extraction of all course content.
   * Returns everything a student sees in Canvas for this course.
   */
  async deepScanCourse(courseId: number): Promise<{
    assignments: CanvasUserAssignment[];
    modules: Array<{ module: CanvasModule; items: CanvasModuleItem[] }>;
    pages: CanvasPage[];
    files: CanvasFile[];
    discussions: CanvasDiscussion[];
    quizzes: CanvasQuiz[];
    announcements: CanvasAnnouncement[];
    syllabus: string | null;
    tabs: CanvasTab[];
  }> {
    // Parallel fetch everything
    const [assignments, modules, pages, files, discussions, quizzes, announcements, syllabus, tabs] = await Promise.all([
      this.getAssignments(courseId),
      this.getModules(courseId),
      this.getPages(courseId),
      this.getFiles(courseId),
      this.getDiscussions(courseId),
      this.getQuizzes(courseId),
      this.getAnnouncements(courseId),
      this.getSyllabus(courseId),
      this.getTabs(courseId),
    ]);

    // Get module items for each module (sequential to avoid rate limits)
    const modulesWithItems: Array<{ module: CanvasModule; items: CanvasModuleItem[] }> = [];
    for (const mod of modules) {
      const items = await this.getModuleItems(courseId, mod.id);
      modulesWithItems.push({ module: mod, items });
    }

    return {
      assignments,
      modules: modulesWithItems,
      pages,
      files,
      discussions,
      quizzes,
      announcements,
      syllabus,
      tabs,
    };
  }
}

/**
 * Factory function to create a Canvas client for a user
 */
export function createUserCanvasClient(
  baseUrl: string | null,
  token: string | null,
  termFilter?: string | null
): UserCanvasClient | null {
  if (!baseUrl || !token) return null;
  return new UserCanvasClient(baseUrl, token, termFilter);
}
