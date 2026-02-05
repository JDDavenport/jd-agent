import { readFile } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';
import type { GoldStandard, VerificationResult, Task, Content } from './types.js';

const HUB_URL = config.hub.localUrl;

interface HubTask {
  id: string;
  courseId: string;
  title: string;
  dueDate: string | null;
}

interface HubContent {
  id: string;
  courseId: string;
  title: string;
}

interface HubCourse {
  id: string;
  name: string;
}

async function fetchFromHub<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetch(`${HUB_URL}${endpoint}`);
    if (!response.ok) {
      console.error(`Hub API error: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return (data.data || data || []) as T[];
  } catch (e) {
    console.error(`Cannot reach hub at ${HUB_URL}:`, e);
    return [];
  }
}

async function loadGoldStandard(): Promise<GoldStandard | null> {
  const gsPath = join(config.paths.goldStandard, 'gold-standard.json');
  try {
    const content = await readFile(gsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function compareTasks(gold: Task[], hub: HubTask[]): { matched: number; missing: string[] } {
  const hubIds = new Set(hub.map(t => t.id));
  const goldTasks = gold.filter(t => 
    t.type !== 'announcement' && // Skip announcements for task comparison
    t.dueDate !== null // Only count tasks with due dates
  );
  
  let matched = 0;
  const missing: string[] = [];
  
  for (const task of goldTasks) {
    // Check by raw ID or normalized ID
    if (hubIds.has(task.id) || hubIds.has(task.rawId)) {
      matched++;
    } else {
      missing.push(`${task.title} (${task.id})`);
    }
  }
  
  return { matched, missing };
}

function compareContent(gold: Content[], hub: HubContent[]): { matched: number; missing: string[] } {
  const hubIds = new Set(hub.map(c => c.id));
  const hubTitles = new Set(hub.map(c => c.title.toLowerCase()));
  
  let matched = 0;
  const missing: string[] = [];
  
  for (const content of gold) {
    // Check by ID or title match
    if (hubIds.has(content.id) || hubIds.has(content.rawId) || hubTitles.has(content.title.toLowerCase())) {
      matched++;
    } else {
      missing.push(`${content.title} (${content.type})`);
    }
  }
  
  return { matched, missing };
}

export async function verify(): Promise<VerificationResult> {
  const gold = await loadGoldStandard();
  
  if (!gold) {
    return {
      coursesMatch: { total: 0, matched: 0 },
      tasksMatch: { total: 0, matched: 0, missing: [] },
      contentMatch: { total: 0, matched: 0, missing: [] },
      summary: '❌ No gold standard found. Run `npm run pull` first.',
    };
  }
  
  // Fetch from hub
  const hubCourses = await fetchFromHub<HubCourse>('/api/courses');
  const hubTasks = await fetchFromHub<HubTask>('/api/tasks');
  const hubContent = await fetchFromHub<HubContent>('/api/content');
  
  if (hubCourses.length === 0 && hubTasks.length === 0) {
    return {
      coursesMatch: { total: gold.courses.length, matched: 0 },
      tasksMatch: { total: gold.tasks.length, matched: 0, missing: [] },
      contentMatch: { total: gold.content.length, matched: 0, missing: [] },
      summary: `⚠️ Hub API not reachable or empty. Gold standard has ${gold.courses.length} courses, ${gold.tasks.length} tasks, ${gold.content.length} content items.`,
    };
  }
  
  // Compare
  const coursesMatched = gold.courses.filter(gc => 
    hubCourses.some(hc => hc.id === gc.id || hc.name === gc.name)
  ).length;
  
  const tasksResult = compareTasks(gold.tasks, hubTasks);
  const contentResult = compareContent(gold.content, hubContent);
  
  const totalGoldTasks = gold.tasks.filter(t => t.type !== 'announcement' && t.dueDate !== null).length;
  
  // Build summary
  const parts: string[] = [];
  
  if (coursesMatched === gold.courses.length) {
    parts.push(`${coursesMatched}/${gold.courses.length} courses ✓`);
  } else {
    parts.push(`${coursesMatched}/${gold.courses.length} courses ⚠️`);
  }
  
  if (tasksResult.matched === totalGoldTasks) {
    parts.push(`${tasksResult.matched}/${totalGoldTasks} tasks ✓`);
  } else {
    parts.push(`${tasksResult.matched}/${totalGoldTasks} tasks`);
    if (tasksResult.missing.length > 0) {
      parts.push(`${tasksResult.missing.length} tasks missing`);
    }
  }
  
  if (contentResult.matched === gold.content.length) {
    parts.push(`${contentResult.matched}/${gold.content.length} content ✓`);
  } else {
    parts.push(`${contentResult.matched}/${gold.content.length} content`);
    if (contentResult.missing.length > 0) {
      parts.push(`${contentResult.missing.length} content items missing`);
    }
  }
  
  return {
    coursesMatch: { total: gold.courses.length, matched: coursesMatched },
    tasksMatch: { total: totalGoldTasks, matched: tasksResult.matched, missing: tasksResult.missing },
    contentMatch: { total: gold.content.length, matched: contentResult.matched, missing: contentResult.missing },
    summary: parts.join(', '),
  };
}
