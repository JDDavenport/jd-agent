/**
 * Test Helpers for Weekly Planning E2E Tests
 */

import { Page } from '@playwright/test';

export const BASE_URL = process.env.TEST_USE_DEV_SERVER ? 'http://localhost:5173' : 'http://localhost:5174';
export const API_URL = 'http://localhost:3000';

export interface TestTask {
  id: string;
  title: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  taskLabels?: string[];
  priority?: number;
  timeEstimateMinutes?: number;
}

/**
 * Navigate to weekly planning page and wait for it to load
 */
export async function navigateToWeeklyPlanning(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/weekly-planning`);
  await page.waitForLoadState('networkidle');
  // Wait for calendar grid to be visible
  await page.waitForSelector('[class*="bg-slate-900"][class*="rounded-lg"]', { timeout: 10000 });
  await page.waitForTimeout(1000); // Extra time for data loading
}

/**
 * Create a task in the weekly backlog via API
 */
export async function createBacklogTask(
  page: Page,
  title: string,
  options: { priority?: number; timeEstimate?: number } = {}
): Promise<TestTask> {
  const response = await page.request.post(`${API_URL}/api/tasks`, {
    data: {
      title,
      source: 'manual',
      context: 'planning',
      taskLabels: ['weekly-backlog'],
      priority: options.priority || 2,
      timeEstimateMinutes: options.timeEstimate || 30,
    },
  });
  const data = await response.json();
  return data.data;
}

/**
 * Unschedule a task via API
 */
export async function unscheduleTask(page: Page, taskId: string): Promise<void> {
  await page.request.post(`${API_URL}/api/tasks/${taskId}/unschedule`);
}

/**
 * Schedule a task via API
 */
export async function scheduleTask(
  page: Page,
  taskId: string,
  startTime: string,
  endTime: string
): Promise<void> {
  await page.request.post(`${API_URL}/api/tasks/${taskId}/schedule`, {
    data: { startTime, endTime },
  });
}

/**
 * Complete a task via API
 */
export async function completeTask(page: Page, taskId: string): Promise<void> {
  await page.request.post(`${API_URL}/api/tasks/${taskId}/complete`);
}

/**
 * Delete a task via API
 */
export async function deleteTask(page: Page, taskId: string): Promise<void> {
  await page.request.delete(`${API_URL}/api/tasks/${taskId}`);
}

/**
 * Get all tasks with weekly-backlog label
 */
export async function getBacklogTasks(page: Page): Promise<TestTask[]> {
  const response = await page.request.get(
    `${API_URL}/api/tasks?label=weekly-backlog&includeCompleted=false&limit=100`
  );
  const data = await response.json();
  return data.data || [];
}

/**
 * Get scheduled tasks for this week
 */
export async function getScheduledTasksThisWeek(page: Page): Promise<TestTask[]> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dayOfWeek);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const startDate = sunday.toISOString().split('T')[0];
  const endDate = saturday.toISOString().split('T')[0];

  const response = await page.request.get(
    `${API_URL}/api/tasks?includeCompleted=false&limit=500`
  );
  const data = await response.json();

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return (data.data || []).filter((t: TestTask) => {
    if (!t.scheduledStart) return false;
    const scheduledDate = new Date(t.scheduledStart);
    return scheduledDate >= start && scheduledDate <= end;
  });
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 2000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Get current week date range
 */
export function getCurrentWeekRange(): { start: Date; end: Date; startStr: string; endStr: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  return {
    start: sunday,
    end: saturday,
    startStr: formatDateISO(sunday),
    endStr: formatDateISO(saturday),
  };
}

/**
 * Format date as ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date-time as ISO string with time
 */
export function formatDateTimeISO(date: Date): string {
  return date.toISOString();
}

/**
 * Create a date-time for a specific day and time this week
 * @param dayIndex 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 * @param hour Hour in 24-hour format
 * @param minute Minute
 */
export function getWeekDateTime(dayIndex: number, hour: number, minute: number = 0): Date {
  const { start } = getCurrentWeekRange();
  const targetDate = new Date(start);
  targetDate.setDate(start.getDate() + dayIndex);
  targetDate.setHours(hour, minute, 0, 0);
  return targetDate;
}

/**
 * Take a screenshot with a standardized path
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
): Promise<void> {
  await page.screenshot({
    path: `screenshots/weekly-planning/${name}.png`,
    fullPage: options?.fullPage ?? false,
  });
}

/**
 * Get the calendar grid layout information for accurate positioning
 */
export async function getCalendarLayout(page: Page): Promise<{
  timeLabelsBox: { x: number; y: number; width: number; height: number };
  headerBox: { x: number; y: number; width: number; height: number };
  DAY_WIDTH: number;
  HOUR_HEIGHT: number;
  START_HOUR: number;
}> {
  const timeLabels = page.locator('.w-14.flex-shrink-0.bg-slate-900').first();
  const timeBox = await timeLabels.boundingBox();
  if (!timeBox) throw new Error('Could not get time labels bounding box');

  const dayHeader = page.locator('.sticky.top-0.z-10.flex.bg-slate-800');
  const headerBox = await dayHeader.boundingBox();
  if (!headerBox) throw new Error('Could not get day header bounding box');

  return {
    timeLabelsBox: timeBox,
    headerBox,
    DAY_WIDTH: 140,
    HOUR_HEIGHT: 48,
    START_HOUR: 6,
  };
}

/**
 * Calculate the target coordinates for a specific day and time in the Tasks column
 * @param layout Calendar layout from getCalendarLayout
 * @param dayIndex 0 = first visible day, 1 = second day, etc.
 * @param hour Hour in 24-hour format (6-22)
 * @param minute Minute (0, 15, 30, 45)
 */
export function getTasksColumnCoordinates(
  layout: Awaited<ReturnType<typeof getCalendarLayout>>,
  dayIndex: number,
  hour: number,
  minute: number = 0
): { x: number; y: number } {
  const { timeLabelsBox, headerBox, DAY_WIDTH, HOUR_HEIGHT, START_HOUR } = layout;

  // X position: time labels right edge + day offset + middle of Tasks column
  // Tasks column is the right half of each day column (70-140px within 140px day)
  const x = timeLabelsBox.x + timeLabelsBox.width + (dayIndex * DAY_WIDTH) + 70 + 35;

  // Y position: header bottom + time offset
  const hoursFromStart = hour - START_HOUR + minute / 60;
  const y = headerBox.y + headerBox.height + (hoursFromStart * HOUR_HEIGHT);

  return { x, y };
}

/**
 * Calculate the target coordinates for a specific day and time in the Events column
 */
export function getEventsColumnCoordinates(
  layout: Awaited<ReturnType<typeof getCalendarLayout>>,
  dayIndex: number,
  hour: number,
  minute: number = 0
): { x: number; y: number } {
  const { timeLabelsBox, headerBox, DAY_WIDTH, HOUR_HEIGHT, START_HOUR } = layout;

  // X position: time labels right edge + day offset + middle of Events column
  // Events column is the left half of each day column (0-70px within 140px day)
  const x = timeLabelsBox.x + timeLabelsBox.width + (dayIndex * DAY_WIDTH) + 35;

  // Y position: header bottom + time offset
  const hoursFromStart = hour - START_HOUR + minute / 60;
  const y = headerBox.y + headerBox.height + (hoursFromStart * HOUR_HEIGHT);

  return { x, y };
}
