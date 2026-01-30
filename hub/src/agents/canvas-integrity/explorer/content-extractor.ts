import type { Page } from 'playwright';
import { BrowserManager } from '../browser-manager';
import { CanvasPage } from './page-navigator';

// ============================================
// Types
// ============================================

export interface CanvasAssignment {
  canvasId: string;
  title: string;
  description?: string;
  dueAt?: Date;
  availableFrom?: Date;
  availableUntil?: Date;
  pointsPossible?: number;
  submissionTypes?: string[];
  url: string;
  isQuiz: boolean;
  isDiscussion: boolean;
  published: boolean;
}

export interface CanvasModuleItem {
  canvasId: string;
  title: string;
  itemType: 'assignment' | 'quiz' | 'discussion' | 'page' | 'file' | 'external_url' | 'subheader';
  url?: string;
  dueAt?: Date;
  moduleId: string;
  moduleName: string;
  position: number;
  completed?: boolean;
}

export interface CanvasAnnouncement {
  canvasId: string;
  title: string;
  content: string;
  postedAt: Date;
  author?: string;
  url: string;
}

export interface SyllabusData {
  courseDescription?: string;
  assignments: Array<{
    title: string;
    dueAt?: Date;
    pointsPossible?: number;
  }>;
  events: Array<{
    title: string;
    date: Date;
  }>;
}

export interface HomePageData {
  welcomeMessage?: string;
  announcementsCount: number;
  todoItems: string[];
  upcomingAssignments: Array<{
    title: string;
    dueAt?: string;
    courseName?: string;
  }>;
}

export interface CanvasPageContent {
  canvasId: string;
  title: string;
  content: string;
  htmlContent: string;
  url: string;
  published: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CanvasFile {
  canvasId: string;
  displayName: string;
  fileName: string;
  contentType: string;
  size?: number;
  url: string;
  downloadUrl?: string;
  folderId?: string;
  folderName?: string;
}

export interface CanvasReading {
  canvasId: string;
  title: string;
  type: 'external_url' | 'file' | 'page';
  url: string;
  description?: string;
  moduleName: string;
  modulePosition: number;
  isRequired: boolean;
}

// Canvas Complete: Enhanced assignment detail extraction
export interface AssignmentDetailExtraction {
  title: string;
  instructions: string | null;
  instructionsHtml: string | null;
  dueAt: Date | null;
  pointsPossible: number | null;
  submissionTypes: string[];
  allowedExtensions: string[];
  isGroupAssignment: boolean;
  hasPeerReview: boolean;
  rubric: Array<{
    id: string;
    criterion: string;
    description: string | null;
    points: number;
    ratings: Array<{ description: string; points: number }>;
  }> | null;
  lockInfo: { isLocked: boolean; message: string | null } | null;
  attachedFiles: Array<{ id: string; name: string; url: string }>;
}

// ============================================
// Content Extractor
// ============================================

export class ContentExtractor {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  private async getPage(): Promise<Page> {
    return this.browserManager.getPage();
  }

  // ----------------------------------------
  // Assignments Page Extraction
  // ----------------------------------------

