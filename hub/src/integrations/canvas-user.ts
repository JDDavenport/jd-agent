/**
 * Per-User Canvas Integration
 * 
 * A Canvas API client that uses user-specific tokens
 * instead of global environment variables.
 */

export interface CanvasUserCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
  workflow_state: 'unpublished' | 'available' | 'completed' | 'deleted';
}

export interface CanvasUserAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number;
  course_id: number;
  html_url: string;
  submission_types: string[];
  published: boolean;
}

export class UserCanvasClient {
  private baseUrl: string;
  private token: string;
  private termFilter: string | null;

  constructor(baseUrl: string, token: string, termFilter?: string | null) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.termFilter = termFilter || null;
  }

  /**
   * Make an authenticated request to Canvas API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canvas API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetch all pages of a paginated endpoint
   */
  private async requestAll<T>(endpoint: string): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const data = await this.request<T[]>(`${endpoint}${separator}per_page=${perPage}&page=${page}`);
      
      if (!data || data.length === 0) break;
      
      results.push(...data);
      
      if (data.length < perPage) break;
      page++;
    }

    return results;
  }

  /**
   * Get user's Canvas profile
   */
  async getProfile(): Promise<{ id: number; name: string; email?: string }> {
    return this.request('/users/self');
  }

  /**
   * Get all enrolled courses
   */
  async getCourses(): Promise<CanvasUserCourse[]> {
    const courses = await this.requestAll<CanvasUserCourse>(
      '/courses?include[]=term&state[]=available&state[]=unpublished'
    );

    // Filter by term if specified
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

  /**
   * Get current/active courses (smart filtering)
   */
  async getCurrentCourses(): Promise<CanvasUserCourse[]> {
    const allCourses = await this.getCourses();
    const now = new Date();

    return allCourses.filter(course => {
      if (!course.name) return false;
      if (course.workflow_state === 'deleted') return false;

      // Check if course is current
      const courseStart = course.start_at ? new Date(course.start_at) : null;
      const courseEnd = course.end_at ? new Date(course.end_at) : null;

      // Active if: hasn't ended, or no end date, or just started/starting soon
      const isNotEnded = !courseEnd || courseEnd > now;
      const isStartedOrUpcoming = !courseStart || 
        (courseStart.getTime() - now.getTime()) < 60 * 24 * 60 * 60 * 1000; // Within 60 days

      return isNotEnded && isStartedOrUpcoming;
    });
  }

  /**
   * Get assignments for a course
   */
  async getAssignments(courseId: number): Promise<CanvasUserAssignment[]> {
    try {
      return await this.requestAll<CanvasUserAssignment>(
        `/courses/${courseId}/assignments?order_by=due_at`
      );
    } catch {
      // Course might be unpublished
      return [];
    }
  }

  /**
   * Get upcoming assignments across all courses
   */
  async getUpcomingAssignments(): Promise<Array<CanvasUserAssignment & { courseName: string }>> {
    const courses = await this.getCurrentCourses();
    const now = new Date();
    const assignments: Array<CanvasUserAssignment & { courseName: string }> = [];

    for (const course of courses) {
      if (course.workflow_state !== 'available') continue;

      try {
        const courseAssignments = await this.getAssignments(course.id);

        for (const assignment of courseAssignments) {
          if (!assignment.published) continue;
          
          if (assignment.due_at) {
            const dueDate = new Date(assignment.due_at);
            if (dueDate > now) {
              assignments.push({
                ...assignment,
                courseName: course.name,
              });
            }
          }
        }
      } catch (error) {
        console.error(`[Canvas] Failed to fetch assignments for ${course.name}:`, error);
      }
    }

    // Sort by due date
    assignments.sort((a, b) => {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    return assignments;
  }

  /**
   * Get modules for a course
   */
  async getModules(courseId: number): Promise<Array<{
    id: number;
    name: string;
    position: number;
    items_count: number;
    published: boolean;
  }>> {
    try {
      return await this.requestAll(`/courses/${courseId}/modules`);
    } catch {
      return [];
    }
  }

  /**
   * Get module items
   */
  async getModuleItems(courseId: number, moduleId: number): Promise<Array<{
    id: number;
    title: string;
    type: string;
    html_url: string;
    content_id?: number;
    page_url?: string;
    published: boolean;
  }>> {
    try {
      return await this.requestAll(`/courses/${courseId}/modules/${moduleId}/items`);
    } catch {
      return [];
    }
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
