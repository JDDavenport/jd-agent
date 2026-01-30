import { BaseJobAdapter, JobListing, ApplicationResult, Credentials, AdapterConfig } from './base-adapter';

// ============================================
// LinkedIn Adapter
// ============================================

export class LinkedInAdapter extends BaseJobAdapter {
  readonly platform = 'LinkedIn';
  readonly loginUrl = 'https://www.linkedin.com/login';
  readonly jobSearchUrl = 'https://www.linkedin.com/jobs/search/';

  constructor(config: AdapterConfig = {}) {
    super({
      ...config,
      // LinkedIn is more sensitive to automation, use slower interactions
      slowMo: config.slowMo ?? 100,
    });
  }

  // ----------------------------------------
  // Authentication
  // ----------------------------------------

  async login(credentials: Credentials): Promise<boolean> {
    if (!this.page) {
      await this.initialize();
    }

    if (!this.page) throw new Error('Failed to initialize browser');

    try {
      console.log(`[${this.platform}Adapter] Navigating to login page...`);
      await this.page.goto(this.loginUrl, { waitUntil: 'networkidle' });

      // Check if already logged in (might redirect to feed)
      if (await this.isLoggedIn()) {
        console.log(`[${this.platform}Adapter] Already logged in`);
        return true;
      }

      // Wait for login form
      await this.page.waitForSelector('#username, input[name="session_key"], input[autocomplete="username"]', { timeout: 10000 });
      await this.page.waitForTimeout(1000);

      const email = credentials.email || credentials.username || '';
      const password = credentials.password || '';

      // Clear and type into email field using keyboard
      const emailInput = await this.page.$('#username') ||
                         await this.page.$('input[name="session_key"]') ||
                         await this.page.$('input[autocomplete="username"]');
      if (emailInput) {
        await emailInput.click();
        await emailInput.fill('');
        await emailInput.type(email, { delay: 50 });
        console.log(`[${this.platform}Adapter] Email entered`);
      }

      await this.page.waitForTimeout(300);

      // Clear and type into password field
      const passwordInput = await this.page.$('#password') ||
                           await this.page.$('input[name="session_password"]') ||
                           await this.page.$('input[type="password"]');
      if (passwordInput) {
        await passwordInput.click();
        await passwordInput.fill('');
        await passwordInput.type(password, { delay: 50 });
        console.log(`[${this.platform}Adapter] Password entered`);
      }

      await this.page.waitForTimeout(500);

      // Click login button
      await this.page.click('button[type="submit"], button[data-litms-control-urn="login-submit"]');

      // Wait for navigation - might have security challenges
      await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {
        console.log(`[${this.platform}Adapter] Navigation timeout - checking for challenges`);
      });

      // Check for security challenge (CAPTCHA, verification, etc.)
      const challengeIndicators = [
        '.challenge-dialog',
        '[data-test-id="challenge"]',
        '#captcha',
        '.security-verification',
        'input[name="pin"]',
      ];

      for (const selector of challengeIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          console.log(`[${this.platform}Adapter] Security challenge detected - manual intervention required`);
          await this.takeScreenshot('security-challenge');

          // Wait for user to complete challenge (if running in headed mode)
          if (!this.config.headless) {
            console.log(`[${this.platform}Adapter] Waiting 60 seconds for manual challenge completion...`);
            await this.page.waitForTimeout(60000);
          } else {
            return false;
          }
        }
      }

