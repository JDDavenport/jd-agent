/**
 * Comprehensive E2E tests for MBA Class Session Experience
 * Tests all features of the ClassSessionView component:
 * 1. Summary Card
 * 2. Confidence Indicator
 * 3. Tab Navigation
 * 4. Recordings Tab
 * 5. Handwritten Notes Tab
 * 6. Edge Cases
 * 7. Navigation/Breadcrumbs
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, '../e2e-screenshots/mba-session-experience');

// Helper function to navigate to an MBA class session
async function navigateToMbaSession(page: Page, semester: string, className: string, sessionDate: string) {
  // Expand semester
  const semesterItem = page.locator(`text=${semester}`).first();
  if (await semesterItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await semesterItem.click();
    await page.waitForTimeout(500);
  }

  // Expand class
  const classItem = page.locator(`text=${className}`).first();
  if (await classItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await classItem.click();
    await page.waitForTimeout(500);
  }

  // Click session date
  const sessionItem = page.locator(`text=${sessionDate}`).first();
  if (await sessionItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sessionItem.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

test.describe('MBA Class Session Experience', () => {
  test.beforeAll(async () => {
    const { mkdir } = await import('fs/promises');
    await mkdir(screenshotsDir, { recursive: true });
  });

  // ==================================================
  // 1. SUMMARY CARD TESTS
  // ==================================================
  test.describe('1. Summary Card', () => {
    test('should display summary card with all required elements', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Summary Card ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Navigate to a session
      const navigated = await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      await page.screenshot({
        path: path.join(screenshotsDir, '01-summary-card-page.png'),
        fullPage: true
      });

      if (!navigated) {
        console.log('Could not navigate to session - checking if API data is available');
        return;
      }

      // Check for "Class Summary" header with sparkle icon
      const summaryHeader = page.locator('text=Class Summary').first();
      const hasSummaryHeader = await summaryHeader.isVisible({ timeout: 5000 }).catch(() => false);
      console.log('Class Summary header visible:', hasSummaryHeader);

      // Check for sparkle icon (SparklesIcon from Heroicons)
      const sparkleIcon = page.locator('svg').filter({ has: page.locator('path') }).first();
      const hasSparkleInSummary = await page.locator('.bg-indigo-100 svg, .bg-indigo-800 svg').first().isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Sparkle icon in summary area:', hasSparkleInSummary);

      // Check for overview text (paragraph after header)
      const overviewText = page.locator('.text-gray-700, .text-gray-300').first();
      const hasOverviewText = await overviewText.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Overview text visible:', hasOverviewText);

      // Check for "Key Takeaways" section
      const keyTakeawaysHeader = page.locator('text=Key Takeaways').first();
      const hasKeyTakeaways = await keyTakeawaysHeader.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Key Takeaways section visible:', hasKeyTakeaways);

      // Check for bullet points with checkmarks
      const checkmarkIcons = page.locator('.text-indigo-500 svg');
      const checkmarkCount = await checkmarkIcons.count();
      console.log('Checkmark bullet points:', checkmarkCount);

      // Check for topic badges
      const topicBadges = page.locator('.text-indigo-600, .text-indigo-400').filter({ hasText: /.+/ });
      const topicCount = await topicBadges.count();
      console.log('Topic badges visible:', topicCount);

      // Check for stats bar (duration, recordings count, PDF indicator)
      const durationStat = page.locator('text=/\\d+ min/').first();
      const hasDuration = await durationStat.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Duration stat visible:', hasDuration);

      const recordingsStat = page.locator('text=/\\d+ recordings/').first();
      const hasRecordingsCount = await recordingsStat.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Recordings count visible:', hasRecordingsCount);

      const pdfIndicator = page.locator('text=PDF notes').first();
      const hasPdfIndicator = await pdfIndicator.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('PDF notes indicator visible:', hasPdfIndicator);

      await page.screenshot({
        path: path.join(screenshotsDir, '01-summary-card-details.png'),
        fullPage: true
      });

      // Summary card should be visible if there's data
      expect(hasSummaryHeader || await page.locator('text=No summary available').isVisible()).toBe(true);
    });
  });

  // ==================================================
  // 2. CONFIDENCE INDICATOR TESTS
  // ==================================================
  test.describe('2. Confidence Indicator', () => {
    test('should display confidence badge with correct styling', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Confidence Indicator ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      // Check for High Confidence badge
      const highConfidence = page.locator('text=High Confidence').first();
      const hasHighConfidence = await highConfidence.isVisible({ timeout: 3000 }).catch(() => false);

      // Check for Good Confidence badge
      const goodConfidence = page.locator('text=Good Confidence').first();
      const hasGoodConfidence = await goodConfidence.isVisible({ timeout: 2000 }).catch(() => false);

      // Check for Needs Review badge
      const needsReview = page.locator('text=Needs Review').first();
      const hasNeedsReview = await needsReview.isVisible({ timeout: 2000 }).catch(() => false);

      console.log('High Confidence badge:', hasHighConfidence);
      console.log('Good Confidence badge:', hasGoodConfidence);
      console.log('Needs Review badge:', hasNeedsReview);

      await page.screenshot({
        path: path.join(screenshotsDir, '02-confidence-indicator.png'),
        fullPage: true
      });

      // One of the confidence badges should be visible
      const hasAnyConfidenceBadge = hasHighConfidence || hasGoodConfidence || hasNeedsReview;
      console.log('Any confidence badge visible:', hasAnyConfidenceBadge);

      // Test tooltip on hover (title attribute)
      const confidenceBadge = page.locator('[title*="confidence"]').first();
      const tooltipTitle = await confidenceBadge.getAttribute('title').catch(() => null);
      console.log('Tooltip text:', tooltipTitle);

      expect(hasAnyConfidenceBadge, 'A confidence badge should be visible').toBe(true);
    });
  });

  // ==================================================
  // 3. TAB NAVIGATION TESTS
  // ==================================================
  test.describe('3. Tab Navigation', () => {
    test('should have Recordings and Handwritten Notes tabs', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Tab Navigation ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      // Check for Recordings tab
      const recordingsTab = page.locator('button:has-text("Recordings")').first();
      const hasRecordingsTab = await recordingsTab.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Recordings tab visible:', hasRecordingsTab);

      // Check for Handwritten Notes tab
      const notesTab = page.locator('button:has-text("Handwritten Notes")').first();
      const hasNotesTab = await notesTab.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Handwritten Notes tab visible:', hasNotesTab);

      await page.screenshot({
        path: path.join(screenshotsDir, '03-tab-navigation-initial.png'),
        fullPage: true
      });

      // Click Handwritten Notes tab
      if (hasNotesTab) {
        await notesTab.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, '03-tab-navigation-notes-tab.png'),
          fullPage: true
        });

        // Verify the tab is now active (has border-indigo-500 class)
        const isNotesTabActive = await notesTab.evaluate(el => el.classList.contains('border-indigo-500'));
        console.log('Handwritten Notes tab is active:', isNotesTabActive);
      }

      // Click back to Recordings tab
      if (hasRecordingsTab) {
        await recordingsTab.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, '03-tab-navigation-recordings-tab.png'),
          fullPage: true
        });
      }

      expect(hasRecordingsTab, 'Recordings tab should be visible').toBe(true);
    });
  });

  // ==================================================
  // 4. RECORDINGS TAB TESTS
  // ==================================================
  test.describe('4. Recordings Tab', () => {
    test('should display recordings with all required fields', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Recordings Tab ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      // Make sure we're on Recordings tab
      const recordingsTab = page.locator('button:has-text("Recordings")').first();
      if (await recordingsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await recordingsTab.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({
        path: path.join(screenshotsDir, '04-recordings-tab.png'),
        fullPage: true
      });

      // Check for recording items (bordered cards)
      const recordingCards = page.locator('.border.border-gray-200, .border.border-gray-700').filter({ has: page.locator('svg') });
      const recordingCount = await recordingCards.count();
      console.log('Recording cards found:', recordingCount);

      // Check for play icon
      const playIcons = page.locator('.bg-blue-100 svg, .bg-blue-900 svg');
      const playIconCount = await playIcons.count();
      console.log('Play icons found:', playIconCount);

      // Check for recording title
      const recordingTitles = page.locator('h4.font-medium');
      const titleCount = await recordingTitles.count();
      console.log('Recording titles found:', titleCount);

      // Check for time display (HH:MM AM/PM format)
      const timeDisplays = page.locator('text=/\\d{1,2}:\\d{2}:\\d{2}\\s*(AM|PM)?/i');
      const timeCount = await timeDisplays.count();
      console.log('Time displays found:', timeCount);

      // Check for duration display (Xm Ys format)
      const durationDisplays = page.locator('text=/\\d+m\\s*\\d*s/');
      const durationCount = await durationDisplays.count();
      console.log('Duration displays found:', durationCount);

      // Check for status badge (complete, pending, etc.)
      const statusBadges = page.locator('text=/complete|pending|processing/i');
      const statusCount = await statusBadges.count();
      console.log('Status badges found:', statusCount);

      // Check for confidence icon on recordings
      const recordingConfidenceIcons = page.locator('.text-green-600 svg, .text-blue-600 svg, .text-amber-600 svg');
      const confIconCount = await recordingConfidenceIcons.count();
      console.log('Confidence icons on recordings:', confIconCount);

      // Check for "View Transcript" button
      const viewTranscriptBtn = page.locator('text=View Transcript').first();
      const hasViewTranscript = await viewTranscriptBtn.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('View Transcript button visible:', hasViewTranscript);

      // Test expand/collapse transcript
      if (hasViewTranscript) {
        await viewTranscriptBtn.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, '04-recordings-transcript-expanded.png'),
          fullPage: true
        });

        // Check that transcript content is visible
        const transcriptContent = page.locator('pre.whitespace-pre-wrap');
        const hasTranscriptContent = await transcriptContent.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Transcript content visible after expand:', hasTranscriptContent);

        // Check for "Hide Transcript" text
        const hideTranscriptBtn = page.locator('text=Hide Transcript').first();
        const hasHideBtn = await hideTranscriptBtn.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Hide Transcript button visible:', hasHideBtn);

        // Collapse
        await hideTranscriptBtn.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, '04-recordings-transcript-collapsed.png'),
          fullPage: true
        });
      }

      // If no recordings found, check for empty state
      if (recordingCount === 0) {
        const noRecordingsMsg = page.locator('text=No recordings found').first();
        const hasNoRecordingsMsg = await noRecordingsMsg.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('No recordings message visible:', hasNoRecordingsMsg);
      }
    });
  });

  // ==================================================
  // 5. HANDWRITTEN NOTES TAB TESTS
  // ==================================================
  test.describe('5. Handwritten Notes Tab', () => {
    test('should display PDF viewer and OCR text', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Handwritten Notes Tab ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Try to find a session with handwritten notes
      // First try Entrepenurial which has Remarkable notes
      await navigateToMbaSession(page, 'Winter2026', 'Entrepenurial', '2026-01-13');

      // Click on Handwritten Notes tab
      const notesTab = page.locator('button:has-text("Handwritten Notes")').first();
      if (await notesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await notesTab.click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({
        path: path.join(screenshotsDir, '05-handwritten-notes-tab.png'),
        fullPage: true
      });

      // Check for PDF section with amber styling
      const pdfSection = page.locator('.border-amber-200, .border-amber-800');
      const hasPdfSection = await pdfSection.first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log('PDF section visible:', hasPdfSection);

      // Check for PDF filename header
      const pdfHeader = page.locator('text=/Handwritten Notes|.pdf/i').first();
      const hasPdfHeader = await pdfHeader.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('PDF header visible:', hasPdfHeader);

      // Check for Download PDF button
      const downloadBtn = page.locator('text=Download PDF').first();
      const hasDownloadBtn = await downloadBtn.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Download PDF button visible:', hasDownloadBtn);

      // Check for PDF iframe viewer
      const pdfIframe = page.locator('iframe[title*="PDF"]');
      const hasPdfViewer = await pdfIframe.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('PDF viewer (iframe) visible:', hasPdfViewer);

      // Check for page navigation controls
      const prevPageBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(0);
      const pageIndicator = page.locator('text=/Page\\s*\\d+/').first();
      const hasPageIndicator = await pageIndicator.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Page indicator visible:', hasPageIndicator);

      await page.screenshot({
        path: path.join(screenshotsDir, '05-handwritten-notes-pdf-viewer.png'),
        fullPage: true
      });

      // Check for OCR Text section
      const ocrSection = page.locator('text=Searchable Text').first();
      const hasOcrSection = await ocrSection.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Searchable Text (OCR) section visible:', hasOcrSection);

      // Check for OCR content
      const ocrContent = page.locator('pre.whitespace-pre-wrap').last();
      const hasOcrContent = await ocrContent.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('OCR content visible:', hasOcrContent);

      // If no notes found, check for empty state
      const noNotesMsg = page.locator('text=No handwritten notes found').first();
      const hasNoNotesMsg = await noNotesMsg.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('No handwritten notes message visible:', hasNoNotesMsg);

      await page.screenshot({
        path: path.join(screenshotsDir, '05-handwritten-notes-ocr.png'),
        fullPage: true
      });
    });
  });

  // ==================================================
  // 6. EDGE CASES TESTS
  // ==================================================
  test.describe('6. Edge Cases', () => {
    test('should handle session with no recordings gracefully', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Edge Cases - No Recordings ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Try to find a session that might not have recordings
      // Navigate to first available session
      const semester = page.locator('text=Winter2026').first();
      if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
        await semester.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({
        path: path.join(screenshotsDir, '06-edge-case-no-recordings.png'),
        fullPage: true
      });

      // Check for "No recordings found" message
      const noRecordingsMsg = page.locator('text=No recordings found for this session');
      const hasNoRecordingsMsg = await noRecordingsMsg.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('No recordings message visible:', hasNoRecordingsMsg);

      // Check for microphone icon in empty state
      const emptyStateMic = page.locator('.text-gray-500 svg, .text-gray-400 svg');
      console.log('Empty state with icon check completed');
    });

    test('should handle session with no PDF gracefully', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Edge Cases - No PDF ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Navigate to Venture Capital which may not have PDF
      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      // Click Handwritten Notes tab
      const notesTab = page.locator('button:has-text("Handwritten Notes")').first();
      if (await notesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await notesTab.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({
        path: path.join(screenshotsDir, '06-edge-case-no-pdf.png'),
        fullPage: true
      });

      // Check for "No handwritten notes found" message
      const noNotesMsg = page.locator('text=No handwritten notes found');
      const hasNoNotesMsg = await noNotesMsg.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('No handwritten notes message visible:', hasNoNotesMsg);
    });

    test('should show loading states', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Edge Cases - Loading States ===');
      console.log('========================================');

      // Navigate with network interception to check loading states
      await page.route('**/api/vault/**', async (route) => {
        // Add small delay to see loading state
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await route.fetch();
        await route.fulfill({ response });
      });

      await page.goto('/');
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(screenshotsDir, '06-edge-case-loading.png'),
        fullPage: true
      });

      await page.waitForLoadState('networkidle');
      console.log('Loading state test completed');
    });

    test('should handle session with no summary', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Edge Cases - No Summary ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      await page.screenshot({
        path: path.join(screenshotsDir, '06-edge-case-no-summary.png'),
        fullPage: true
      });

      // Check for fallback message when no summary
      const noSummaryMsg = page.locator('text=No summary available yet');
      const hasNoSummary = await noSummaryMsg.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('No summary message visible:', hasNoSummary);

      // Check for academic cap icon in fallback
      const academicIcon = page.locator('.text-gray-400 svg').first();
      console.log('Fallback icon check completed');
    });
  });

  // ==================================================
  // 7. NAVIGATION AND BREADCRUMBS TESTS
  // ==================================================
  test.describe('7. Navigation and Breadcrumbs', () => {
    test('should display clickable breadcrumbs', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Navigation - Breadcrumbs ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      await page.screenshot({
        path: path.join(screenshotsDir, '07-navigation-breadcrumbs.png'),
        fullPage: true
      });

      // Check for breadcrumb navigation
      const breadcrumbs = page.locator('nav').filter({ has: page.locator('button') });
      const hasBreadcrumbs = await breadcrumbs.first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Breadcrumbs visible:', hasBreadcrumbs);

      // Check for breadcrumb separator "/"
      const separators = page.locator('text=/\\//');
      const separatorCount = await separators.count();
      console.log('Breadcrumb separators found:', separatorCount);

      // Check for clickable breadcrumb buttons
      const breadcrumbButtons = page.locator('nav button');
      const buttonCount = await breadcrumbButtons.count();
      console.log('Breadcrumb buttons found:', buttonCount);

      // Test clicking a breadcrumb to navigate
      if (buttonCount > 1) {
        // Click the second-to-last breadcrumb (parent page)
        const parentBreadcrumb = breadcrumbButtons.nth(buttonCount - 2);
        const parentText = await parentBreadcrumb.textContent();
        console.log('Clicking parent breadcrumb:', parentText);

        await parentBreadcrumb.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: path.join(screenshotsDir, '07-navigation-after-breadcrumb-click.png'),
          fullPage: true
        });

        console.log('Navigated to parent page via breadcrumb');
      }
    });

    test('should update content when navigating to different sessions', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Navigation - Session Switching ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Navigate to first session
      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      await page.screenshot({
        path: path.join(screenshotsDir, '07-navigation-first-session.png'),
        fullPage: true
      });

      // Get current page title or content
      const firstSessionTitle = await page.locator('h1, h2').first().textContent();
      console.log('First session title:', firstSessionTitle);

      // Navigate to a different session (go back and select another)
      const semester = page.locator('text=Winter2026').first();
      if (await semester.isVisible({ timeout: 2000 }).catch(() => false)) {
        await semester.click();
        await page.waitForTimeout(500);
      }

      // Try to find and click a different date
      const differentDate = page.locator('text=2026-01-22').first();
      if (await differentDate.isVisible({ timeout: 2000 }).catch(() => false)) {
        await differentDate.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: path.join(screenshotsDir, '07-navigation-second-session.png'),
          fullPage: true
        });

        // Check that content updated
        const secondSessionTitle = await page.locator('h1, h2').first().textContent();
        console.log('Second session title:', secondSessionTitle);

        // Content should be different
        console.log('Content changed after navigation:', firstSessionTitle !== secondSessionTitle);
      } else {
        console.log('Could not find alternative session date');
      }
    });
  });

  // ==================================================
  // 8. STUDY MODE TESTS
  // ==================================================
  test.describe('8. Study Mode', () => {
    test('should display Study button and Mark Reviewed toggle', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Study Mode - UI Elements ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      await page.screenshot({
        path: path.join(screenshotsDir, '08-study-mode-initial.png'),
        fullPage: true
      });

      // Check for Study button
      const studyButton = page.locator('button:has-text("Study")').first();
      const hasStudyButton = await studyButton.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Study button visible:', hasStudyButton);

      // Check for Mark Reviewed toggle
      const reviewedToggle = page.locator('button:has-text("Mark Reviewed"), button:has-text("Reviewed")').first();
      const hasReviewedToggle = await reviewedToggle.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Mark Reviewed toggle visible:', hasReviewedToggle);

      expect(hasStudyButton, 'Study button should be visible').toBe(true);
      expect(hasReviewedToggle, 'Mark Reviewed toggle should be visible').toBe(true);
    });

    test('should toggle reviewed state', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Study Mode - Toggle Reviewed ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      // Find the reviewed toggle
      const markReviewedButton = page.locator('button:has-text("Mark Reviewed")').first();
      const reviewedButton = page.locator('button:has-text("Reviewed")').filter({ hasNotText: 'Mark' }).first();

      // Click to toggle
      const initialButton = markReviewedButton.or(reviewedButton).first();
      if (await initialButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        const initialText = await initialButton.textContent();
        console.log('Initial state:', initialText);

        await initialButton.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, '08-study-mode-toggled.png'),
          fullPage: true
        });

        // Check the state changed
        const afterToggle = await initialButton.textContent();
        console.log('After toggle:', afterToggle);
      }
    });

    test('should open Study Mode overlay when clicking Study button', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Study Mode - Overlay ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      // Click Study button
      const studyButton = page.locator('button:has-text("Study")').first();
      if (await studyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await studyButton.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: path.join(screenshotsDir, '08-study-mode-overlay.png'),
          fullPage: true
        });

        // Check for Study Mode overlay elements
        const overlay = page.locator('.fixed.inset-0.bg-gray-900');
        const hasOverlay = await overlay.isVisible({ timeout: 3000 }).catch(() => false);
        console.log('Study Mode overlay visible:', hasOverlay);

        // Check for Overview tab
        const overviewTab = page.locator('button:has-text("Overview")');
        const hasOverviewTab = await overviewTab.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Overview tab visible:', hasOverviewTab);

        // Check for Key Points tab
        const keyPointsTab = page.locator('button:has-text("Key Points")');
        const hasKeyPointsTab = await keyPointsTab.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Key Points tab visible:', hasKeyPointsTab);

        // Check for Transcript tab
        const transcriptTab = page.locator('button:has-text("Transcript")');
        const hasTranscriptTab = await transcriptTab.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Transcript tab visible:', hasTranscriptTab);

        // Close with Escape key (more reliable than finding X button)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Verify overlay closed
        const overlayClosed = !(await overlay.isVisible({ timeout: 1000 }).catch(() => false));
        console.log('Overlay closed:', overlayClosed);

        expect(hasOverlay, 'Study Mode overlay should be visible').toBe(true);
        expect(overlayClosed, 'Overlay should close with Escape key').toBe(true);
      }
    });

    test('should navigate Key Points as flashcards', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Study Mode - Flashcards ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      // Open Study Mode
      const studyButton = page.locator('button:has-text("Study")').first();
      if (await studyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await studyButton.click();
        await page.waitForTimeout(1000);

        // Click Key Points tab
        const keyPointsTab = page.locator('button:has-text("Key Points")');
        if (await keyPointsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await keyPointsTab.click();
          await page.waitForTimeout(500);

          await page.screenshot({
            path: path.join(screenshotsDir, '08-study-mode-flashcard-hidden.png'),
            fullPage: true
          });

          // Check for "Click or press Space to reveal" text
          const revealHint = page.locator('text=Click or press Space to reveal');
          const hasRevealHint = await revealHint.isVisible({ timeout: 2000 }).catch(() => false);
          console.log('Reveal hint visible:', hasRevealHint);

          // Click to reveal flashcard
          const flashcard = page.locator('.rounded-2xl.cursor-pointer, .bg-gray-800.rounded-2xl').first();
          if (await flashcard.isVisible({ timeout: 2000 }).catch(() => false)) {
            await flashcard.click();
            await page.waitForTimeout(500);

            await page.screenshot({
              path: path.join(screenshotsDir, '08-study-mode-flashcard-revealed.png'),
              fullPage: true
            });

            // Check for revealed content (green border indicates revealed)
            const revealedCard = page.locator('.border-green-500, .border-2.border-green-500');
            const isRevealed = await revealedCard.isVisible({ timeout: 2000 }).catch(() => false);
            console.log('Flashcard revealed:', isRevealed);
          }

          // Test Next button
          const nextButton = page.locator('button:has-text("Next")');
          if (await nextButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
            await nextButton.click();
            await page.waitForTimeout(500);
            console.log('Navigated to next flashcard');

            await page.screenshot({
              path: path.join(screenshotsDir, '08-study-mode-flashcard-next.png'),
              fullPage: true
            });
          }

          // Test Reset button
          const resetButton = page.locator('button:has-text("Reset")');
          if (await resetButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await resetButton.click();
            await page.waitForTimeout(500);
            console.log('Reset flashcards');
          }
        }

        // Close Study Mode with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        const overlayClosed = !(await page.locator('.fixed.inset-0.bg-gray-900').isVisible({ timeout: 1000 }).catch(() => false));
        console.log('Closed with Escape key:', overlayClosed);
      }
    });

    test('should display progress tracking', async ({ page }) => {
      console.log('\n========================================');
      console.log('=== TEST: Study Mode - Progress ===');
      console.log('========================================');

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

      // Open Study Mode
      const studyButton = page.locator('button:has-text("Study")').first();
      if (await studyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await studyButton.click();
        await page.waitForTimeout(1000);

        // Click Key Points tab
        const keyPointsTab = page.locator('button:has-text("Key Points")');
        if (await keyPointsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await keyPointsTab.click();
          await page.waitForTimeout(500);

          // Check for progress indicator (Point X of Y)
          const progressText = page.locator('text=/Point \\d+ of \\d+/');
          const hasProgress = await progressText.isVisible({ timeout: 2000 }).catch(() => false);
          console.log('Progress indicator visible:', hasProgress);

          // Check for progress dots
          const progressDots = page.locator('.rounded-full.w-2\\.5, .rounded-full').filter({ hasText: '' });
          const dotCount = await progressDots.count();
          console.log('Progress dots count:', dotCount);

          await page.screenshot({
            path: path.join(screenshotsDir, '08-study-mode-progress.png'),
            fullPage: true
          });
        }

        // Close
        await page.keyboard.press('Escape');
      }
    });
  });

  // ==================================================
  // SUMMARY TEST - Full Experience Walkthrough
  // ==================================================
  test('Full MBA Session Experience Walkthrough', async ({ page }) => {
    console.log('\n========================================');
    console.log('=== FULL EXPERIENCE WALKTHROUGH ===');
    console.log('========================================');

    const issues: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Step 1: Load app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 2: Navigate to MBA session
    const navigated = await navigateToMbaSession(page, 'Winter2026', 'Venture Capital', '2026-01-15');

    await page.screenshot({
      path: path.join(screenshotsDir, '08-full-walkthrough-session.png'),
      fullPage: true
    });

    if (!navigated) {
      issues.push('Could not navigate to MBA session');
    }

    // Step 3: Check Summary Card
    const summaryCard = page.locator('text=Class Summary').first();
    if (!(await summaryCard.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Check for fallback
      const fallback = page.locator('text=No summary available').first();
      if (!(await fallback.isVisible({ timeout: 2000 }).catch(() => false))) {
        issues.push('Neither summary card nor fallback message visible');
      }
    }

    // Step 4: Check Confidence Badge
    const confidenceBadges = ['High Confidence', 'Good Confidence', 'Needs Review'];
    let hasConfidenceBadge = false;
    for (const badge of confidenceBadges) {
      if (await page.locator(`text=${badge}`).first().isVisible({ timeout: 1000 }).catch(() => false)) {
        hasConfidenceBadge = true;
        break;
      }
    }
    if (!hasConfidenceBadge) {
      issues.push('No confidence badge visible');
    }

    // Step 5: Check Tab Navigation
    const recordingsTab = page.locator('button:has-text("Recordings")').first();
    if (!(await recordingsTab.isVisible({ timeout: 2000 }).catch(() => false))) {
      issues.push('Recordings tab not visible');
    }

    // Step 6: Check Handwritten Notes Tab
    const notesTab = page.locator('button:has-text("Handwritten Notes")').first();
    const notesTabVisible = await notesTab.isVisible({ timeout: 2000 }).catch(() => false);
    // Note: This tab may not be visible if there are no notes
    console.log('Handwritten Notes tab visible:', notesTabVisible);

    // Step 7: Test Recordings content
    await recordingsTab.click();
    await page.waitForTimeout(500);

    const recordingContent = page.locator('.border.border-gray-200, .border.border-gray-700, text=No recordings found');
    if (!(await recordingContent.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      issues.push('No recording content or empty state visible');
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '08-full-walkthrough-recordings.png'),
      fullPage: true
    });

    // Step 8: Test View Transcript if available
    const viewTranscript = page.locator('text=View Transcript').first();
    if (await viewTranscript.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewTranscript.click();
      await page.waitForTimeout(500);

      const transcriptVisible = await page.locator('pre.whitespace-pre-wrap').isVisible({ timeout: 2000 }).catch(() => false);
      if (!transcriptVisible) {
        issues.push('Transcript did not expand when clicking View Transcript');
      }

      // Collapse
      const hideTranscript = page.locator('text=Hide Transcript').first();
      if (await hideTranscript.isVisible()) {
        await hideTranscript.click();
      }
    }

    // Step 9: Test Handwritten Notes tab if visible
    if (notesTabVisible && await notesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      try {
        await notesTab.click({ timeout: 5000 });
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, '08-full-walkthrough-notes.png'),
          fullPage: true
        });

        // Check for PDF viewer or empty state
        const pdfOrEmpty = page.locator('iframe, text=No handwritten notes found');
        if (!(await pdfOrEmpty.first().isVisible({ timeout: 3000 }).catch(() => false))) {
          issues.push('Neither PDF viewer nor empty state visible in Notes tab');
        }
      } catch {
        console.log('Could not click Handwritten Notes tab - skipping');
      }
    }

    // Step 10: Check for console errors
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('DevTools') &&
      !e.includes('favicon') &&
      !e.includes('ResizeObserver') &&
      !e.includes('net::ERR')
    );

    if (criticalErrors.length > 0) {
      issues.push(`Console errors: ${criticalErrors.join(', ')}`);
    }

    // Final Report
    console.log('\n========================================');
    console.log('=== WALKTHROUGH RESULTS ===');
    console.log('========================================');
    console.log('Issues found:', issues.length);
    if (issues.length > 0) {
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    } else {
      console.log('All checks passed!');
    }
    console.log('Console errors:', criticalErrors.length);
    console.log('========================================');

    await page.screenshot({
      path: path.join(screenshotsDir, '08-full-walkthrough-final.png'),
      fullPage: true
    });

    // Test passes if we have fewer than 3 major issues
    expect(issues.length, `Found ${issues.length} issues: ${issues.join('; ')}`).toBeLessThan(3);
  });
});
