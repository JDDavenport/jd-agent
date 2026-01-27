import { BrowserManager, getBrowserManager, closeBrowserManager } from './browser-manager';
import { PageNavigator, createPageNavigator, CanvasPage, Course } from './explorer/page-navigator';
import { ContentExtractor, createContentExtractor, CanvasAssignment, CanvasModuleItem, CanvasPageContent, CanvasFile, CanvasReading } from './explorer/content-extractor';
import { canvasIntegrityService, AuditType, DiscoveryMethod, CanvasItemType } from '../../services/canvas-integrity-service';
import { taskService } from '../../services/task-service';
import { projectService } from '../../services/project-service';
import { notificationService } from '../../services/notification-service';

// ============================================
// Types
// ============================================

export interface IntegrityReport {
  auditId: string;
  auditType: AuditType;
  startedAt: Date;
  completedAt: Date;
  status: 'completed' | 'failed';

  // Summary
  coursesAudited: number;
  pagesVisited: number;
  screenshotsCaptured: number;

  // Findings
  itemsDiscovered: number;
  tasksVerified: number;
  tasksCreated: number;
  tasksUpdated: number;
  discrepanciesFound: number;

  // Score
  integrityScore: number;

  // Details
  findings: {
    newItems: string[];
    updatedItems: string[];
    mismatches: string[];
    errors: string[];
  };
}

export interface AgentStatus {
  isInitialized: boolean;
  isRunning: boolean;
  lastAuditAt: Date | null;
  lastAuditStatus: string | null;
  integrityScore: number | null;
  unscheduledCount: number;
  activeCourses: number;
}

// ============================================
// Canvas Integrity Agent
// ============================================

export class CanvasIntegrityAgent {
  private browserManager: BrowserManager;
  private pageNavigator: PageNavigator | null = null;
  private contentExtractor: ContentExtractor | null = null;
  private isRunning = false;

  constructor() {
    this.browserManager = getBrowserManager();
  }

  // ----------------------------------------
  // Initialization
  // ----------------------------------------

  async initialize(): Promise<void> {
    if (this.pageNavigator) {
      console.log('[CanvasIntegrityAgent] Already initialized');
      return;
    }

    console.log('[CanvasIntegrityAgent] Initializing...');

    await this.browserManager.initialize();

    // Try to restore session
    const sessionRestored = await this.browserManager.restoreSession();
    if (sessionRestored) {
      const isValid = await this.browserManager.isSessionValid();
      if (!isValid) {
        console.log('[CanvasIntegrityAgent] Session invalid, need to re-login');
        await this.browserManager.login();
      }
    } else {
      console.log('[CanvasIntegrityAgent] No session, need to login');
      await this.browserManager.login();
    }

    this.pageNavigator = createPageNavigator(this.browserManager);
    this.contentExtractor = createContentExtractor(this.browserManager);

    console.log('[CanvasIntegrityAgent] Initialized');
  }

  async close(): Promise<void> {
    await closeBrowserManager();
    this.pageNavigator = null;
    this.contentExtractor = null;
    console.log('[CanvasIntegrityAgent] Closed');
  }

  // ----------------------------------------
  // Audits
  // ----------------------------------------

