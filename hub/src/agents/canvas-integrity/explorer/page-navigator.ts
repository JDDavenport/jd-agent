import type { Page } from 'playwright';
import { BrowserManager } from '../browser-manager';

// ============================================
// Types
// ============================================

export enum CanvasPage {
  DASHBOARD = 'dashboard',
  HOME = 'home',
  SYLLABUS = 'syllabus',
  MODULES = 'modules',
  ASSIGNMENTS = 'assignments',
  DISCUSSIONS = 'discussions',
  ANNOUNCEMENTS = 'announcements',
  GRADES = 'grades',
  FILES = 'files',
  QUIZZES = 'quizzes',
  PAGES = 'pages',
  PEOPLE = 'people',
  CALENDAR = 'calendar',
}

export interface Course {
  id: string;
  name: string;
  code?: string;
  url: string;
  enrollmentTerm?: string;
}

export interface NavigationResult {
  success: boolean;
  url: string;
  pageType: CanvasPage;
  courseId?: string;
  error?: string;
}

// ============================================
// Page Navigator
// ============================================

export class PageNavigator {
  private browserManager: BrowserManager;
  private page: Page | null = null;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  private async getPage(): Promise<Page> {
    if (!this.page) {
      this.page = await this.browserManager.getPage();
    }
    return this.page;
  }

  // ----------------------------------------
  // Dashboard & Course List
  // ----------------------------------------

