import { BaseJobAdapter, JobListing, ApplicationResult, Credentials, AdapterConfig } from './base-adapter';

// ============================================
// MBA Exchange Adapter
// ============================================

export class MBAExchangeAdapter extends BaseJobAdapter {
  readonly platform = 'MBAExchange';
  readonly loginUrl = 'https://www.mba-exchange.com/candidates/login.php';
  readonly jobSearchUrl = 'https://www.mba-exchange.com/candidates/opportunities.php';

  constructor(config: AdapterConfig = {}) {
    super(config);
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

      // Check if already logged in
      if (await this.isLoggedIn()) {
        console.log(`[${this.platform}Adapter] Already logged in`);
        return true;
      }

      // Wait for login form to be visible
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(1500);

      // Make sure Login Account tab is selected
      const loginTab = this.page.locator('button:has-text("Login Account")');
      if (await loginTab.count() > 0) {
        await loginTab.click();
        await this.page.waitForTimeout(500);
      }

      // Use JavaScript to find and fill visible input fields
      const email = credentials.email || credentials.username || '';
      const password = credentials.password || '';

      await this.page.evaluate(({ email, password }) => {
        // Find all email inputs and get the visible one
        const emailInputs = document.querySelectorAll('input[placeholder*="Email"], input[type="email"]');
        for (const input of emailInputs) {
          const el = input as HTMLInputElement;
          if (el.offsetParent !== null) { // Check if visible
            el.value = email;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          }
        }

        // Find visible password input
        const passwordInputs = document.querySelectorAll('input[type="password"], input[placeholder*="Password"]');
        for (const input of passwordInputs) {
          const el = input as HTMLInputElement;
          if (el.offsetParent !== null) { // Check if visible
            el.value = password;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          }
        }
      }, { email, password });

      await this.page.waitForTimeout(500);

      // Click the visible Log In button using JavaScript
      await this.page.evaluate(() => {
        const buttons = document.querySelectorAll('button[type="submit"]');
        for (const button of buttons) {
          const el = button as HTMLButtonElement;
          if (el.offsetParent !== null && el.textContent?.includes('Log In')) {
            el.click();
            break;
          }
        }
      });

      // Wait for navigation
      await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

      // Verify login success
      const loggedIn = await this.isLoggedIn();
      if (loggedIn) {
        console.log(`[${this.platform}Adapter] Login successful`);
        await this.saveSession();
        return true;
      } else {
        console.log(`[${this.platform}Adapter] Login failed - could not verify session`);
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

      // If we're on candidates pages (not login), we're logged in
      if (url.includes('/candidates/') && !url.includes('login')) {
        return true;
      }

      // Check for MBA Exchange specific logged-in indicators
      const loggedInIndicators = [
        'a[href*="logout"]',
        'a[href*="signout"]',
        '.navbar a[href*="candidates/"]',
        'a[href*="myAccount"]',
        'a[href*="opportunities"]',
      ];

      for (const selector of loggedInIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          return true;
        }
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

      // Navigate to opportunities page
      await this.page.goto(this.jobSearchUrl, { waitUntil: 'networkidle' });

      // Check if we were redirected to login
      const currentUrl = this.page.url();
      if (currentUrl.includes('login')) {
        throw new Error('Not logged in. Please login first.');
      }

      // Wait for page to load
      await this.page.waitForTimeout(2000);

      // MBA Exchange uses a list structure with links to jobDetail_p.php
      // Wait for job links to appear
      await this.page.waitForSelector('a[href*="jobDetail"], a[href*="sID="], li a', { timeout: 15000 }).catch(() => {
        console.log(`[${this.platform}Adapter] No job listings found or different selector needed`);
      });

      // Extract job listings - MBA Exchange uses <li><strong>Company</strong><a>Title</a></li> structure
      const jobs = await this.page.evaluate((searchQuery) => {
        const listings: any[] = [];

        // Find all job links
        const jobLinks = document.querySelectorAll('a[href*="jobDetail"], a[href*="sID="]');

        jobLinks.forEach((link) => {
          const anchor = link as HTMLAnchorElement;
          const title = anchor.textContent?.trim() || '';
          const href = anchor.href || '';

          // Extract job ID from URL
          const jobIdMatch = href.match(/sID=(\d+)/);
          const platformJobId = jobIdMatch ? jobIdMatch[1] : '';

          // Try to find company name - usually in <strong> before the link
          let company = '';
          const parent = anchor.parentElement;
          if (parent) {
            const strongEl = parent.querySelector('strong');
            if (strongEl) {
              company = strongEl.textContent?.trim() || '';
            }
          }

          // Filter by search query if provided
          const matchesQuery = !searchQuery ||
            title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            company.toLowerCase().includes(searchQuery.toLowerCase());

          if (title && matchesQuery) {
            listings.push({
              title,
              company,
              location: '', // MBA Exchange doesn't show location in list
              url: href,
              platformJobId,
            });
          }
        });

        return listings;
      }, query);

      // Remove duplicates based on platformJobId
      const uniqueJobs = jobs.filter((job, index, self) =>
        index === self.findIndex(j => j.platformJobId === job.platformJobId)
      );

      console.log(`[${this.platform}Adapter] Found ${uniqueJobs.length} jobs`);

      return uniqueJobs.map((job) => ({
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

  async getJobDetails(jobUrl: string): Promise<JobListing | null> {
    if (!this.page) {
      await this.initialize();
    }

    if (!this.page) throw new Error('Failed to initialize browser');

    try {
      console.log(`[${this.platform}Adapter] Getting job details: ${jobUrl}`);

      await this.page.goto(jobUrl, { waitUntil: 'networkidle' });

      const details = await this.page.evaluate(() => {
        const title = document.querySelector('.job-title, h1, [class*="title"]')?.textContent?.trim() || '';
        const company = document.querySelector('.company-name, .company, [class*="company"]')?.textContent?.trim() || '';
        const location = document.querySelector('.location, [class*="location"]')?.textContent?.trim() || '';
        const description = document.querySelector('.job-description, .description, [class*="description"]')?.textContent?.trim() || '';

        // Try to extract requirements
        const reqSection = document.querySelector('.requirements, .qualifications, [class*="requirement"]');
        const requirements: string[] = [];
        if (reqSection) {
          reqSection.querySelectorAll('li').forEach((li) => {
            const text = li.textContent?.trim();
            if (text) requirements.push(text);
          });
        }

        // Try to extract salary
        const salaryText = document.querySelector('.salary, [class*="salary"], [class*="compensation"]')?.textContent || '';
        const salaryMatch = salaryText.match(/\$?(\d+)[kK]?\s*[-–]\s*\$?(\d+)[kK]?/);
        let salaryMin, salaryMax;
        if (salaryMatch) {
          salaryMin = parseInt(salaryMatch[1]) * (salaryMatch[1].length <= 3 ? 1000 : 1);
          salaryMax = parseInt(salaryMatch[2]) * (salaryMatch[2].length <= 3 ? 1000 : 1);
        }

        return {
          title,
          company,
          location,
          description,
          requirements,
          salaryMin,
          salaryMax,
        };
      });

      return {
        ...details,
        url: jobUrl,
        platform: this.platform,
      };
    } catch (error) {
      console.error(`[${this.platform}Adapter] Get details error:`, error);
      return null;
    }
  }

  // ----------------------------------------
  // Job Application
  // ----------------------------------------

  async applyToJob(
    jobUrl: string,
    resumePath: string,
    coverLetter?: string,
    answers?: Record<string, string>
  ): Promise<ApplicationResult> {
    if (!this.page) {
      await this.initialize();
    }

    if (!this.page) throw new Error('Failed to initialize browser');

    try {
      console.log(`[${this.platform}Adapter] Applying to job: ${jobUrl}`);

      // Navigate to job page
      await this.page.goto(jobUrl, { waitUntil: 'networkidle' });

      // Find and click apply button
      const applyButtonSelectors = [
        'button:has-text("Apply")',
        'a:has-text("Apply")',
        '.apply-button',
        '[data-testid="apply-button"]',
        'button[class*="apply"]',
        'a[class*="apply"]',
      ];

      let applyButton = null;
      for (const selector of applyButtonSelectors) {
        applyButton = await this.page.$(selector);
        if (applyButton) break;
      }

      if (!applyButton) {
        return {
          success: false,
          message: 'Could not find apply button',
          screenshotPath: await this.takeScreenshot('no-apply-button'),
        };
      }

      await applyButton.click();
      await this.page.waitForLoadState('networkidle');

      // Handle application form
      // Upload resume
      const fileInputSelectors = [
        'input[type="file"][accept*="pdf"]',
        'input[type="file"][accept*="doc"]',
        'input[type="file"][name*="resume"]',
        'input[type="file"]',
      ];

      for (const selector of fileInputSelectors) {
        const fileInput = await this.page.$(selector);
        if (fileInput) {
          await fileInput.setInputFiles(resumePath);
          console.log(`[${this.platform}Adapter] Resume uploaded`);
          break;
        }
      }

      // Fill cover letter if present
      if (coverLetter) {
        const coverLetterSelectors = [
          'textarea[name*="cover"]',
          'textarea[name*="letter"]',
          '.cover-letter textarea',
          '#cover-letter',
        ];

        for (const selector of coverLetterSelectors) {
          const textarea = await this.page.$(selector);
          if (textarea) {
            await textarea.fill(coverLetter);
            console.log(`[${this.platform}Adapter] Cover letter filled`);
            break;
          }
        }
      }

      // Answer screening questions if provided
      if (answers) {
        for (const [question, answer] of Object.entries(answers)) {
          // Find question by text content
          const questionElements = await this.page.$$('label, .question');
          for (const qEl of questionElements) {
            const text = await qEl.textContent();
            if (text?.toLowerCase().includes(question.toLowerCase())) {
              // Find associated input
              const forAttr = await qEl.getAttribute('for');
              if (forAttr) {
                const input = await this.page.$(`#${forAttr}`);
                if (input) {
                  await input.fill(answer);
                }
              }
            }
          }
        }
      }

      // Take screenshot before submission
      const preSubmitScreenshot = await this.takeScreenshot('pre-submit');

      // Find and click submit button
      const submitButtonSelectors = [
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Apply")',
        'input[type="submit"]',
      ];

      let submitButton = null;
      for (const selector of submitButtonSelectors) {
        submitButton = await this.page.$(selector);
        if (submitButton) break;
      }

      if (!submitButton) {
        return {
          success: false,
          message: 'Could not find submit button',
          screenshotPath: preSubmitScreenshot,
        };
      }

      await submitButton.click();
      await this.page.waitForLoadState('networkidle');

      // Check for success message
      const successIndicators = [
        '.success-message',
        '.application-submitted',
        ':has-text("Application submitted")',
        ':has-text("Thank you for applying")',
        ':has-text("Application received")',
      ];

      let success = false;
      for (const selector of successIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          success = true;
          break;
        }
      }

      const finalScreenshot = await this.takeScreenshot(success ? 'application-success' : 'application-result');

      return {
        success,
        message: success ? 'Application submitted successfully' : 'Application may have been submitted - please verify',
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
let instance: MBAExchangeAdapter | null = null;

export function getMBAExchangeAdapter(config?: AdapterConfig): MBAExchangeAdapter {
  if (!instance) {
    instance = new MBAExchangeAdapter(config);
  }
  return instance;
}
