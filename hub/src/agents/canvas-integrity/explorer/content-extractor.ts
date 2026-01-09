import { Page } from 'playwright';
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
    dueAt?: Date;
    courseName?: string;
  }>;
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

      assignmentItems.forEach((item) => {
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

      modules.forEach((module) => {
        const moduleHeader = module.querySelector('.ig-header-title, .module-header');
        const moduleName = moduleHeader?.textContent?.trim() || 'Unknown Module';
        const moduleId = module.getAttribute('data-module-id') || module.id || '';

        const items = module.querySelectorAll('.ig-row, .context_module_item');

        items.forEach((item, index) => {
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

      announcementItems.forEach((item) => {
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
      syllabusRows.forEach((row) => {
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
      todoList.forEach((item) => {
        const text = item.textContent?.trim();
        if (text) {
          data.todoItems.push(text);
        }
      });

      // Upcoming assignments (sidebar)
      const upcomingItems = document.querySelectorAll('.coming_up .event, .upcoming-assignments li');
      upcomingItems.forEach((item) => {
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

      discussionItems.forEach((item) => {
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

      quizItems.forEach((item) => {
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
}

// ============================================
// Export
// ============================================

export function createContentExtractor(browserManager: BrowserManager): ContentExtractor {
  return new ContentExtractor(browserManager);
}