  async extractAssignments(): Promise<CanvasAssignment[]> {
    const page = await this.getPage();

    const assignments = await page.evaluate(() => {
      const results: Array<{
        canvasId: string;
        title: string;
        description?: string;
        dueAt?: string;
        availableFrom?: string;
        availableUntil?: string;
        pointsPossible?: number;
        submissionTypes?: string[];
        url: string;
        isQuiz: boolean;
        isDiscussion: boolean;
        published: boolean;
      }> = [];

      // Find all assignment items
      const assignmentItems = document.querySelectorAll('.ig-row, .assignment');

      assignmentItems.forEach((item: Element) => {
        const titleLink = item.querySelector('a.ig-title, a.assignment-title, .assignment-name a');
        const dueDateEl = item.querySelector('.due_date_display, .assignment-date-due');
        const pointsEl = item.querySelector('.points_possible, .assignment-points');

        if (!titleLink) return;

        const href = titleLink.getAttribute('href') || '';
        const idMatch = href.match(/\/assignments\/(\d+)|\/quizzes\/(\d+)|\/discussion_topics\/(\d+)/);
        if (!idMatch) return;

        const canvasId = idMatch[1] || idMatch[2] || idMatch[3];
        const isQuiz = href.includes('/quizzes/');
        const isDiscussion = href.includes('/discussion_topics/');

        // Parse due date
        let dueAt: string | undefined;
        if (dueDateEl) {
          const dateText = dueDateEl.textContent?.trim();
          const dateAttr = dueDateEl.getAttribute('data-date');
          if (dateAttr) {
            dueAt = dateAttr;
          } else if (dateText) {
            // Try to parse text date (Canvas often uses "Due Jan 15 at 11:59pm")
            try {
              const parsed = new Date(dateText.replace(/^Due\s+/, ''));
              if (!isNaN(parsed.getTime())) {
                dueAt = parsed.toISOString();
              }
            } catch { /* ignore parse errors */ }
          }
        }

        // Parse points
        let pointsPossible: number | undefined;
        if (pointsEl) {
          const pointsText = pointsEl.textContent?.trim();
          const pointsMatch = pointsText?.match(/(\d+(?:\.\d+)?)/);
          if (pointsMatch) {
            pointsPossible = parseFloat(pointsMatch[1]);
          }
        }

        // Check if published
        const publishedIcon = item.querySelector('.published-status, .publish-icon');
        const published = !publishedIcon || !publishedIcon.classList.contains('unpublished');

        results.push({
          canvasId,
          title: titleLink.textContent?.trim() || '',
          dueAt,
          pointsPossible,
          url: href.startsWith('http') ? href : window.location.origin + href,
          isQuiz,
          isDiscussion,
          published,
        });
      });

      return results;
    });

    return assignments.map((a) => ({
      ...a,
      dueAt: a.dueAt ? new Date(a.dueAt) : undefined,
      availableFrom: a.availableFrom ? new Date(a.availableFrom) : undefined,
      availableUntil: a.availableUntil ? new Date(a.availableUntil) : undefined,
    }));
  }

  // ----------------------------------------
  // Assignment Detail Page Extraction (Canvas Complete)
  // ----------------------------------------