      // Verify login success
      const loggedIn = await this.isLoggedIn();
      if (loggedIn) {
        console.log(`[${this.platform}Adapter] Login successful`);
        await this.saveSession();
        return true;
      } else {
        console.log(`[${this.platform}Adapter] Login failed`);
        await this.takeScreenshot('login-failed');
        return false;
      }
    } catch (error) {
      console.error(`[${this.platform}Adapter] Login error:`, error);
      await this.takeScreenshot('login-error');
      return false;
    }
  }

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      const url = this.page.url();

      // If we're on authenticated pages
      if (url.includes('/feed') || url.includes('/in/') || url.includes('/mynetwork') ||
          url.includes('/jobs/search') || url.includes('/jobs/collections')) {
        return true;
      }

      // Check for profile icon or menu - try multiple selectors for current LinkedIn UI
      const loggedInIndicators = [
        '.global-nav__me',
        '.global-nav__me-photo',
        '[data-control-name="identity_welcome_message"]',
        '.nav-item__profile-member-photo',
        'img.global-nav__me-photo',
        '.feed-identity-module',
        'button[aria-label*="Account"]',
        '[data-test-id="nav-item-my-network"]',
        '.msg-overlay-bubble-header',
        'img[alt*="Photo of"]',
      ];

      for (const selector of loggedInIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          console.log(`[${this.platform}Adapter] Found logged-in indicator: ${selector}`);
          return true;
        }
      }

      // Also check if we can see job results (means we're logged in)
      const jobResults = await this.page.$('[data-job-id], .jobs-search-results');
      if (jobResults) {
        console.log(`[${this.platform}Adapter] Found job results - user is logged in`);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ----------------------------------------
  // Job Search
  // ----------------------------------------

  async searchJobs(query: string, filters?: Record<string, string>): Promise<JobListing[]> {
    if (!this.page) {
      await this.initialize();
    }

    if (!this.page) throw new Error('Failed to initialize browser');

    try {
      console.log(`[${this.platform}Adapter] Searching for jobs: ${query}`);

      // Build search URL
      const searchUrl = new URL(this.jobSearchUrl);
      searchUrl.searchParams.set('keywords', query);

      if (filters) {
        // LinkedIn uses specific parameter names
        if (filters.location) searchUrl.searchParams.set('location', filters.location);
        if (filters.remote === 'true') searchUrl.searchParams.set('f_WT', '2'); // Remote filter
        if (filters.easyApply === 'true') searchUrl.searchParams.set('f_AL', 'true'); // Easy Apply filter
      }

      // Navigate to search URL and check if we get redirected to login
      await this.page.goto(searchUrl.toString(), { waitUntil: 'networkidle' });

      // Check if we were redirected to login page
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
        throw new Error('Not logged in. Please login first.');
      }

      // Wait for job listings - try multiple possible selectors
      await this.page.waitForSelector('[data-job-id], .jobs-search-results__list-item, .scaffold-layout__list-item', { timeout: 15000 }).catch(() => {
        console.log(`[${this.platform}Adapter] Job listings may not have loaded`);
      });

      // Scroll to load more jobs
      await this.page.evaluate(() => {
        const scrollContainer = document.querySelector('.jobs-search-results-list') || document.body;
        scrollContainer.scrollTo(0, scrollContainer.scrollHeight);
      });
      await this.page.waitForTimeout(2000);

      // Extract job listings using multiple selector strategies
      const jobs = await this.page.evaluate(() => {
        const listings: any[] = [];

        // Try multiple selectors for job cards
        const jobCards = document.querySelectorAll(
          '[data-job-id], .jobs-search-results__list-item, .scaffold-layout__list-item, li.ember-view.occludable-update'
        );

        console.log('Found job cards:', jobCards.length);

        jobCards.forEach((card: Element) => {
          // Try multiple selectors for each field
          const titleEl = card.querySelector('a[class*="job-card"] strong, .job-card-list__title, a.job-card-container__link, [class*="job-card"] a') as HTMLElement;
          const companyEl = card.querySelector('[class*="company-name"], .artdeco-entity-lockup__subtitle, [class*="primary-description"]') as HTMLElement;
          const locationEl = card.querySelector('[class*="job-card"][class*="metadata"], .artdeco-entity-lockup__caption, [class*="location"]') as HTMLElement;
          const linkEl = card.querySelector('a[href*="/jobs/view/"]') as HTMLAnchorElement;

          // Also try getting job ID from data attribute
          const jobId = card.getAttribute('data-job-id') || '';

          const title = titleEl?.textContent?.trim() || '';
          const href = linkEl?.href || '';
          const jobIdMatch = href.match(/\/jobs\/view\/(\d+)/);

          if (title || jobId) {
            listings.push({
              title: title,
              company: companyEl?.textContent?.trim() || '',
              location: locationEl?.textContent?.trim() || '',
              url: href || (jobId ? `https://www.linkedin.com/jobs/view/${jobId}` : ''),
              platformJobId: jobIdMatch ? jobIdMatch[1] : jobId,
            });
          }
        });

        return listings;
      });

      console.log(`[${this.platform}Adapter] Found ${jobs.length} jobs`);

      return jobs.map((job) => ({
        ...job,
        platform: this.platform,
      }));
    } catch (error) {
      console.error(`[${this.platform}Adapter] Search error:`, error);
      await this.takeScreenshot('search-error');
      return [];
    }
  }

  // ----------------------------------------
  // Job Details
  // ----------------------------------------

  async getJobDetails(jobIdOrUrl: string): Promise<JobListing | null> {
    if (!this.page) {
      await this.initialize();
    }

    if (!this.page) throw new Error('Failed to initialize browser');

    try {
      // Build job URL
      const jobUrl = jobIdOrUrl.includes('linkedin.com')
        ? jobIdOrUrl
        : `https://www.linkedin.com/jobs/view/${jobIdOrUrl}`;

      console.log(`[${this.platform}Adapter] Getting job details: ${jobUrl}`);

      await this.page.goto(jobUrl, { waitUntil: 'networkidle' });

      // Wait for job details to load
      await this.page.waitForSelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card', { timeout: 15000 });

      const details = await this.page.evaluate(() => {
        const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title')?.textContent?.trim() || '';
        const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.textContent?.trim() || '';
        const location = document.querySelector('.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet')?.textContent?.trim() || '';

        // Get full description
        const descriptionEl = document.querySelector('.jobs-description__content, .jobs-description-content');
        const description = descriptionEl?.textContent?.trim() || '';

        // Check for Easy Apply
        const hasEasyApply = !!document.querySelector('.jobs-apply-button--top-card, button[data-control-name="jobdetails_topcard_inapply"]');

        // Try to extract requirements from description
        const requirements: string[] = [];
        const listItems = descriptionEl?.querySelectorAll('li');
        listItems?.forEach((li: Element) => {
          const text = li.textContent?.trim();
          if (text && text.length < 500) {
            requirements.push(text);
          }
        });

        return {
          title,
          company,
          location,
          description,
          requirements: requirements.slice(0, 20), // Limit to 20 items
          hasEasyApply,
        };
      });

      // Extract job ID from URL
      const jobIdMatch = jobUrl.match(/\/jobs\/view\/(\d+)/);
      const platformJobId = jobIdMatch ? jobIdMatch[1] : '';

      return {
        ...details,
        url: jobUrl,
        platform: this.platform,
        platformJobId,
      };
    } catch (error) {
      console.error(`[${this.platform}Adapter] Get details error:`, error);
      return null;
    }
  }

  // ----------------------------------------
  // Job Application (Easy Apply)
  // ----------------------------------------

  async applyToJob(
    jobIdOrUrl: string,
    resumePath: string,
    coverLetter?: string,
    answers?: Record<string, string>
  ): Promise<ApplicationResult> {
    if (!this.page) {
      await this.initialize();
    }

    if (!this.page) throw new Error('Failed to initialize browser');

    try {
      const jobUrl = jobIdOrUrl.includes('linkedin.com')
        ? jobIdOrUrl
        : `https://www.linkedin.com/jobs/view/${jobIdOrUrl}`;

      console.log(`[${this.platform}Adapter] Applying to job: ${jobUrl}`);

      await this.page.goto(jobUrl, { waitUntil: 'networkidle' });

      // Wait for Easy Apply button
      const easyApplyButton = await this.page.waitForSelector(
        '.jobs-apply-button, button[data-control-name="jobdetails_topcard_inapply"]',
        { timeout: 10000 }
      ).catch(() => null);

      if (!easyApplyButton) {
        // Check if it's an external application
        const externalApplyButton = await this.page.$('a[data-control-name="jobdetails_topcard_apply"]');
        if (externalApplyButton) {
          return {
            success: false,
            message: 'This job requires external application. Easy Apply not available.',
            screenshotPath: await this.takeScreenshot('external-apply'),
          };
        }

        return {
          success: false,
          message: 'Could not find apply button',
          screenshotPath: await this.takeScreenshot('no-apply-button'),
        };
      }

      await easyApplyButton.click();
      await this.page.waitForTimeout(2000);

      // Handle multi-step application
      let stepCount = 0;
      const maxSteps = 10;

      while (stepCount < maxSteps) {
        stepCount++;
        console.log(`[${this.platform}Adapter] Processing application step ${stepCount}`);

        // Check for resume upload
        const resumeInput = await this.page.$('input[type="file"][name*="resume"], input[type="file"][accept*="pdf"]');
        if (resumeInput) {
          await resumeInput.setInputFiles(resumePath);
          console.log(`[${this.platform}Adapter] Resume uploaded`);
          await this.page.waitForTimeout(1000);
        }

        // Fill text inputs
        const textInputs = await this.page.$$('input[type="text"]:not([readonly]), textarea:not([readonly])');
        for (const input of textInputs) {
          const isEmpty = await input.evaluate((el: HTMLInputElement) => !el.value);
          if (isEmpty && answers) {
            const label = await input.evaluate((el) => {
              const labelEl = document.querySelector(`label[for="${el.id}"]`);
              return labelEl?.textContent?.trim() || '';
            });

            // Find matching answer
            for (const [question, answer] of Object.entries(answers)) {
              if (label.toLowerCase().includes(question.toLowerCase())) {
                await input.fill(answer);
                break;
              }
            }
          }
        }

        // Handle dropdowns/selects
        const selects = await this.page.$$('select');
        for (const select of selects) {
          // Select first non-empty option if not already selected
          await select.evaluate((el: HTMLSelectElement) => {
            if (!el.value && el.options.length > 1) {
              el.value = el.options[1].value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }

        // Handle radio buttons - select first option if none selected
        const radioGroups = await this.page.$$('[role="radiogroup"]');
        for (const group of radioGroups) {
          const hasSelected = await group.$('input[type="radio"]:checked');
          if (!hasSelected) {
            const firstRadio = await group.$('input[type="radio"]');
            if (firstRadio) {
              await firstRadio.click();
            }
          }
        }

        // Look for Next or Submit button
        const nextButton = await this.page.$('button[aria-label="Continue to next step"], button[data-control-name="continue_unify"]');
        const submitButton = await this.page.$('button[aria-label="Submit application"], button[data-control-name="submit_unify"]');

        if (submitButton) {
          // Final step - submit
          await this.takeScreenshot('pre-submit');
          await submitButton.click();
          await this.page.waitForTimeout(3000);
          break;
        } else if (nextButton) {
          await nextButton.click();
          await this.page.waitForTimeout(2000);
        } else {
          // Check for done/close
          const doneButton = await this.page.$('button[aria-label="Done"], button[aria-label="Dismiss"]');
          if (doneButton) {
            await doneButton.click();
            break;
          }

          // No more steps found
          console.log(`[${this.platform}Adapter] No more steps found`);
          break;
        }
      }

      // Check for success
      await this.page.waitForTimeout(2000);
      const successModal = await this.page.$('[data-test-modal-id="post-apply-modal"], .post-apply-modal');
      const success = !!successModal || (await this.page.content()).includes('Application submitted');

      const finalScreenshot = await this.takeScreenshot(success ? 'application-success' : 'application-result');

      // Close any modals
      const dismissButton = await this.page.$('button[aria-label="Dismiss"], button[data-test-modal-close-btn]');
      if (dismissButton) {
        await dismissButton.click();
      }

      return {
        success,
        message: success ? 'Easy Apply application submitted successfully' : 'Application may have been submitted - please verify',
        screenshotPath: finalScreenshot,
      };
    } catch (error) {
      console.error(`[${this.platform}Adapter] Application error:`, error);
      const errorScreenshot = await this.takeScreenshot('application-error');
      return {
        success: false,
        message: `Application failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        screenshotPath: errorScreenshot,
        errors: [String(error)],
      };
    }
  }
}

// Export singleton factory
let instance: LinkedInAdapter | null = null;

export function getLinkedInAdapter(config?: AdapterConfig): LinkedInAdapter {
  if (!instance) {
    instance = new LinkedInAdapter(config);
  }
  return instance;
}
