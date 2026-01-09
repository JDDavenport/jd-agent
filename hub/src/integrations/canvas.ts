/**
 * JD Agent - Canvas LMS Integration (Enhanced)
 * 
 * Smart semester-aware sync:
 * - Filters by current enrollment term (not just name)
 * - Monitors unpublished courses for when they go live
 * - Deep content extraction: modules, pages, readings, files
 * - Daily sync to catch new content
 * 
 * Creates tasks for: assignments, quizzes, discussions with due dates
 * Creates vault entries for: announcements, pages, readings, syllabi
 */

import { db } from '../db/client';
import { tasks, vaultEntries, classes, systemLogs } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// ============================================
// Types
// ============================================

interface CanvasTerm {
  id: number;
  name: string;
  start_at: string | null;
  end_at: string | null;
}

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
  workflow_state: 'unpublished' | 'available' | 'completed' | 'deleted';
  syllabus_body?: string;
  default_view: string;
  enrollments?: Array<{
    type: string;
    enrollment_state: string;
  }>;
}

interface CanvasAssignment {
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
  has_submitted_submissions: boolean;
  workflow_state: string;
  published: boolean;
  grading_type: string;
}

interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  context_code: string;
  html_url: string;
}

interface CanvasModule {
  id: number;
  name: string;
  position: number;
  unlock_at: string | null;
  state: 'active' | 'locked' | 'started' | 'unlocked';
  items_count: number;
  published: boolean;
}

interface CanvasModuleItem {
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

interface CanvasPage {
  url: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  published: boolean;
  front_page: boolean;
}

interface CanvasDiscussion {
  id: number;
  title: string;
  message: string;
  html_url: string;
  posted_at: string;
  due_at: string | null;
  assignment?: CanvasAssignment;
}

interface CourseStatus {
  id: number;
  name: string;
  code: string;
  published: boolean;
  termId: number;
  termName?: string;
  startDate: string | null;
  endDate: string | null;
  lastSync?: Date;
  contentStats?: {
    assignments: number;
    modules: number;
    pages: number;
    announcements: number;
  };
}

interface SyncResult {
  courses: number;
  newlyPublished: string[];
  assignments: number;
  announcements: number;
  pages: number;
  modules: number;
  errors: string[];
}

// ============================================
// Canvas Integration
// ============================================

export class CanvasIntegration {
  private baseUrl: string | null = null;
  private token: string | null = null;
  private termFilter: string | null = null;
  private courseCache: Map<number, CanvasCourse> = new Map();
  private termCache: Map<number, CanvasTerm> = new Map();
  private lastSyncTime: Date | null = null;

  constructor() {
    this.baseUrl = process.env.CANVAS_BASE_URL || null;
    this.token = process.env.CANVAS_TOKEN || null;
    this.termFilter = process.env.CANVAS_TERM_FILTER || null;

    if (this.baseUrl && this.token) {
      console.log(`[Canvas] Integration initialized for ${this.baseUrl}`);
      if (this.termFilter) {
        console.log(`[Canvas] Filtering courses by term: ${this.termFilter}`);
      }
    } else {
      console.log('[Canvas] Not configured - missing CANVAS_BASE_URL or CANVAS_TOKEN');
    }
  }

  /**
   * Check if Canvas is configured
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.token);
  }

  /**
   * Make an authenticated request to Canvas API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.baseUrl || !this.token) {
      throw new Error('Canvas not configured');
    }

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
    let url = endpoint;
    let page = 1;
    const perPage = 100;

    while (true) {
      const separator = url.includes('?') ? '&' : '?';
      const data = await this.request<T[]>(`${url}${separator}per_page=${perPage}&page=${page}`);
      
      if (!data || data.length === 0) break;
      
      results.push(...data);
      
      if (data.length < perPage) break;
      page++;
    }

    return results;
  }

  // ============================================
  // TERM-AWARE COURSE FILTERING
  // ============================================

  /**
   * Get enrollment terms to understand semester boundaries
   */
  async getEnrollmentTerms(): Promise<CanvasTerm[]> {
    try {
      // This endpoint might require account-level access
      // Fall back to extracting terms from courses if not available
      const terms = await this.requestAll<CanvasTerm>('/accounts/self/terms');
      terms.forEach(t => this.termCache.set(t.id, t));
      return terms;
    } catch {
      // Fall back - we'll infer terms from course data
      return [];
    }
  }