  async navigateToDashboard(): Promise<NavigationResult> {
    const page = await this.getPage();
    const baseUrl = this.browserManager.getCanvasBaseUrl();

    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
      return {
        success: true,
        url: page.url(),
        pageType: CanvasPage.DASHBOARD,
      };
    } catch (error) {
      return {
        success: false,
        url: page.url(),
        pageType: CanvasPage.DASHBOARD,
        error: String(error),
      };
    }
  }

  async getEnrolledCourses(): Promise<Course[]> {
    const page = await this.getPage();
    const baseUrl = this.browserManager.getCanvasBaseUrl();

    // Navigate to courses page
    await page.goto(`${baseUrl}/courses`, { waitUntil: 'networkidle' });

    // Wait for course list to load
    await page.waitForSelector('.ic-DashboardCard, .course-list-table, #my_courses_table', {
      timeout: 10000,
    }).catch(() => {});

    // Extract course information
    const courses = await page.evaluate(() => {
      const courseList: Array<{
        id: string;
        name: string;
        code: string | undefined;
        url: string;
        enrollmentTerm: string | undefined;
      }> = [];

      // Try dashboard cards first
      const dashboardCards = document.querySelectorAll('.ic-DashboardCard');
      if (dashboardCards.length > 0) {
        dashboardCards.forEach((card: Element) => {
          const link = card.querySelector('a.ic-DashboardCard__link');
          const title = card.querySelector('.ic-DashboardCard__header-title');
          const code = card.querySelector('.ic-DashboardCard__header-subtitle');

          if (link && title) {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/courses\/(\d+)/);
            if (match) {
              courseList.push({
                id: match[1],
                name: title.textContent?.trim() || '',
                code: code?.textContent?.trim(),
                url: href,
                enrollmentTerm: undefined,
              });
            }
          }
        });
      }

      // Try course table if no dashboard cards
      if (courseList.length === 0) {
        const courseRows = document.querySelectorAll('#my_courses_table tr, .course-list-table tr');
        courseRows.forEach((row: Element) => {
          const link = row.querySelector('a[href*="/courses/"]');
          const termCell = row.querySelector('.course-list-term-column');

          if (link) {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/courses\/(\d+)/);
            if (match) {
              courseList.push({
                id: match[1],
                name: link.textContent?.trim() || '',
                code: undefined,
                url: href,
                enrollmentTerm: termCell?.textContent?.trim(),
              });
            }
          }
        });
      }

      return courseList;
    });

    console.log(`[PageNavigator] Found ${courses.length} enrolled courses`);
    return courses;
  }

  // ----------------------------------------
  // Course Page Navigation
  // ----------------------------------------

  async navigateToCourse(courseId: string): Promise<NavigationResult> {
    const page = await this.getPage();
    const baseUrl = this.browserManager.getCanvasBaseUrl();

    try {
      await page.goto(`${baseUrl}/courses/${courseId}`, { waitUntil: 'networkidle' });
      return {
        success: true,
        url: page.url(),
        pageType: CanvasPage.HOME,
        courseId,
      };
    } catch (error) {
      return {
        success: false,
        url: page.url(),
        pageType: CanvasPage.HOME,
        courseId,
        error: String(error),
      };
    }
  }

  async navigateToCoursePage(courseId: string, pageType: CanvasPage): Promise<NavigationResult> {
    const page = await this.getPage();
    const baseUrl = this.browserManager.getCanvasBaseUrl();

    const pageUrlMap: Record<CanvasPage, string> = {
      [CanvasPage.DASHBOARD]: '/',
      [CanvasPage.HOME]: `/courses/${courseId}`,
      [CanvasPage.SYLLABUS]: `/courses/${courseId}/assignments/syllabus`,
      [CanvasPage.MODULES]: `/courses/${courseId}/modules`,
      [CanvasPage.ASSIGNMENTS]: `/courses/${courseId}/assignments`,
      [CanvasPage.DISCUSSIONS]: `/courses/${courseId}/discussion_topics`,
      [CanvasPage.ANNOUNCEMENTS]: `/courses/${courseId}/announcements`,
      [CanvasPage.GRADES]: `/courses/${courseId}/grades`,
      [CanvasPage.FILES]: `/courses/${courseId}/files`,
      [CanvasPage.QUIZZES]: `/courses/${courseId}/quizzes`,
      [CanvasPage.PAGES]: `/courses/${courseId}/pages`,
      [CanvasPage.PEOPLE]: `/courses/${courseId}/users`,
      [CanvasPage.CALENDAR]: `/calendar`,
    };

    const targetUrl = `${baseUrl}${pageUrlMap[pageType]}`;

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle' });

      // Wait for page content to load
      await this.waitForPageLoad(pageType);

      return {
        success: true,
        url: page.url(),
        pageType,
        courseId,
      };
    } catch (error) {
      return {
        success: false,
        url: page.url(),
        pageType,
        courseId,
        error: String(error),
      };
    }
  }

  // ----------------------------------------
  // Page Load Helpers
  // ----------------------------------------

  private async waitForPageLoad(pageType: CanvasPage): Promise<void> {
    const page = await this.getPage();

    const selectors: Record<CanvasPage, string[]> = {
      [CanvasPage.DASHBOARD]: ['.ic-DashboardCard', '#dashboard'],
      [CanvasPage.HOME]: ['.ic-Layout-contentMain', '#course_home_content'],
      [CanvasPage.SYLLABUS]: ['#syllabusTableBody', '.syllabus'],
      [CanvasPage.MODULES]: ['#context_modules', '.context_module'],
      [CanvasPage.ASSIGNMENTS]: ['.assignment-list', '.assignment_group', '#assignment_groups'],
      [CanvasPage.DISCUSSIONS]: ['.discussion-list', '.discussions-container'],
      [CanvasPage.ANNOUNCEMENTS]: ['.announcements-list', '.discussion-topic-list'],
      [CanvasPage.GRADES]: ['#grades_summary', '.student_grades'],
      [CanvasPage.FILES]: ['.ef-folder-content', '.files-container'],
      [CanvasPage.QUIZZES]: ['.quiz-list', '.quizzes-index'],
      [CanvasPage.PAGES]: ['.wiki-page-index', '.pages-container'],
      [CanvasPage.PEOPLE]: ['.roster', '#people'],
      [CanvasPage.CALENDAR]: ['#calendar-app', '.fc-view-container'],
    };

    const possibleSelectors = selectors[pageType];

    // Try each selector
    for (const selector of possibleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        return;
      } catch {
        continue;
      }
    }

    // If no selector matched, just wait a bit
    await page.waitForTimeout(1000);
  }

  async waitForFullLoad(): Promise<void> {
    const page = await this.getPage();

    // Wait for network to be idle
    await page.waitForLoadState('networkidle');

    // Wait for any loading indicators to disappear
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const checkLoading = () => {
          const loadingIndicators = document.querySelectorAll(
            '.loading, .ic-Loading, [aria-busy="true"]'
          );
          if (loadingIndicators.length === 0) {
            resolve();
          } else {
            setTimeout(checkLoading, 100);
          }
        };
        checkLoading();
      });
    });
  }

  async scrollToBottom(): Promise<void> {
    await this.browserManager.scrollToBottom();
  }

  async expandAllSections(): Promise<number> {
    return this.browserManager.expandCollapsedSections();
  }

  // ----------------------------------------
  // Content Checks
  // ----------------------------------------

  async getCurrentUrl(): Promise<string> {
    const page = await this.getPage();
    return page.url();
  }

  async getPageTitle(): Promise<string> {
    const page = await this.getPage();
    return page.title();
  }

  async isOnLoginPage(): Promise<boolean> {
    const page = await this.getPage();
    const url = page.url();

    if (url.includes('login') || url.includes('auth')) {
      return true;
    }

    const loginForm = await page.$('#login_form, .ic-Login');
    return loginForm !== null;
  }

  async hasAccessToPage(): Promise<boolean> {
    const page = await this.getPage();

    // Check for access denied messages
    const accessDenied = await page.$(
      '.access_denied, .unauthorized, [data-testid="flash-message-error"]'
    );

    return accessDenied === null;
  }

  // ----------------------------------------
  // Full Course Exploration
  // ----------------------------------------

  async exploreCourse(courseId: string): Promise<Map<CanvasPage, NavigationResult>> {
    const results = new Map<CanvasPage, NavigationResult>();

    const pagesToExplore = [
      CanvasPage.HOME,
      CanvasPage.SYLLABUS,
      CanvasPage.MODULES,
      CanvasPage.ASSIGNMENTS,
      CanvasPage.DISCUSSIONS,
      CanvasPage.ANNOUNCEMENTS,
      CanvasPage.QUIZZES,
    ];

    for (const pageType of pagesToExplore) {
      console.log(`[PageNavigator] Navigating to ${pageType} for course ${courseId}`);

      const result = await this.navigateToCoursePage(courseId, pageType);
      results.set(pageType, result);

      if (result.success) {
        // Scroll to load lazy content
        await this.scrollToBottom();
        // Expand collapsed sections
        await this.expandAllSections();
        // Wait for any dynamic content
        await this.waitForFullLoad();
      }
    }

    return results;
  }
}

// ============================================
// Export
// ============================================

export function createPageNavigator(browserManager: BrowserManager): PageNavigator {
  return new PageNavigator(browserManager);
}