  /**
   * Extract full assignment details from an assignment detail page
   * Must be on the assignment page (/courses/:id/assignments/:id)
   */
  async extractAssignmentDetails(): Promise<AssignmentDetailExtraction | null> {
    const page = await this.getPage();

    const details = await page.evaluate(() => {
      // Check if we're on an assignment page
      const assignmentHeader = document.querySelector('.assignment_title, #assignment_show h1, .title-content');
      if (!assignmentHeader) return null;

      const result: {
        title: string;
        instructions: string | null;
        instructionsHtml: string | null;
        dueAt: string | null;
        pointsPossible: number | null;
        submissionTypes: string[];
        allowedExtensions: string[];
        isGroupAssignment: boolean;
        hasPeerReview: boolean;
        rubric: Array<{
          id: string;
          criterion: string;
          description: string | null;
          points: number;
          ratings: Array<{ description: string; points: number }>;
        }> | null;
        lockInfo: { isLocked: boolean; message: string | null } | null;
        attachedFiles: Array<{ id: string; name: string; url: string }>;
      } = {
        title: assignmentHeader.textContent?.trim() || '',
        instructions: null,
        instructionsHtml: null,
        dueAt: null,
        pointsPossible: null,
        submissionTypes: [],
        allowedExtensions: [],
        isGroupAssignment: false,
        hasPeerReview: false,
        rubric: null,
        lockInfo: null,
        attachedFiles: [],
      };

      // Extract instructions
      const descriptionEl = document.querySelector('.description, .user_content, #assignment-description');
      if (descriptionEl) {
        result.instructionsHtml = descriptionEl.innerHTML;
        result.instructions = descriptionEl.textContent?.trim() || null;
      }

      // Extract due date
      const dueDateEl = document.querySelector('.date_text, .assignment-date-available .date_text, [data-testid="due-date"]');
      if (dueDateEl) {
        const dateAttr = dueDateEl.getAttribute('datetime') || dueDateEl.getAttribute('data-date');
        if (dateAttr) {
          result.dueAt = dateAttr;
        } else {
          const dateText = dueDateEl.textContent?.trim();
          if (dateText) {
            try {
              const parsed = new Date(dateText);
              if (!isNaN(parsed.getTime())) {
                result.dueAt = parsed.toISOString();
              }
            } catch { /* ignore */ }
          }
        }
      }

      // Extract points
      const pointsEl = document.querySelector('.points_possible, .assignment_points, [data-testid="points"]');
      if (pointsEl) {
        const pointsText = pointsEl.textContent?.trim();
        const match = pointsText?.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          result.pointsPossible = parseFloat(match[1]);
        }
      }

      // Extract submission types
      const submissionTypeEl = document.querySelector('.submission_types, .submission-types-list');
      if (submissionTypeEl) {
        const types = submissionTypeEl.textContent?.toLowerCase() || '';
        if (types.includes('file upload')) result.submissionTypes.push('online_upload');
        if (types.includes('text entry')) result.submissionTypes.push('online_text_entry');
        if (types.includes('website url')) result.submissionTypes.push('online_url');
        if (types.includes('media')) result.submissionTypes.push('media_recording');
        if (types.includes('on paper')) result.submissionTypes.push('on_paper');
      }

      // Extract allowed file extensions
      const extensionsEl = document.querySelector('.allowed_extensions, .allowed-extensions');
      if (extensionsEl) {
        const extText = extensionsEl.textContent || '';
        const extensions = extText.match(/\.\w+/g) || [];
        result.allowedExtensions = extensions;
      }

      // Check for group assignment
      const groupEl = document.querySelector('.group_category, .assignment-group-category, [data-testid="group-assignment"]');
      result.isGroupAssignment = !!groupEl && groupEl.textContent?.trim() !== '';

      // Check for peer review
      const peerReviewEl = document.querySelector('.peer_reviews, .assignment-peer-review, [data-testid="peer-review"]');
      result.hasPeerReview = !!peerReviewEl;

      // Extract rubric
      const rubricTable = document.querySelector('.rubric_table, .rubric-table, .rubric_container table');
      if (rubricTable) {
        result.rubric = [];
        const criteriaRows = rubricTable.querySelectorAll('.criterion, tr.rubric_criterion, tr[data-criterion-id]');

        criteriaRows.forEach((row: Element, index: number) => {
          const criterionEl = row.querySelector('.criterion_description, .description .criterion-name, td:first-child');
          const descEl = row.querySelector('.long_description, .criterion-description');
          const pointsEl = row.querySelector('.points, .criterion_points, .rating-points');

          const criterion = criterionEl?.textContent?.trim() || `Criterion ${index + 1}`;
          const description = descEl?.textContent?.trim() || null;
          const points = parseFloat(pointsEl?.textContent?.replace(/[^\d.]/g, '') || '0');

          // Extract ratings
          const ratings: Array<{ description: string; points: number }> = [];
          const ratingCells = row.querySelectorAll('.rating, .rating-description, td.rating');

          ratingCells.forEach((cell: Element) => {
            const ratingDesc = cell.querySelector('.description, .rating-name')?.textContent?.trim() ||
                              cell.textContent?.trim() || '';
            const ratingPoints = parseFloat(
              cell.querySelector('.points, .rating-points')?.textContent?.replace(/[^\d.]/g, '') || '0'
            );
            if (ratingDesc) {
              ratings.push({ description: ratingDesc, points: ratingPoints });
            }
          });

          result.rubric!.push({
            id: row.getAttribute('data-criterion-id') || `criterion_${index}`,
            criterion,
            description,
            points,
            ratings,
          });
        });
      }

      // Check for lock info
      const lockEl = document.querySelector('.lock_explanation, .assignment-locked, .content-lock-info');
      if (lockEl) {
        result.lockInfo = {
          isLocked: true,
          message: lockEl.textContent?.trim() || null,
        };
      }

      // Extract attached files
      const attachments = document.querySelectorAll('.attachment, .file_preview_link, a[data-api-endpoint*="files"]');
      attachments.forEach((attachment: Element) => {
        const href = attachment.getAttribute('href') || '';
        const fileIdMatch = href.match(/\/files\/(\d+)/);
        if (fileIdMatch) {
          result.attachedFiles.push({
            id: fileIdMatch[1],
            name: attachment.textContent?.trim() || 'Unknown file',
            url: href.startsWith('http') ? href : window.location.origin + href,
          });
        }
      });

      return result;
    });

    if (!details) return null;

    return {
      ...details,
      dueAt: details.dueAt ? new Date(details.dueAt) : null,
    };
  }

  // ----------------------------------------
  // Modules Page Extraction
  // ----------------------------------------