  async runFullAudit(): Promise<IntegrityReport> {
    // Try browser-based audit, fall back to API-only
    try {
      return await this.runAudit('full');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Executable') || errorMessage.includes('playwright') || errorMessage.includes('browser')) {
        console.log('[CanvasIntegrityAgent] Browser not available, falling back to API-only audit');
        return this.runApiOnlyAudit();
      }
      throw error;
    }
  }

  async runIncrementalAudit(): Promise<IntegrityReport> {
    // Try browser-based audit, fall back to API-only
    try {
      return await this.runAudit('incremental');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Executable') || errorMessage.includes('playwright') || errorMessage.includes('browser')) {
        console.log('[CanvasIntegrityAgent] Browser not available, falling back to API-only audit');
        return this.runApiOnlyAudit();
      }
      throw error;
    }
  }

  async runQuickCheck(): Promise<IntegrityReport> {
    // Use API-only quick check (no browser needed)
    return this.runApiOnlyAudit();
  }

  /**
   * API-only audit - fetches Canvas data via REST API without browser
   * Filters to current term only and creates nested project structure
   */
  private async runApiOnlyAudit(): Promise<IntegrityReport> {
    if (this.isRunning) {
      throw new Error('Audit already in progress');
    }

    this.isRunning = true;
    const startedAt = new Date();

    // Use try-finally to ensure isRunning is always reset
    try {
      // Create audit record
      const audit = await canvasIntegrityService.createAudit({
        auditType: 'quick_check',
        startedAt,
      });

      const findings: IntegrityReport['findings'] = {
        newItems: [],
        updatedItems: [],
        mismatches: [],
        errors: [],
      };

      let coursesAudited = 0;
      let itemsDiscovered = 0;
      let tasksVerified = 0;
      let tasksCreated = 0;
      let tasksUpdated = 0;
      let discrepanciesFound = 0;

      const apiToken = process.env.CANVAS_TOKEN;
      const baseUrl = process.env.CANVAS_BASE_URL;

      if (!apiToken || !baseUrl) {
        await canvasIntegrityService.updateAudit(audit.id, {
          completedAt: new Date(),
          status: 'failed',
          errors: { message: 'Missing CANVAS_TOKEN or CANVAS_BASE_URL' },
        });
        throw new Error('Missing CANVAS_TOKEN or CANVAS_BASE_URL environment variables');
      }

      try {
      // Fetch courses with term info
      const coursesResponse = await fetch(
        `${baseUrl}/api/v1/courses?enrollment_state=active&include[]=term&per_page=50`,
        { headers: { 'Authorization': `Bearer ${apiToken}` } }
      );

      if (!coursesResponse.ok) {
        throw new Error(`API error fetching courses: ${coursesResponse.status}`);
      }

      const allCourses = await coursesResponse.json() as Array<{
        id: number;
        name: string;
        course_code?: string;
        enrollment_term_id: number;
        term?: { id: number; name: string; start_at?: string; end_at?: string };
      }>;

      // Filter to current term only (term that contains today's date)
      const now = new Date();
      const currentTermCourses = allCourses.filter(course => {
        if (!course.term) return false;
        const termStart = course.term.start_at ? new Date(course.term.start_at) : null;
        const termEnd = course.term.end_at ? new Date(course.term.end_at) : null;

        // Include if current date is within term dates
        if (termStart && termEnd) {
          return now >= termStart && now <= termEnd;
        }
        return false;
      });

      // Skip non-academic courses (like "MBA Student Resources")
      const academicCourses = currentTermCourses.filter(course =>
        !course.name.toLowerCase().includes('resources') &&
        !course.name.toLowerCase().includes('student')
      );

      console.log(`[CanvasIntegrityAgent] Found ${allCourses.length} total courses, ${academicCourses.length} current term academic courses`);

      if (academicCourses.length === 0) {
        console.log('[CanvasIntegrityAgent] No current term courses found');
        await canvasIntegrityService.updateAudit(audit.id, {
          completedAt: new Date(),
          status: 'completed',
          coursesAudited: 0,
          itemsDiscovered: 0,
          integrityScore: 100,
          findings: { ...findings, errors: ['No current term courses found'] },
        });
        this.isRunning = false;
        return {
          auditId: audit.id,
          auditType: 'quick_check',
          startedAt,
          completedAt: new Date(),
          status: 'completed',
          coursesAudited: 0,
          pagesVisited: 0,
          screenshotsCaptured: 0,
          itemsDiscovered: 0,
          tasksVerified: 0,
          tasksCreated: 0,
          tasksUpdated: 0,
          discrepanciesFound: 0,
          integrityScore: 100,
          findings,
        };
      }

      // Get current term name for parent project
      const currentTermName = academicCourses[0].term?.name || 'Current Semester';

      // Create or get semester parent project (e.g., "MBA Winter 2026")
      const semesterProject = await this.ensureSemesterProject(currentTermName);
      console.log(`[CanvasIntegrityAgent] Semester project: ${semesterProject.name} (${semesterProject.id})`);

      for (const course of academicCourses) {
        console.log(`[CanvasIntegrityAgent] Auditing: ${course.name}`);
        coursesAudited++;

        try {
          // Create or get class project as child of semester project
          const classProject = await this.ensureClassProject(course, semesterProject.id);

          // Ensure mapping exists
          let mapping = await canvasIntegrityService.getMappingByCourseId(String(course.id));
          if (!mapping) {
            mapping = await canvasIntegrityService.createProjectMapping({
              canvasCourseId: String(course.id),
              canvasCourseName: course.name,
              canvasCourseCode: course.course_code,
              projectId: classProject.id,
              semester: currentTermName,
            });
          }

          // Fetch assignments via API
          const assignmentsResponse = await fetch(
            `${baseUrl}/api/v1/courses/${course.id}/assignments?per_page=100`,
            { headers: { 'Authorization': `Bearer ${apiToken}` } }
          );

          if (!assignmentsResponse.ok) {
            findings.errors.push(`Failed to fetch assignments for ${course.name}: ${assignmentsResponse.status}`);
            continue;
          }

          const assignments = await assignmentsResponse.json() as Array<{
            id: number;
            name: string;
            description?: string;
            html_url?: string;
            due_at?: string;
            points_possible?: number;
            submission_types?: string[];
            is_quiz_assignment?: boolean;
          }>;

          itemsDiscovered += assignments.length;

          for (const assignment of assignments) {
            const result = await this.verifyAndSyncApiItem(
              assignment,
              course,
              classProject.id
            );

            if (result.created) {
              tasksCreated++;
              findings.newItems.push(`${course.name}: ${assignment.name}`);
            } else if (result.updated) {
              tasksUpdated++;
              findings.updatedItems.push(`${course.name}: ${assignment.name}`);
            }

            if (result.verified) {
              tasksVerified++;
            }

            if (result.mismatch) {
              discrepanciesFound++;
              findings.mismatches.push(`${course.name}: ${assignment.name} - ${result.mismatchReason}`);
            }
          }
        } catch (courseError) {
          findings.errors.push(`Error auditing ${course.name}: ${String(courseError)}`);
        }
      }

      // Calculate integrity score
      const integrityScore = this.calculateIntegrityScore(
        tasksVerified,
        itemsDiscovered,
        discrepanciesFound
      );

      const completedAt = new Date();
      await canvasIntegrityService.updateAudit(audit.id, {
        completedAt,
        status: 'completed',
        coursesAudited,
        pagesVisited: 0,
        screenshotsCaptured: 0,
        itemsDiscovered,
        tasksVerified,
        tasksCreated,
        tasksUpdated,
        discrepanciesFound,
        integrityScore,
        findings,
      });

      return {
        auditId: audit.id,
        auditType: 'quick_check',
        startedAt,
        completedAt,
        status: 'completed',
        coursesAudited,
        pagesVisited: 0,
        screenshotsCaptured: 0,
        itemsDiscovered,
        tasksVerified,
        tasksCreated,
        tasksUpdated,
        discrepanciesFound,
        integrityScore,
        findings,
      };
      } catch (error) {
        await canvasIntegrityService.updateAudit(audit.id, {
          completedAt: new Date(),
          status: 'failed',
          errors: { message: String(error) },
        });
        throw error;
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async verifyAndSyncApiItem(
    assignment: {
      id: number;
      name: string;
      description?: string;
      html_url?: string;
      due_at?: string;
      points_possible?: number;
      is_quiz_assignment?: boolean;
      // Canvas Complete Phase 1: Enhanced fields
      submission_types?: string[];
      allowed_extensions?: string[];
      grading_type?: string;
      rubric?: Array<{
        id: string;
        description: string;
        long_description?: string;
        points: number;
        ratings: Array<{ id: string; description: string; points: number }>;
      }>;
      group_category_id?: number | null;
      peer_reviews?: boolean;
      lock_info?: Record<string, unknown>;
    },
    course: { id: number; name: string; course_code?: string },
    projectId?: string
  ): Promise<{
    verified: boolean;
    created: boolean;
    updated: boolean;
    mismatch: boolean;
    mismatchReason?: string;
  }> {
    const result = {
      verified: false,
      created: false,
      updated: false,
      mismatch: false,
      mismatchReason: undefined as string | undefined,
    };

    const canvasId = `assignment_${assignment.id}`;
    const dueAt = assignment.due_at ? new Date(assignment.due_at) : undefined;
    const canvasType: CanvasItemType = assignment.is_quiz_assignment ? 'quiz' : 'assignment';

    // Extract enhanced details for Canvas Complete
    const enhancedDetails = this.extractEnhancedDetails(assignment);

    // Check if canvas item exists
    let canvasItem = await canvasIntegrityService.getItemByCanvasId(canvasId);

    if (!canvasItem) {
      // Create new canvas item with enhanced details
      canvasItem = await canvasIntegrityService.createItem({
        canvasId,
        canvasType,
        courseName: course.name,
        title: assignment.name,
        description: assignment.description,
        url: assignment.html_url,
        dueAt,
        pointsPossible: assignment.points_possible,
        submissionTypes: assignment.submission_types,
        discoveredVia: 'api',
        // Canvas Complete Phase 1: Enhanced fields
        instructions: enhancedDetails.instructions ?? undefined,
        instructionsHtml: assignment.description ?? undefined,
        rubric: enhancedDetails.rubric ?? undefined,
        allowedExtensions: assignment.allowed_extensions ?? undefined,
        wordCountMin: enhancedDetails.wordCountMin ?? undefined,
        wordCountMax: enhancedDetails.wordCountMax ?? undefined,
        isGroupAssignment: !!assignment.group_category_id,
        hasPeerReview: assignment.peer_reviews ?? false,
        estimatedMinutes: enhancedDetails.estimatedMinutes,
        lockInfo: assignment.lock_info,
        gradingType: assignment.grading_type,
      });

      // Create task for this item
      const sourceRef = `canvas:${canvasType}:${canvasId}`;
      const existingTasks = await taskService.list({ sourceRef });

      if (!existingTasks || existingTasks.length === 0) {
        // Calculate scheduled date based on due date
        const scheduledDates = this.calculateScheduledDate(dueAt);

        // Build description with Canvas link and assignment details
        const descriptionParts: string[] = [];
        if (assignment.html_url) {
          descriptionParts.push(`**Canvas Link:** ${assignment.html_url}`);
        }
        if (assignment.description) {
          // Strip HTML tags for plain text description
          const plainDescription = assignment.description
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
          if (plainDescription) {
            descriptionParts.push(`\n${plainDescription}`);
          }
        }
        if (assignment.points_possible) {
          descriptionParts.push(`\n**Points:** ${assignment.points_possible}`);
        }

        // Include rubric summary in description if available
        if (enhancedDetails.rubric && enhancedDetails.rubric.length > 0) {
          descriptionParts.push('\n**Rubric Criteria:**');
          for (const criterion of enhancedDetails.rubric) {
            const criterionData = criterion as { criterion: string; points: number };
            descriptionParts.push(`- ${criterionData.criterion} (${criterionData.points} pts)`);
          }
        }

        if (enhancedDetails.estimatedMinutes) {
          const hours = Math.floor(enhancedDetails.estimatedMinutes / 60);
          const mins = enhancedDetails.estimatedMinutes % 60;
          const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          descriptionParts.push(`\n**Estimated Time:** ${timeStr}`);
        }

        const task = await taskService.create({
          title: assignment.name,
          description: descriptionParts.length > 0 ? descriptionParts.join('\n') : undefined,
          dueDate: dueAt,
          dueDateIsHard: true,
          scheduledStart: scheduledDates?.scheduledStart,
          scheduledEnd: scheduledDates?.scheduledEnd,
          source: 'canvas',
          sourceRef,
          context: course.name,
          projectId,
          status: 'inbox',
          priority: this.calculateApiPriority(assignment),
          timeEstimateMinutes: enhancedDetails.estimatedMinutes,
        });

        // Link task to canvas item
        await canvasIntegrityService.updateItem(canvasItem.id, {
          taskId: task.id,
          projectId,
          syncStatus: 'synced',
        });

        // Create schedule tracking with scheduled info
        await canvasIntegrityService.createScheduleTracking(
          canvasItem.id,
          task.id,
          scheduledDates?.scheduledStart,
          scheduledDates?.scheduledEnd
        );

        result.created = true;
      }
    } else {
      // Verify existing item
      result.verified = true;

      // Check for due date mismatch
      const existingDue = canvasItem.dueAt?.getTime();
      const newDue = dueAt?.getTime();

      if (existingDue !== newDue) {
        result.mismatch = true;
        result.mismatchReason = `Due date: Canvas=${dueAt?.toISOString()} vs Local=${canvasItem.dueAt?.toISOString()}`;

        await canvasIntegrityService.updateItem(canvasItem.id, {
          dueAt,
          syncStatus: 'synced',
        });

        if (canvasItem.taskId) {
          await taskService.update(canvasItem.taskId, {
            dueDate: dueAt,
          });
        }

        result.updated = true;
      }

      // Mark as verified via API
      await canvasIntegrityService.markItemVerified(canvasItem.id, 'api');
    }

    return result;
  }

  private calculateApiPriority(assignment: { name: string; points_possible?: number }): number {
    const title = assignment.name.toLowerCase();
    if (title.includes('final') || title.includes('midterm') || title.includes('exam')) {
      return 4;
    }
    if (assignment.points_possible) {
      if (assignment.points_possible >= 100) return 3;
      if (assignment.points_possible >= 50) return 2;
    }
    return 2;
  }

  /**
   * Extract enhanced assignment details for Canvas Complete Phase 1
   */
  private extractEnhancedDetails(assignment: {
    description?: string;
    points_possible?: number;
    submission_types?: string[];
    group_category_id?: number | null;
    peer_reviews?: boolean;
    rubric?: Array<{
      id: string;
      description: string;
      long_description?: string;
      points: number;
      ratings: Array<{ id: string; description: string; points: number }>;
    }>;
  }): {
    instructions: string | null;
    rubric: Record<string, unknown>[] | null;
    wordCountMin: number | null;
    wordCountMax: number | null;
    estimatedMinutes: number;
  } {
    // Strip HTML from description for instructions
    const instructions = assignment.description
      ? assignment.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim()
      : null;

    // Format rubric for storage
    const rubric = assignment.rubric
      ? assignment.rubric.map((criterion) => ({
          id: criterion.id,
          criterion: criterion.description,
          description: criterion.long_description || null,
          points: criterion.points,
          ratings: criterion.ratings.map((r) => ({
            description: r.description,
            points: r.points,
          })),
        }))
      : null;

    // Parse word count from instructions
    const wordCount = this.parseWordCount(instructions || '');

    // Estimate time to complete
    const estimatedMinutes = this.estimateAssignmentTime(
      assignment.points_possible,
      wordCount.max,
      assignment.submission_types,
      !!assignment.group_category_id,
      assignment.peer_reviews ?? false
    );

    return {
      instructions,
      rubric,
      wordCountMin: wordCount.min,
      wordCountMax: wordCount.max,
      estimatedMinutes,
    };
  }

  /**
   * Parse word count requirements from instructions
   */
  private parseWordCount(text: string): { min: number | null; max: number | null } {
    const result = { min: null as number | null, max: null as number | null };

    // Match patterns like "1500-2000 words" or "1500 to 2000 words"
    const rangeMatch = text.match(/(\d{3,5})\s*[-–to]+\s*(\d{3,5})\s*words?/i);
    if (rangeMatch) {
      result.min = parseInt(rangeMatch[1]);
      result.max = parseInt(rangeMatch[2]);
      return result;
    }

    // Match "minimum X words" or "at least X words"
    const minMatch = text.match(/(?:minimum|at least|min\.?)\s*(\d{3,5})\s*words?/i);
    if (minMatch) {
      result.min = parseInt(minMatch[1]);
      return result;
    }

    // Match simple "X words"
    const simpleMatch = text.match(/(\d{3,5})\s*words?/i);
    if (simpleMatch) {
      result.min = parseInt(simpleMatch[1]);
      result.max = parseInt(simpleMatch[1]);
      return result;
    }

    // Match page count and convert to word count (250 words per page)
    const pageMatch = text.match(/(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s*pages?/i);
    if (pageMatch) {
      result.min = parseInt(pageMatch[1]) * 250;
      result.max = parseInt(pageMatch[2]) * 250;
      return result;
    }

    return result;
  }

  /**
   * Estimate time to complete assignment in minutes
   */
  private estimateAssignmentTime(
    pointsPossible: number | undefined,
    wordCountMax: number | null,
    submissionTypes: string[] | undefined,
    isGroupAssignment: boolean,
    hasPeerReview: boolean
  ): number {
    let minutes = 30; // Base minimum

    // Factor in points (higher points = more complex)
    if (pointsPossible) {
      if (pointsPossible >= 100) minutes += 120; // Major assignment
      else if (pointsPossible >= 50) minutes += 60;
      else if (pointsPossible >= 25) minutes += 30;
    }

    // Factor in word count
    if (wordCountMax) {
      minutes += Math.floor(wordCountMax / 500) * 30;
    }

    // Factor in submission type
    if (submissionTypes?.includes('online_upload')) {
      minutes += 15;
    }
    if (submissionTypes?.includes('discussion_topic')) {
      minutes = Math.min(minutes, 45);
    }

    // Factor in group work
    if (isGroupAssignment) {
      minutes += 30;
    }

    // Factor in peer review
    if (hasPeerReview) {
      minutes += 30;
    }

    return Math.min(minutes, 480); // Max 8 hours
  }

  private async runAudit(auditType: AuditType): Promise<IntegrityReport> {
    if (this.isRunning) {
      throw new Error('Audit already in progress');
    }

    this.isRunning = true;
    const startedAt = new Date();

    // Use try-finally to ensure isRunning is always reset
    try {
      // Create audit record
      const audit = await canvasIntegrityService.createAudit({
        auditType,
        startedAt,
      });

      const findings: IntegrityReport['findings'] = {
        newItems: [],
        updatedItems: [],
        mismatches: [],
        errors: [],
      };

      let coursesAudited = 0;
      let pagesVisited = 0;
      let screenshotsCaptured = 0;
      let itemsDiscovered = 0;
      let tasksVerified = 0;
      let tasksCreated = 0;
      let tasksUpdated = 0;
      let discrepanciesFound = 0;

      try {
      await this.initialize();

      if (!this.pageNavigator || !this.contentExtractor) {
        throw new Error('Agent not properly initialized');
      }

      // Get enrolled courses
      const courses = await this.pageNavigator.getEnrolledCourses();
      console.log(`[CanvasIntegrityAgent] Found ${courses.length} courses`);

      for (const course of courses) {
        console.log(`[CanvasIntegrityAgent] Auditing course: ${course.name}`);
        coursesAudited++;

        try {
          // Ensure project mapping exists
          let mapping = await canvasIntegrityService.getMappingByCourseId(course.id);
          if (!mapping) {
            // Create project if needed
            const project = await this.ensureProjectForCourse(course);
            if (project) {
              mapping = await canvasIntegrityService.createProjectMapping({
                canvasCourseId: course.id,
                canvasCourseName: course.name,
                canvasCourseCode: course.code,
                projectId: project.id,
              });
            }
          }

          // Explore course pages based on audit type
          const pagesToVisit = this.getPagesToVisit(auditType);

          for (const pageType of pagesToVisit) {
            const navResult = await this.pageNavigator.navigateToCoursePage(course.id, pageType);
            if (!navResult.success) {
              findings.errors.push(`Failed to navigate to ${pageType} for ${course.name}: ${navResult.error}`);
              continue;
            }
            pagesVisited++;

            // Extract content based on page type
            const items = await this.extractContentFromPage(pageType);
            itemsDiscovered += items.length;

            // Verify each item
            for (const item of items) {
              const result = await this.verifyAndSyncItem(item, course, mapping?.projectId);

              // Get title - CanvasFile uses displayName instead of title
              const itemTitle = 'title' in item ? item.title : 'displayName' in item ? item.displayName : 'Unknown';

              if (result.created) {
                tasksCreated++;
                findings.newItems.push(`${course.name}: ${itemTitle}`);
              } else if (result.updated) {
                tasksUpdated++;
                findings.updatedItems.push(`${course.name}: ${itemTitle}`);
              }

              if (result.verified) {
                tasksVerified++;
              }

              if (result.mismatch) {
                discrepanciesFound++;
                findings.mismatches.push(`${course.name}: ${itemTitle} - ${result.mismatchReason}`);
              }
            }

            // Take screenshot for full audit
            if (auditType === 'full') {
              await this.browserManager.takeScreenshot(`${course.code || course.id}_${pageType}`);
              screenshotsCaptured++;
            }
          }
        } catch (courseError) {
          findings.errors.push(`Error auditing ${course.name}: ${String(courseError)}`);
        }
      }

      // Calculate integrity score
      const integrityScore = this.calculateIntegrityScore(
        tasksVerified,
        itemsDiscovered,
        discrepanciesFound
      );

      // Update audit record
      const completedAt = new Date();
      await canvasIntegrityService.updateAudit(audit.id, {
        completedAt,
        status: 'completed',
        coursesAudited,
        pagesVisited,
        screenshotsCaptured,
        itemsDiscovered,
        tasksVerified,
        tasksCreated,
        tasksUpdated,
        discrepanciesFound,
        integrityScore,
        findings,
      });

      return {
        auditId: audit.id,
        auditType,
        startedAt,
        completedAt,
        status: 'completed',
        coursesAudited,
        pagesVisited,
        screenshotsCaptured,
        itemsDiscovered,
        tasksVerified,
        tasksCreated,
        tasksUpdated,
        discrepanciesFound,
        integrityScore,
        findings,
      };
      } catch (error) {
        // Update audit as failed
        await canvasIntegrityService.updateAudit(audit.id, {
          completedAt: new Date(),
          status: 'failed',
          errors: { message: String(error) },
        });
        throw error;
      }
    } finally {
      this.isRunning = false;
    }
  }

  private getPagesToVisit(auditType: AuditType): CanvasPage[] {
    switch (auditType) {
      case 'full':
        return [
          CanvasPage.HOME,
          CanvasPage.SYLLABUS,
          CanvasPage.MODULES,
          CanvasPage.ASSIGNMENTS,
          CanvasPage.DISCUSSIONS,
          CanvasPage.ANNOUNCEMENTS,
          CanvasPage.QUIZZES,
          CanvasPage.PAGES,
          CanvasPage.FILES,
        ];
      case 'incremental':
        return [CanvasPage.ASSIGNMENTS, CanvasPage.ANNOUNCEMENTS];
      case 'quick_check':
        return [CanvasPage.ASSIGNMENTS];
      default:
        return [CanvasPage.ASSIGNMENTS];
    }
  }

  private async extractContentFromPage(pageType: CanvasPage): Promise<Array<CanvasAssignment | CanvasModuleItem | CanvasPageContent | CanvasFile | CanvasReading>> {
    if (!this.contentExtractor) {
      return [];
    }

    switch (pageType) {
      case CanvasPage.ASSIGNMENTS:
        return this.contentExtractor.extractAssignments();
      case CanvasPage.MODULES:
        // For modules, also extract readings
        const moduleItems = await this.contentExtractor.extractModuleItems();
        const readings = await this.contentExtractor.extractReadings();
        console.log(`[CanvasIntegrityAgent] Extracted ${readings.length} readings from modules`);
        return [...moduleItems, ...readings];
      case CanvasPage.DISCUSSIONS:
        return this.contentExtractor.extractDiscussions();
      case CanvasPage.QUIZZES:
        return this.contentExtractor.extractQuizzes();
      case CanvasPage.PAGES:
        const pages = await this.contentExtractor.extractPages();
        console.log(`[CanvasIntegrityAgent] Extracted ${pages.length} wiki pages`);
        return pages;
      case CanvasPage.FILES:
        const files = await this.contentExtractor.extractFiles();
        console.log(`[CanvasIntegrityAgent] Extracted ${files.length} files`);
        return files;
      default:
        return [];
    }
  }

  private async verifyAndSyncItem(
    item: CanvasAssignment | CanvasModuleItem | CanvasPageContent | CanvasFile | CanvasReading,
    course: Course,
    projectId?: string
  ): Promise<{
    verified: boolean;
    created: boolean;
    updated: boolean;
    mismatch: boolean;
    mismatchReason?: string;
  }> {
    const result = {
      verified: false,
      created: false,
      updated: false,
      mismatch: false,
      mismatchReason: undefined as string | undefined,
    };

    // Determine canvas type and discovery method
    let canvasType: CanvasItemType = 'assignment';
    let discoveredVia: DiscoveryMethod = 'browser_assignments';
    let itemTitle = '';
    let itemUrl: string | undefined;
    let itemDescription: string | undefined;
    let itemDueAt: Date | undefined;
    let itemPoints: number | undefined;

    // Handle different item types
    if ('isQuiz' in item && item.isQuiz) {
      canvasType = 'quiz';
      itemTitle = item.title;
      itemUrl = item.url;
      itemDueAt = item.dueAt;
      itemPoints = item.pointsPossible;
    } else if ('isDiscussion' in item && item.isDiscussion) {
      canvasType = 'discussion';
      itemTitle = item.title;
      itemUrl = item.url;
      itemDueAt = item.dueAt;
      itemPoints = item.pointsPossible;
    } else if ('itemType' in item && 'moduleName' in item) {
      // CanvasModuleItem
      canvasType = item.itemType as CanvasItemType;
      discoveredVia = 'browser_modules';
      itemTitle = item.title;
      itemUrl = item.url;
      itemDueAt = item.dueAt;
    } else if ('type' in item && 'moduleName' in item && 'isRequired' in item) {
      // CanvasReading
      canvasType = item.type === 'external_url' ? 'external_url' : item.type === 'file' ? 'file' : 'page';
      discoveredVia = 'browser_modules';
      itemTitle = item.title;
      itemUrl = item.url;
      itemDescription = `Reading from ${item.moduleName}${item.isRequired ? ' (Required)' : ''}`;
    } else if ('htmlContent' in item) {
      // CanvasPageContent
      canvasType = 'page';
      discoveredVia = 'browser_pages' as DiscoveryMethod;
      itemTitle = item.title;
      itemUrl = item.url;
      itemDescription = item.content?.substring(0, 500);
    } else if ('fileName' in item && 'contentType' in item) {
      // CanvasFile
      canvasType = 'file';
      discoveredVia = 'browser_files' as DiscoveryMethod;
      itemTitle = item.displayName || item.fileName;
      itemUrl = item.url;
      itemDescription = `File: ${item.contentType}${item.size ? ` (${Math.round(item.size / 1024)}KB)` : ''}`;
    } else if ('isQuiz' in item || 'isDiscussion' in item || 'url' in item) {
      // CanvasAssignment
      canvasType = 'assignment';
      itemTitle = item.title;
      itemUrl = (item as CanvasAssignment).url;
      itemDueAt = item.dueAt;
      itemPoints = (item as CanvasAssignment).pointsPossible;
      itemDescription = (item as CanvasAssignment).description;
    }

    // Check if canvas item exists
    let canvasItem = await canvasIntegrityService.getItemByCanvasId(item.canvasId);

    if (!canvasItem) {
      // Create new canvas item
      canvasItem = await canvasIntegrityService.createItem({
        canvasId: item.canvasId,
        canvasType,
        courseName: course.name,
        title: itemTitle,
        description: itemDescription,
        url: itemUrl,
        dueAt: itemDueAt,
        pointsPossible: itemPoints,
        discoveredVia,
      });

      // Only create tasks for actionable items (assignments, quizzes, discussions, ALL readings)
      // Phase 0: Changed to include ALL readings (file, page, external_url), not just required ones
      const isActionable = ['assignment', 'quiz', 'discussion'].includes(canvasType) ||
        ['file', 'page', 'external_url'].includes(canvasType);

      if (isActionable) {
        // Create task for this item
        const sourceRef = `canvas:${canvasType}:${item.canvasId}`;
        const existingTasks = await taskService.list({ sourceRef });

        if (!existingTasks || existingTasks.length === 0) {
          // Build description with Canvas link and details
          const descriptionParts: string[] = [];
          if (itemUrl) {
            descriptionParts.push(`**Canvas Link:** ${itemUrl}`);
          }
          if (itemDescription) {
            const plainDesc = itemDescription
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .trim();
            if (plainDesc) {
              descriptionParts.push(`\n${plainDesc}`);
            }
          }
          if (itemPoints) {
            descriptionParts.push(`\n**Points:** ${itemPoints}`);
          }

          // Add reading prefix for reading items (Phase 0)
          const taskTitle = ['file', 'page', 'external_url'].includes(canvasType)
            ? `📖 Read: ${itemTitle}`
            : itemTitle;

          const task = await taskService.create({
            title: taskTitle,
            description: descriptionParts.length > 0 ? descriptionParts.join('\n') : undefined,
            dueDate: itemDueAt,
            dueDateIsHard: !!itemDueAt,
            source: 'canvas',
            sourceRef,
            context: course.name,
            projectId,
            status: 'inbox',
            priority: this.calculatePriority(item),
          });

          // Link task to canvas item
          await canvasIntegrityService.updateItem(canvasItem.id, {
            taskId: task.id,
            projectId,
            syncStatus: 'synced',
          });

          // Create schedule tracking
          await canvasIntegrityService.createScheduleTracking(canvasItem.id, task.id);

          result.created = true;
        }
      }
    } else {
      // Verify existing item
      result.verified = true;

      // Check for due date mismatch
      if (canvasItem.dueAt?.getTime() !== itemDueAt?.getTime()) {
        result.mismatch = true;
        result.mismatchReason = `Due date mismatch: Canvas=${itemDueAt?.toISOString()} vs Local=${canvasItem.dueAt?.toISOString()}`;

        // Update canvas item and task
        await canvasIntegrityService.updateItem(canvasItem.id, {
          dueAt: itemDueAt,
          syncStatus: 'synced',
        });

        if (canvasItem.taskId) {
          await taskService.update(canvasItem.taskId, {
            dueDate: itemDueAt,
          });
        }

        result.updated = true;
      }

      // Mark as verified
      await canvasIntegrityService.markItemVerified(canvasItem.id, 'browser');
    }

    return result;
  }

  private calculatePriority(item: CanvasAssignment | CanvasModuleItem | CanvasPageContent | CanvasFile | CanvasReading): number {
    // Check for high-stakes assignments
    const title = ('title' in item ? item.title : '').toLowerCase();
    if (title.includes('final') || title.includes('midterm') || title.includes('exam')) {
      return 4; // Urgent
    }

    if ('pointsPossible' in item && item.pointsPossible) {
      if (item.pointsPossible >= 100) return 3; // High
      if (item.pointsPossible >= 50) return 2; // Medium
    }

    // Required readings get higher priority
    if ('isRequired' in item && item.isRequired) {
      return 2; // Medium
    }

    return 2; // Default medium priority
  }

  private calculateIntegrityScore(
    verified: number,
    discovered: number,
    discrepancies: number
  ): number {
    if (discovered === 0) return 100;

    const verifiedPercentage = (verified / discovered) * 100;
    const discrepancyPenalty = Math.min(discrepancies * 2, 20);

    return Math.max(0, Math.round(verifiedPercentage - discrepancyPenalty));
  }

  private async ensureProjectForCourse(course: Course) {
    // Check if project already exists
    const existingProjects = await projectService.list({
      context: course.name,
    });

    if (existingProjects.length > 0) {
      return existingProjects[0];
    }

    // Create new project
    return projectService.create({
      name: course.name,
      context: course.name,
      area: 'School',
    });
  }

  /**
   * Create or get semester parent project (e.g., "MBA Winter 2026")
   */
  private async ensureSemesterProject(termName: string): Promise<{ id: string; name: string }> {
    // Format: "2026 Winter" -> "MBA Winter 2026"
    const semesterName = termName.includes('MBA') ? termName : `MBA ${termName}`;

    const existingProjects = await projectService.list({
      name: semesterName,
    });

    if (existingProjects.length > 0) {
      return existingProjects[0];
    }

    // Create semester parent project
    return projectService.create({
      name: semesterName,
      context: 'School',
      area: 'School',
    });
  }

  /**
   * Create or get class project as child of semester project
   */
  private async ensureClassProject(
    course: { id: number; name: string; course_code?: string },
    parentProjectId: string
  ): Promise<{ id: string; name: string }> {
    // Check if project already exists
    const existingProjects = await projectService.list({
      name: course.name,
    });

    // Find one that has this parent
    const existingChild = existingProjects.find(p => p.parentProjectId === parentProjectId);
    if (existingChild) {
      return existingChild;
    }

    // Create class project as child of semester
    return projectService.create({
      name: course.name,
      context: course.name,
      area: 'School',
      parentProjectId,
    });
  }

  /**
   * Calculate suggested scheduled date based on due date
   * Schedules work 2-3 days before due date, or tomorrow if due date is soon
   */
  private calculateScheduledDate(dueDate: Date | undefined): { scheduledStart: Date; scheduledEnd: Date } | null {
    if (!dueDate) return null;

    const now = new Date();
    const dueTime = dueDate.getTime();
    const nowTime = now.getTime();

    // Days until due
    const daysUntil = Math.ceil((dueTime - nowTime) / (1000 * 60 * 60 * 24));

    let scheduledStart: Date;

    if (daysUntil <= 1) {
      // Due today or tomorrow - schedule for now
      scheduledStart = new Date(now);
      scheduledStart.setHours(9, 0, 0, 0); // 9 AM today
    } else if (daysUntil <= 3) {
      // Due in 2-3 days - schedule for tomorrow
      scheduledStart = new Date(now);
      scheduledStart.setDate(scheduledStart.getDate() + 1);
      scheduledStart.setHours(9, 0, 0, 0);
    } else {
      // Due later - schedule 2-3 days before
      scheduledStart = new Date(dueDate);
      scheduledStart.setDate(scheduledStart.getDate() - 3);
      scheduledStart.setHours(9, 0, 0, 0);
    }

    // Default 2 hour block
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setHours(scheduledEnd.getHours() + 2);

    return { scheduledStart, scheduledEnd };
  }

  // ----------------------------------------
  // Scheduling & Nudging
  // ----------------------------------------

  async sendScheduleNudge(): Promise<boolean> {
    const unscheduled = await canvasIntegrityService.getUnscheduledItems();

    if (unscheduled.length === 0) {
      console.log('[CanvasIntegrityAgent] No unscheduled tasks - no nudge needed');
      return false;
    }

    // Format nudge message
    const urgentItems = unscheduled.filter(
      (item) => item.daysUntilDue !== null && item.daysUntilDue <= 2
    );
    const normalItems = unscheduled.filter(
      (item) => item.daysUntilDue === null || item.daysUntilDue > 2
    );

    let message = '📚 **Canvas Tasks Need Scheduling**\n\n';
    message += `You have ${unscheduled.length} unscheduled assignment(s):\n\n`;

    let itemNum = 1;

    // List urgent items first
    for (const item of urgentItems) {
      const emoji = item.daysUntilDue === 1 ? '🚨' : '⚠️';
      const dueText = item.daysUntilDue === 1 ? 'Due tomorrow' : `Due in ${item.daysUntilDue} days`;
      message += `${itemNum}. ${emoji} **${item.courseName}: ${item.title}** - ${dueText}\n`;
      itemNum++;
    }

    // List normal items
    for (const item of normalItems) {
      const dueText = item.daysUntilDue ? `Due in ${item.daysUntilDue} days` : 'No due date';
      message += `${itemNum}. **${item.courseName}: ${item.title}** - ${dueText}\n`;
      itemNum++;
    }

    message += '\nReply with task number to schedule, or "snooze" to remind tomorrow.';

    // Send via Telegram
    try {
      await notificationService.sendTelegram(message);

      // Record nudge sent for each item
      for (const item of unscheduled) {
        await canvasIntegrityService.recordNudgeSent(item.canvasItemId);
      }

      console.log(`[CanvasIntegrityAgent] Sent nudge for ${unscheduled.length} tasks`);
      return true;
    } catch (error) {
      console.error('[CanvasIntegrityAgent] Failed to send nudge:', error);
      return false;
    }
  }

  // ----------------------------------------
  // Status
  // ----------------------------------------

  async getStatus(): Promise<AgentStatus> {
    const integrityStatus = await canvasIntegrityService.getIntegrityStatus();

    return {
      isInitialized: this.pageNavigator !== null,
      isRunning: this.isRunning,
      lastAuditAt: integrityStatus.lastAuditAt,
      lastAuditStatus: integrityStatus.lastAuditStatus,
      integrityScore: integrityStatus.integrityScore,
      unscheduledCount: integrityStatus.unscheduledCount,
      activeCourses: integrityStatus.activeCourses,
    };
  }
}

// ============================================
// Singleton
// ============================================

let agentInstance: CanvasIntegrityAgent | null = null;

export function getCanvasIntegrityAgent(): CanvasIntegrityAgent {
  if (!agentInstance) {
    agentInstance = new CanvasIntegrityAgent();
  }
  return agentInstance;
}

export async function closeCanvasIntegrityAgent(): Promise<void> {
  if (agentInstance) {
    await agentInstance.close();
    agentInstance = null;
  }
}