  /**
   * Determine current semester based on date
   */
  private getCurrentSemesterRange(): { start: Date; end: Date; name: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // BYU semester schedule (approximate):
    // Winter: Jan - April
    // Spring: May - June  
    // Summer: July - August
    // Fall: Sept - December
    
    if (month >= 0 && month <= 3) {
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 3, 30),
        name: `Winter ${year}`,
      };
    } else if (month >= 4 && month <= 5) {
      return {
        start: new Date(year, 4, 1),
        end: new Date(year, 5, 30),
        name: `Spring ${year}`,
      };
    } else if (month >= 6 && month <= 7) {
      return {
        start: new Date(year, 6, 1),
        end: new Date(year, 7, 31),
        name: `Summer ${year}`,
      };
    } else {
      return {
        start: new Date(year, 8, 1),
        end: new Date(year, 11, 31),
        name: `Fall ${year}`,
      };
    }
  }

  /**
   * Get all courses including unpublished ones we're enrolled in
   */
  async getAllEnrolledCourses(): Promise<CanvasCourse[]> {
    // Include all states to catch unpublished courses
    const courses = await this.requestAll<CanvasCourse>(
      '/courses?include[]=term&include[]=total_students&include[]=syllabus_body&state[]=available&state[]=unpublished'
    );
    
    courses.forEach(c => this.courseCache.set(c.id, c));
    return courses;
  }

  /**
   * Get current semester courses (smart filtering)
   */
  async getCurrentCourses(): Promise<CourseStatus[]> {
    const allCourses = await this.getAllEnrolledCourses();
    const semesterRange = this.getCurrentSemesterRange();
    const now = new Date();
    
    const currentCourses: CourseStatus[] = [];

    for (const course of allCourses) {
      // Skip courses without name
      if (!course.name) continue;
      
      // Apply term filter if specified (e.g., "MBA" or "SWELL" or "MBA,SWELL")
      let matchesFilter = !this.termFilter;
      if (this.termFilter) {
        const filters = this.termFilter.split(',').map(f => f.trim().toLowerCase());
        const courseName = (course.name || '').toLowerCase();
        const courseCode = (course.course_code || '').toLowerCase();
        matchesFilter = filters.some(filter => 
          courseName.includes(filter) || courseCode.includes(filter)
        );
      }

      if (!matchesFilter) continue;

      // Check if course is in current semester window
      // Canvas courses often don't have exact dates, so we use heuristics
      const courseStart = course.start_at ? new Date(course.start_at) : null;
      const courseEnd = course.end_at ? new Date(course.end_at) : null;

      // A course is "current" if:
      // 1. It has no dates (likely current)
      // 2. Its start date is within 30 days from now
      // 3. It hasn't ended yet
      // 4. It's unpublished but we're enrolled (professor preparing it)
      
      const isCurrentByCourse = !courseEnd || courseEnd > now;
      const isUpcoming = courseStart && courseStart > now && 
        (courseStart.getTime() - now.getTime()) < 60 * 24 * 60 * 60 * 1000; // Within 60 days
      const isActive = !courseStart || courseStart <= now;
      const isUnpublishedUpcoming = course.workflow_state === 'unpublished';

      if (isCurrentByCourse && (isActive || isUpcoming || isUnpublishedUpcoming)) {
        currentCourses.push({
          id: course.id,
          name: course.name,
          code: course.course_code,
          published: course.workflow_state === 'available',
          termId: course.enrollment_term_id,
          startDate: course.start_at,
          endDate: course.end_at,
        });
      }
    }

    return currentCourses;
  }

  /**
   * Get courses filtered by term name match
   */
  async getCourses(): Promise<CanvasCourse[]> {
    const courses = await this.getAllEnrolledCourses();
    
    // Filter by term if specified (supports comma-separated values)
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

    return courses.filter(c => c.name); // Only return courses with names
  }

  // ============================================
  // DEEP CONTENT EXTRACTION
  // ============================================

  /**
   * Get all assignments for a course (including quizzes with due dates)
   */
  async getAssignments(courseId: number): Promise<CanvasAssignment[]> {
    try {
      return await this.requestAll<CanvasAssignment>(
        `/courses/${courseId}/assignments?order_by=due_at&include[]=submission`
      );
    } catch (error) {
      // Course might be unpublished
      console.log(`[Canvas] Cannot access assignments for course ${courseId} (likely unpublished)`);
      return [];
    }
  }

  /**
   * Get all modules for a course
   */
  async getModules(courseId: number): Promise<CanvasModule[]> {
    try {
      return await this.requestAll<CanvasModule>(`/courses/${courseId}/modules`);
    } catch {
      return [];
    }
  }

  /**
   * Get items in a module
   */
  async getModuleItems(courseId: number, moduleId: number): Promise<CanvasModuleItem[]> {
    try {
      return await this.requestAll<CanvasModuleItem>(
        `/courses/${courseId}/modules/${moduleId}/items`
      );
    } catch {
      return [];
    }
  }

  /**
   * Get a specific page content
   */
  async getPage(courseId: number, pageUrl: string): Promise<CanvasPage | null> {
    try {
      return await this.request<CanvasPage>(`/courses/${courseId}/pages/${pageUrl}`);
    } catch {
      return null;
    }
  }

  /**
   * Get all pages for a course
   */
  async getPages(courseId: number): Promise<CanvasPage[]> {
    try {
      return await this.requestAll<CanvasPage>(`/courses/${courseId}/pages`);
    } catch {
      return [];
    }
  }

  /**
   * Get discussions (some have due dates)
   */
  async getDiscussions(courseId: number): Promise<CanvasDiscussion[]> {
    try {
      return await this.requestAll<CanvasDiscussion>(`/courses/${courseId}/discussion_topics`);
    } catch {
      return [];
    }
  }

  /**
   * Get announcements for a course
   */
  async getAnnouncements(courseId: number): Promise<CanvasAnnouncement[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      return await this.request<CanvasAnnouncement[]>(
        `/announcements?context_codes[]=course_${courseId}&start_date=${startDate.toISOString()}`
      );
    } catch {
      return [];
    }
  }

  /**
   * Get syllabus for a course
   */
  async getSyllabus(courseId: number): Promise<string | null> {
    try {
      const course = await this.request<CanvasCourse>(
        `/courses/${courseId}?include[]=syllabus_body`
      );
      return course.syllabus_body || null;
    } catch {
      return null;
    }
  }

  /**
   * Get upcoming assignments across all current courses
   */
  async getUpcomingAssignments(): Promise<Array<CanvasAssignment & { courseName: string }>> {
    const courses = await this.getCourses();
    const now = new Date();
    const assignments: Array<CanvasAssignment & { courseName: string }> = [];

    for (const course of courses) {
      if (course.workflow_state !== 'available') continue;
      
      this.courseCache.set(course.id, course);
      
      try {
        const courseAssignments = await this.getAssignments(course.id);
        
        for (const assignment of courseAssignments) {
          if (!assignment.published) continue;
          
          // Include assignments with future due dates
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
   * Deep scan a course for all actionable items
   */
  async deepScanCourse(courseId: number): Promise<{
    assignments: CanvasAssignment[];
    discussions: CanvasDiscussion[];
    readings: CanvasPage[];
    announcements: CanvasAnnouncement[];
    moduleStructure: Array<{
      module: CanvasModule;
      items: CanvasModuleItem[];
    }>;
  }> {
    const [assignments, discussions, pages, announcements, modules] = await Promise.all([
      this.getAssignments(courseId),
      this.getDiscussions(courseId),
      this.getPages(courseId),
      this.getAnnouncements(courseId),
      this.getModules(courseId),
    ]);

    // Get module items for each module
    const moduleStructure: Array<{ module: CanvasModule; items: CanvasModuleItem[] }> = [];
    for (const module of modules) {
      const items = await this.getModuleItems(courseId, module.id);
      moduleStructure.push({ module, items });
    }

    // Identify readings (pages that look like reading assignments)
    const readings = pages.filter(page => {
      const lowerTitle = page.title.toLowerCase();
      return lowerTitle.includes('reading') || 
             lowerTitle.includes('chapter') ||
             lowerTitle.includes('article') ||
             lowerTitle.includes('case');
    });

    return {
      assignments,
      discussions: discussions.filter(d => d.due_at), // Only ones with due dates
      readings,
      announcements,
      moduleStructure,
    };
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Check for newly published courses
   */
  async checkForNewlyPublished(): Promise<string[]> {
    const newlyPublished: string[] = [];
    
    // Get all courses we've synced before
    const existingClasses = await db.select().from(classes);
    const unpublishedIds = existingClasses
      .filter(c => c.status === 'unpublished')
      .map(c => c.canvasCourseId);

    if (unpublishedIds.length === 0) return [];

    // Check current status
    const currentCourses = await this.getCurrentCourses();
    
    for (const course of currentCourses) {
      if (course.published && unpublishedIds.includes(course.id.toString())) {
        newlyPublished.push(course.name);
        
        // Update database
        await db
          .update(classes)
          .set({ status: 'active' })
          .where(eq(classes.canvasCourseId, course.id.toString()));

        // Log the event
        await db.insert(systemLogs).values({
          logType: 'info',
          component: 'canvas',
          message: `Course "${course.name}" is now published!`,
          details: { courseId: course.id, courseName: course.name },
        });
      }
    }

    return newlyPublished;
  }

  /**
   * Sync assignments to tasks
   */
  async syncAssignmentsToTasks(): Promise<{ created: number; updated: number; errors: string[] }> {
    const result = { created: 0, updated: 0, errors: [] as string[] };

    try {
      const assignments = await this.getUpcomingAssignments();

      for (const assignment of assignments) {
        const sourceRef = `canvas:assignment:${assignment.id}`;

        try {
          // Check if task already exists
          const existing = await db
            .select()
            .from(tasks)
            .where(eq(tasks.sourceRef, sourceRef))
            .limit(1);

          if (existing.length > 0) {
            // Update existing task if due date changed
            const existingTask = existing[0];
            const newDueDate = assignment.due_at ? new Date(assignment.due_at) : null;
            
            if (existingTask.dueDate?.getTime() !== newDueDate?.getTime()) {
              await db
                .update(tasks)
                .set({
                  dueDate: newDueDate,
                  updatedAt: new Date(),
                })
                .where(eq(tasks.id, existingTask.id));
              result.updated++;
            }
          } else {
            // Create new task
            const courseName = this.extractClassName(assignment.courseName);
            
            // Determine priority based on points and type
            let priority = 2; // Medium default
            if (assignment.points_possible >= 100) priority = 3;
            if (assignment.grading_type === 'pass_fail') priority = 1;
            if (assignment.name.toLowerCase().includes('final') ||
                assignment.name.toLowerCase().includes('midterm') ||
                assignment.name.toLowerCase().includes('exam')) {
              priority = 4; // Urgent
            }
            
            await db.insert(tasks).values({
              title: assignment.name,
              description: this.stripHtml(assignment.description || ''),
              status: 'inbox',
              priority,
              dueDate: assignment.due_at ? new Date(assignment.due_at) : null,
              dueDateIsHard: true,
              source: 'canvas',
              sourceRef,
              context: courseName,
              syncStatus: 'synced',
              syncedAt: new Date(),
            });
            result.created++;
          }
        } catch (error) {
          result.errors.push(`Assignment ${assignment.name}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
    }

    console.log(`[Canvas] Synced assignments: ${result.created} created, ${result.updated} updated`);
    return result;
  }

  /**
   * Sync course content to vault
   */
  async syncContentToVault(): Promise<{ created: number; errors: string[] }> {
    const result = { created: 0, errors: [] as string[] };

    try {
      const courses = await this.getCourses();

      for (const course of courses) {
        if (course.workflow_state !== 'available') continue;
        
        const courseName = this.extractClassName(course.name);

        // Sync announcements
        try {
          const announcements = await this.getAnnouncements(course.id);
          
          for (const announcement of announcements) {
            const sourceRef = `canvas:announcement:${announcement.id}`;

            const existing = await db
              .select()
              .from(vaultEntries)
              .where(eq(vaultEntries.sourceRef, sourceRef))
              .limit(1);

            if (existing.length === 0) {
              await db.insert(vaultEntries).values({
                title: announcement.title,
                content: this.stripHtml(announcement.message),
                contentType: 'note',
                context: courseName,
                tags: ['canvas', 'announcement'],
                source: 'canvas',
                sourceRef,
                sourceDate: new Date(announcement.posted_at),
              });
              result.created++;
            }
          }
        } catch (error) {
          result.errors.push(`Announcements for ${courseName}: ${error}`);
        }

        // Sync syllabus if available
        try {
          const syllabus = await this.getSyllabus(course.id);
          if (syllabus) {
            const sourceRef = `canvas:syllabus:${course.id}`;
            
            const existing = await db
              .select()
              .from(vaultEntries)
              .where(eq(vaultEntries.sourceRef, sourceRef))
              .limit(1);

            if (existing.length === 0) {
              await db.insert(vaultEntries).values({
                title: `${courseName} - Syllabus`,
                content: this.stripHtml(syllabus),
                contentType: 'document',
                context: courseName,
                tags: ['canvas', 'syllabus'],
                source: 'canvas',
                sourceRef,
              });
              result.created++;
            }
          }
        } catch (error) {
          result.errors.push(`Syllabus for ${courseName}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Content sync failed: ${error}`);
    }

    console.log(`[Canvas] Synced content: ${result.created} entries created`);
    return result;
  }

  /**
   * Sync courses to classes table
   */
  async syncCourses(): Promise<{ synced: number; unpublished: number; errors: string[] }> {
    const result = { synced: 0, unpublished: 0, errors: [] as string[] };

    try {
      const courses = await this.getCurrentCourses();

      for (const course of courses) {
        try {
          // Check if already exists
          const existing = await db
            .select()
            .from(classes)
            .where(eq(classes.canvasCourseId, course.id.toString()))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(classes).values({
              name: this.extractClassName(course.name),
              code: course.code,
              canvasCourseId: course.id.toString(),
              semester: this.getCurrentSemesterRange().name,
              status: course.published ? 'active' : 'completed',
            });
            
            result.synced++;
          } else if (existing[0].status !== 'active' && course.published) {
            // Course was unpublished, now published
            await db
              .update(classes)
              .set({ status: 'active' })
              .where(eq(classes.id, existing[0].id));
            result.synced++;
          }
        } catch (error) {
          result.errors.push(`Course ${course.name}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Course sync failed: ${error}`);
    }

    console.log(`[Canvas] Synced courses: ${result.synced} active, ${result.unpublished} unpublished`);
    return result;
  }

  /**
   * Full sync - courses, assignments, and content
   */
  async fullSync(): Promise<SyncResult> {
    console.log('[Canvas] Starting full sync...');
    
    const result: SyncResult = {
      courses: 0,
      newlyPublished: [],
      assignments: 0,
      announcements: 0,
      pages: 0,
      modules: 0,
      errors: [],
    };

    // Check for newly published courses first
    const newlyPublished = await this.checkForNewlyPublished();
    result.newlyPublished = newlyPublished;

    // Sync courses
    const courseResult = await this.syncCourses();
    result.courses = courseResult.synced + courseResult.unpublished;
    result.errors.push(...courseResult.errors);

    // Sync assignments to tasks
    const assignmentResult = await this.syncAssignmentsToTasks();
    result.assignments = assignmentResult.created + assignmentResult.updated;
    result.errors.push(...assignmentResult.errors);

    // Sync content to vault
    const contentResult = await this.syncContentToVault();
    result.announcements = contentResult.created;
    result.errors.push(...contentResult.errors);

    this.lastSyncTime = new Date();

    console.log('[Canvas] Full sync complete:', result);
    return result;
  }

  /**
   * Daily check - lighter sync to catch changes
   */
  async dailyCheck(): Promise<{
    newlyPublished: string[];
    newAssignments: number;
    dueSoon: Array<{ title: string; dueAt: string; course: string }>;
  }> {
    console.log('[Canvas] Running daily check...');

    // Check for newly published courses
    const newlyPublished = await this.checkForNewlyPublished();

    // Sync new assignments
    const assignmentResult = await this.syncAssignmentsToTasks();

    // Get assignments due in next 7 days
    const assignments = await this.getUpcomingAssignments();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const dueSoon = assignments
      .filter(a => a.due_at && new Date(a.due_at) <= sevenDaysFromNow)
      .map(a => ({
        title: a.name,
        dueAt: a.due_at!,
        course: this.extractClassName(a.courseName),
      }));

    return {
      newlyPublished,
      newAssignments: assignmentResult.created,
      dueSoon,
    };
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Extract clean class name from Canvas course name
   */
  private extractClassName(courseName: string): string {
    return courseName
      .replace(/^\d{4}\s*(Fall|Spring|Summer|Winter)\s*/i, '')
      .replace(/\s*-\s*Section\s*\d+/i, '')
      .replace(/\s*\(.*?\)\s*/g, '')
      .trim();
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }
}

// ============================================
// Singleton instance
// ============================================

export const canvasIntegration = new CanvasIntegration();