  async extractModuleItems(): Promise<CanvasModuleItem[]> {
    const page = await this.getPage();

    const moduleItems = await page.evaluate(() => {
      const results: Array<{
        canvasId: string;
        title: string;
        itemType: 'assignment' | 'quiz' | 'discussion' | 'page' | 'file' | 'external_url' | 'subheader';
        url?: string;
        dueAt?: string;
        moduleId: string;
        moduleName: string;
        position: number;
        completed?: boolean;
      }> = [];

      const modules = document.querySelectorAll('.context_module');

      modules.forEach((module: Element) => {
        const moduleHeader = module.querySelector('.ig-header-title, .module-header');
        const moduleName = moduleHeader?.textContent?.trim() || 'Unknown Module';
        const moduleId = module.getAttribute('data-module-id') || module.id || '';

        const items = module.querySelectorAll('.ig-row, .context_module_item');

        items.forEach((item: Element, index: number) => {
          const titleEl = item.querySelector('.ig-title, .module-item-title a');
          const iconEl = item.querySelector('[class*="icon-"], .module-item-icon');
          const dueDateEl = item.querySelector('.due_date_display, .due-date');
          const completionEl = item.querySelector('.module-item-status-icon, .requirement-status');

          if (!titleEl) return;

          const href = titleEl.getAttribute('href') || '';

          // Determine item type from icon or URL
          let itemType: 'assignment' | 'quiz' | 'discussion' | 'page' | 'file' | 'external_url' | 'subheader' = 'page';
          const iconClass = iconEl?.className || '';

          if (iconClass.includes('assignment') || href.includes('/assignments/')) {
            itemType = 'assignment';
          } else if (iconClass.includes('quiz') || href.includes('/quizzes/')) {
            itemType = 'quiz';
          } else if (iconClass.includes('discussion') || href.includes('/discussion_topics/')) {
            itemType = 'discussion';
          } else if (iconClass.includes('document') || href.includes('/files/')) {
            itemType = 'file';
          } else if (iconClass.includes('link') || href.startsWith('http')) {
            itemType = 'external_url';
          } else if (iconClass.includes('subheader') || item.classList.contains('context_module_sub_header')) {
            itemType = 'subheader';
          }

          // Extract canvas ID
          const idMatch = href.match(/\/(assignments|quizzes|discussion_topics|pages|files)\/(\d+)/);
          const canvasId = idMatch ? `${idMatch[1]}_${idMatch[2]}` : `module_item_${index}`;

          // Parse due date
          let dueAt: string | undefined;
          if (dueDateEl) {
            const dateAttr = dueDateEl.getAttribute('data-date');
            if (dateAttr) {
              dueAt = dateAttr;
            }
          }

          // Check completion status
          const completed = completionEl?.classList.contains('completed') || false;

          results.push({
            canvasId,
            title: titleEl.textContent?.trim() || '',
            itemType,
            url: href.startsWith('http') ? href : (href ? window.location.origin + href : undefined),
            dueAt,
            moduleId,
            moduleName,
            position: index,
            completed,
          });
        });
      });

      return results;
    });

    return moduleItems.map((item) => ({
      ...item,
      dueAt: item.dueAt ? new Date(item.dueAt) : undefined,
    }));
  }

  // ----------------------------------------
  // Announcements Extraction
  // ----------------------------------------

  async extractAnnouncements(): Promise<CanvasAnnouncement[]> {
    const page = await this.getPage();

    const announcements = await page.evaluate(() => {
      const results: Array<{
        canvasId: string;
        title: string;
        content: string;
        postedAt: string;
        author?: string;
        url: string;
      }> = [];

      const announcementItems = document.querySelectorAll('.discussion-topic, .announcement');

      announcementItems.forEach((item: Element) => {
        const titleLink = item.querySelector('.discussion-title a, .announcement-title a, a.discussion-link');
        const contentEl = item.querySelector('.discussion-summary, .announcement-summary, .message');
        const dateEl = item.querySelector('.discussion-date, .timestamp');
        const authorEl = item.querySelector('.author, .discussion-author');

        if (!titleLink) return;

        const href = titleLink.getAttribute('href') || '';
        const idMatch = href.match(/\/announcements\/(\d+)|\/discussion_topics\/(\d+)/);
        if (!idMatch) return;

        const canvasId = idMatch[1] || idMatch[2];

        results.push({
          canvasId,
          title: titleLink.textContent?.trim() || '',
          content: contentEl?.textContent?.trim() || '',
          postedAt: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || new Date().toISOString(),
          author: authorEl?.textContent?.trim(),
          url: href.startsWith('http') ? href : window.location.origin + href,
        });
      });

      return results;
    });

    return announcements.map((a) => ({
      ...a,
      postedAt: new Date(a.postedAt),
    }));
  }

  // ----------------------------------------
  // Syllabus Extraction
  // ----------------------------------------

  async extractSyllabus(): Promise<SyllabusData> {
    const page = await this.getPage();

    const syllabusData = await page.evaluate(() => {
      const data: {
        courseDescription?: string;
        assignments: Array<{ title: string; dueAt?: string; pointsPossible?: number }>;
        events: Array<{ title: string; date: string }>;
      } = {
        assignments: [],
        events: [],
      };

      // Course description
      const descriptionEl = document.querySelector('.syllabus-description, #course_syllabus');
      if (descriptionEl) {
        data.courseDescription = descriptionEl.textContent?.trim();
      }

      // Syllabus table assignments
      const syllabusRows = document.querySelectorAll('#syllabusTableBody tr, .syllabus-assignment');
      syllabusRows.forEach((row: Element) => {
        const dateCell = row.querySelector('.date, .syllabus-date');
        const titleCell = row.querySelector('.title, .syllabus-title a');
        const pointsCell = row.querySelector('.points, .syllabus-points');

        if (titleCell) {
          let dueAt: string | undefined;
          if (dateCell) {
            const dateAttr = dateCell.getAttribute('data-date');
            if (dateAttr) {
              dueAt = dateAttr;
            }
          }

          let pointsPossible: number | undefined;
          if (pointsCell) {
            const match = pointsCell.textContent?.match(/(\d+(?:\.\d+)?)/);
            if (match) {
              pointsPossible = parseFloat(match[1]);
            }
          }

          data.assignments.push({
            title: titleCell.textContent?.trim() || '',
            dueAt,
            pointsPossible,
          });
        }
      });

      return data;
    });

    return {
      ...syllabusData,
      assignments: syllabusData.assignments.map((a) => ({
        ...a,
        dueAt: a.dueAt ? new Date(a.dueAt) : undefined,
      })),
      events: syllabusData.events.map((e) => ({
        ...e,
        date: new Date(e.date),
      })),
    };
  }

  // ----------------------------------------
  // Home Page Extraction
  // ----------------------------------------

  async extractHomePage(): Promise<HomePageData> {
    const page = await this.getPage();

    return page.evaluate(() => {
      const data: {
        welcomeMessage?: string;
        announcementsCount: number;
        todoItems: string[];
        upcomingAssignments: Array<{ title: string; dueAt?: string; courseName?: string }>;
      } = {
        announcementsCount: 0,
        todoItems: [],
        upcomingAssignments: [],
      };

      // Welcome message
      const welcomeEl = document.querySelector('.ic-Dashboard-header__title, #course_home_content h1');
      if (welcomeEl) {
        data.welcomeMessage = welcomeEl.textContent?.trim();
      }

      // Announcements count
      const announcementsList = document.querySelectorAll('.announcements-list .discussion-topic');
      data.announcementsCount = announcementsList.length;

      // To-do items
      const todoList = document.querySelectorAll('.to-do-list li, .todo-item');
      todoList.forEach((item: Element) => {
        const text = item.textContent?.trim();
        if (text) {
          data.todoItems.push(text);
        }
      });

      // Upcoming assignments (sidebar)
      const upcomingItems = document.querySelectorAll('.coming_up .event, .upcoming-assignments li');
      upcomingItems.forEach((item: Element) => {
        const titleEl = item.querySelector('.title, .event-title, a');
        const dateEl = item.querySelector('.date, .event-date');
        const courseEl = item.querySelector('.context, .course-name');

        if (titleEl) {
          data.upcomingAssignments.push({
            title: titleEl.textContent?.trim() || '',
            dueAt: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim(),
            courseName: courseEl?.textContent?.trim(),
          });
        }
      });

      return data;
    });
  }

  // ----------------------------------------
  // Discussion Extraction
  // ----------------------------------------

  async extractDiscussions(): Promise<CanvasAssignment[]> {
    const page = await this.getPage();

    const discussions = await page.evaluate(() => {
      const results: Array<{
        canvasId: string;
        title: string;
        description?: string;
        dueAt?: string;
        pointsPossible?: number;
        url: string;
        published: boolean;
      }> = [];

      const discussionItems = document.querySelectorAll('.discussion-topic, .discussion');

      discussionItems.forEach((item: Element) => {
        const titleLink = item.querySelector('.discussion-title a, a.discussion-link');
        const dueDateEl = item.querySelector('.discussion-date-due, .due_date_display');
        const pointsEl = item.querySelector('.points_possible');

        if (!titleLink) return;

        const href = titleLink.getAttribute('href') || '';
        const idMatch = href.match(/\/discussion_topics\/(\d+)/);
        if (!idMatch) return;

        let dueAt: string | undefined;
        if (dueDateEl) {
          const dateAttr = dueDateEl.getAttribute('datetime') || dueDateEl.getAttribute('data-date');
          if (dateAttr) {
            dueAt = dateAttr;
          }
        }

        let pointsPossible: number | undefined;
        if (pointsEl) {
          const match = pointsEl.textContent?.match(/(\d+(?:\.\d+)?)/);
          if (match) {
            pointsPossible = parseFloat(match[1]);
          }
        }

        const publishedIcon = item.querySelector('.discussion-topic-status');
        const published = !publishedIcon?.classList.contains('unpublished');

        results.push({
          canvasId: idMatch[1],
          title: titleLink.textContent?.trim() || '',
          dueAt,
          pointsPossible,
          url: href.startsWith('http') ? href : window.location.origin + href,
          published,
        });
      });

      return results;
    });

    return discussions.map((d) => ({
      ...d,
      dueAt: d.dueAt ? new Date(d.dueAt) : undefined,
      isQuiz: false,
      isDiscussion: true,
    }));
  }

  // ----------------------------------------
  // Quiz Extraction
  // ----------------------------------------

  async extractQuizzes(): Promise<CanvasAssignment[]> {
    const page = await this.getPage();

    const quizzes = await page.evaluate(() => {
      const results: Array<{
        canvasId: string;
        title: string;
        description?: string;
        dueAt?: string;
        pointsPossible?: number;
        url: string;
        published: boolean;
      }> = [];

      const quizItems = document.querySelectorAll('.quiz, .ig-row');

      quizItems.forEach((item: Element) => {
        const titleLink = item.querySelector('.ig-title, .quiz-title a, a[href*="/quizzes/"]');
        const dueDateEl = item.querySelector('.due_date_display, .quiz-date-due');
        const pointsEl = item.querySelector('.points_possible');

        if (!titleLink) return;

        const href = titleLink.getAttribute('href') || '';
        const idMatch = href.match(/\/quizzes\/(\d+)/);
        if (!idMatch) return;

        let dueAt: string | undefined;
        if (dueDateEl) {
          const dateAttr = dueDateEl.getAttribute('datetime') || dueDateEl.getAttribute('data-date');
          if (dateAttr) {
            dueAt = dateAttr;
          }
        }

        let pointsPossible: number | undefined;
        if (pointsEl) {
          const match = pointsEl.textContent?.match(/(\d+(?:\.\d+)?)/);
          if (match) {
            pointsPossible = parseFloat(match[1]);
          }
        }

        const publishedIcon = item.querySelector('.published-status');
        const published = !publishedIcon?.classList.contains('unpublished');

        results.push({
          canvasId: idMatch[1],
          title: titleLink.textContent?.trim() || '',
          dueAt,
          pointsPossible,
          url: href.startsWith('http') ? href : window.location.origin + href,
          published,
        });
      });

      return results;
    });

    return quizzes.map((q) => ({
      ...q,
      dueAt: q.dueAt ? new Date(q.dueAt) : undefined,
      isQuiz: true,
      isDiscussion: false,
    }));
  }

  // ----------------------------------------
  // Pages (Wiki) Extraction
  // ----------------------------------------

  async extractPages(): Promise<CanvasPageContent[]> {
    const page = await this.getPage();

    const pages = await page.evaluate(() => {
      const results: Array<{
        canvasId: string;
        title: string;
        url: string;
        published: boolean;
        updatedAt?: string;
      }> = [];

      // Find page listings
      const pageItems = document.querySelectorAll('.wiki-page-link, .page, [data-testid="wiki-page-item"]');

      pageItems.forEach((item: Element) => {
        const titleLink = item.querySelector('a.wiki-page-link, a.page-title, a[href*="/pages/"]');
        const publishedIcon = item.querySelector('.published-status, .publish-icon');
        const dateEl = item.querySelector('.page-date, .updated-at');

        if (!titleLink) return;

        const href = titleLink.getAttribute('href') || '';
        const slugMatch = href.match(/\/pages\/([^/?]+)/);
        if (!slugMatch) return;

        results.push({
          canvasId: slugMatch[1],
          title: titleLink.textContent?.trim() || slugMatch[1],
          url: href.startsWith('http') ? href : window.location.origin + href,
          published: !publishedIcon?.classList.contains('unpublished'),
          updatedAt: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim(),
        });
      });

      return results;
    });

    return pages.map((p) => ({
      ...p,
      content: '',
      htmlContent: '',
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
    }));
  }

  // ----------------------------------------
  // Individual Page Content Extraction
  // ----------------------------------------

  async extractPageContent(pageUrl: string): Promise<CanvasPageContent | null> {
    const page = await this.getPage();

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const content = await page.evaluate(() => {
        const titleEl = document.querySelector('.page-title, h1.title, #wiki_page_title');
        const contentEl = document.querySelector('.wiki-page-content, .show-content, #wiki_page_show');
        const publishedEl = document.querySelector('.published-status');

        if (!contentEl) return null;

        // Get both text and HTML content
        const htmlContent = contentEl.innerHTML;
        const textContent = contentEl.textContent?.trim() || '';

        // Extract links from content
        const links: string[] = [];
        contentEl.querySelectorAll('a[href]').forEach((a: Element) => {
          const href = a.getAttribute('href');
          if (href && !href.startsWith('#')) {
            links.push(href);
          }
        });

        return {
          title: titleEl?.textContent?.trim() || 'Untitled Page',
          content: textContent,
          htmlContent,
          published: !publishedEl?.classList.contains('unpublished'),
          links,
        };
      });

      if (!content) return null;

      const slugMatch = pageUrl.match(/\/pages\/([^/?]+)/);

      return {
        canvasId: slugMatch?.[1] || '',
        title: content.title,
        content: content.content,
        htmlContent: content.htmlContent,
        url: pageUrl,
        published: content.published,
      };
    } catch (error) {
      console.error(`[ContentExtractor] Failed to extract page content from ${pageUrl}:`, error);
      return null;
    }
  }

  // ----------------------------------------
  // Files Extraction
  // ----------------------------------------

  async extractFiles(): Promise<CanvasFile[]> {
    const page = await this.getPage();

    const files = await page.evaluate(() => {
      const results: Array<{
        canvasId: string;
        displayName: string;
        fileName: string;
        contentType: string;
        size?: number;
        url: string;
        downloadUrl?: string;
        folderId?: string;
        folderName?: string;
      }> = [];

      // Find file listings in the files page
      const fileItems = document.querySelectorAll('.ef-item-row, .file, [data-testid="file-item"]');

      fileItems.forEach((item: Element) => {
        const nameEl = item.querySelector('.ef-name-col__text, .file-name, a[href*="/files/"]');
        const sizeEl = item.querySelector('.ef-size-col, .file-size');
        const typeEl = item.querySelector('.ef-type-col, .file-type');

        if (!nameEl) return;

        const href = nameEl.getAttribute('href') || item.querySelector('a')?.getAttribute('href') || '';
        const idMatch = href.match(/\/files\/(\d+)/);
        if (!idMatch) return;

        // Parse file size
        let size: number | undefined;
        if (sizeEl) {
          const sizeText = sizeEl.textContent?.trim() || '';
          const match = sizeText.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)/i);
          if (match) {
            const num = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            size = unit === 'KB' ? num * 1024 :
                   unit === 'MB' ? num * 1024 * 1024 :
                   unit === 'GB' ? num * 1024 * 1024 * 1024 : num;
          }
        }

        // Determine content type from icon or extension
        const fileName = nameEl.textContent?.trim() || '';
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        let contentType = 'application/octet-stream';
        if (['pdf'].includes(ext)) contentType = 'application/pdf';
        else if (['doc', 'docx'].includes(ext)) contentType = 'application/msword';
        else if (['xls', 'xlsx'].includes(ext)) contentType = 'application/vnd.ms-excel';
        else if (['ppt', 'pptx'].includes(ext)) contentType = 'application/vnd.ms-powerpoint';
        else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        else if (typeEl) contentType = typeEl.textContent?.trim() || contentType;

        results.push({
          canvasId: idMatch[1],
          displayName: fileName,
          fileName,
          contentType,
          size,
          url: href.startsWith('http') ? href : window.location.origin + href,
          downloadUrl: href.includes('/download') ? href : `${href}/download`,
        });
      });

      return results;
    });

    return files;
  }

  // ----------------------------------------
  // Readings Extraction (from modules)
  // ----------------------------------------

  async extractReadings(): Promise<CanvasReading[]> {
    const page = await this.getPage();

    const readings = await page.evaluate(() => {
      const results: Array<{
        canvasId: string;
        title: string;
        type: 'external_url' | 'file' | 'page';
        url: string;
        description?: string;
        moduleName: string;
        modulePosition: number;
        isRequired: boolean;
      }> = [];

      // Keywords that indicate reading materials
      const readingKeywords = [
        'reading', 'read', 'article', 'chapter', 'textbook', 'paper',
        'case', 'hbr', 'harvard', 'study', 'material', 'resource',
        'preparation', 'prep', 'before class', 'pre-class'
      ];

      const modules = document.querySelectorAll('.context_module');

      modules.forEach((module: Element, moduleIndex: number) => {
        const moduleHeader = module.querySelector('.ig-header-title, .module-header');
        const moduleName = moduleHeader?.textContent?.trim() || `Module ${moduleIndex + 1}`;

        const items = module.querySelectorAll('.ig-row, .context_module_item');

        items.forEach((item: Element, itemIndex: number) => {
          const titleEl = item.querySelector('.ig-title, .module-item-title a, a');
          const iconEl = item.querySelector('[class*="icon-"], .module-item-icon');
          const requirementEl = item.querySelector('.requirement-description, .ig-details');

          if (!titleEl) return;

          const title = titleEl.textContent?.trim() || '';
          const titleLower = title.toLowerCase();
          const href = titleEl.getAttribute('href') || '';
          const iconClass = iconEl?.className || '';

          // Determine if this is a reading based on title, icon, or module name
          const moduleNameLower = moduleName.toLowerCase();
          const isReading = readingKeywords.some(kw =>
            titleLower.includes(kw) || moduleNameLower.includes(kw)
          );

          // Only process external links, files, or pages that look like readings
          let itemType: 'external_url' | 'file' | 'page' | null = null;

          if (iconClass.includes('link') || href.startsWith('http://') || href.startsWith('https://')) {
            itemType = 'external_url';
          } else if (iconClass.includes('document') || href.includes('/files/')) {
            itemType = 'file';
          } else if (href.includes('/pages/')) {
            itemType = 'page';
          }

          // Skip if not a potential reading type
          if (!itemType) return;

          // Skip assignments, quizzes, discussions
          if (href.includes('/assignments/') || href.includes('/quizzes/') || href.includes('/discussion_topics/')) {
            return;
          }

          // Check if required
          const requirementText = requirementEl?.textContent?.toLowerCase() || '';
          const isRequired = requirementText.includes('must') ||
                            requirementText.includes('required') ||
                            item.classList.contains('must-contribute');

          // Include if it's a reading keyword match OR if it's an external link in a readings module
          if (isReading || (itemType === 'external_url' && moduleNameLower.includes('reading'))) {
            const idMatch = href.match(/\/(files|pages)\/([^/?]+)/) || [`reading_${moduleIndex}_${itemIndex}`];

            results.push({
              canvasId: idMatch[2] || `reading_${moduleIndex}_${itemIndex}`,
              title,
              type: itemType,
              url: href.startsWith('http') ? href : window.location.origin + href,
              moduleName,
              modulePosition: itemIndex,
              isRequired,
            });
          }
        });
      });

      return results;
    });

    return readings;
  }

  // ----------------------------------------
  // Full Course Content Extraction
  // ----------------------------------------

  async extractFullCourseContent(): Promise<{
    pages: CanvasPageContent[];
    files: CanvasFile[];
    readings: CanvasReading[];
    moduleItems: CanvasModuleItem[];
  }> {
    console.log('[ContentExtractor] Starting full course content extraction...');

    // First extract module items to get all content references
    const moduleItems = await this.extractModuleItems();
    console.log(`[ContentExtractor] Found ${moduleItems.length} module items`);

    // Extract readings from modules
    const readings = await this.extractReadings();
    console.log(`[ContentExtractor] Found ${readings.length} readings`);

    // Navigate to pages list and extract
    const page = await this.getPage();
    const currentUrl = page.url();
    const baseUrl = currentUrl.replace(/\/(modules|assignments|files|pages|syllabus).*$/, '');

    // Extract pages
    let pages: CanvasPageContent[] = [];
    try {
      await page.goto(`${baseUrl}/pages`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      pages = await this.extractPages();
      console.log(`[ContentExtractor] Found ${pages.length} pages`);

      // Extract content from first few important pages
      const pageContents: CanvasPageContent[] = [];
      const importantPages = pages.slice(0, 10); // Limit to first 10 pages
      for (const p of importantPages) {
        const content = await this.extractPageContent(p.url);
        if (content) {
          pageContents.push(content);
        }
      }
      pages = pageContents.length > 0 ? pageContents : pages;
    } catch (error) {
      console.error('[ContentExtractor] Failed to extract pages:', error);
    }

    // Extract files
    let files: CanvasFile[] = [];
    try {
      await page.goto(`${baseUrl}/files`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      files = await this.extractFiles();
      console.log(`[ContentExtractor] Found ${files.length} files`);
    } catch (error) {
      console.error('[ContentExtractor] Failed to extract files:', error);
    }

    // Return to modules page
    try {
      await page.goto(`${baseUrl}/modules`, { waitUntil: 'networkidle' });
    } catch {
      // Ignore navigation errors
    }

    return {
      pages,
      files,
      readings,
      moduleItems,
    };
  }
}

// ============================================
// Export
// ============================================

export function createContentExtractor(browserManager: BrowserManager): ContentExtractor {
  return new ContentExtractor(browserManager);
}
