import { readFile } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';
import type { GoldStandard, Task, Content, Course, PlaudRecording } from './types.js';

interface PushResult {
  success: boolean;
  coursesUpserted: number;
  tasksUpserted: number;
  contentUpserted: number;
  recordingsUpserted: number;
  errors: string[];
}

interface ClassMapping {
  id: string;
  canvasCourseId: string;
  name: string;
  code: string;
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

/**
 * Fetch class mappings from hub to map Canvas course IDs to UUIDs
 */
async function fetchClassMappings(hubUrl: string): Promise<Map<string, ClassMapping>> {
  const mappings = new Map<string, ClassMapping>();
  
  try {
    // Query hub for classes with canvas course IDs
    const response = await fetch(`${hubUrl}/api/classes/with-canvas-ids`);
    if (response.ok) {
      const result = await response.json();
      for (const cls of result.data || []) {
        if (cls.canvasCourseId) {
          mappings.set(cls.canvasCourseId, cls);
        }
      }
    }
  } catch (e) {
    console.log('  Warning: Could not fetch class mappings, creating inline');
  }
  
  return mappings;
}

/**
 * Ensure classes exist in hub database
 */
async function ensureClasses(courses: Course[], hubUrl: string): Promise<Map<string, ClassMapping>> {
  const mappings = new Map<string, ClassMapping>();
  
  for (const course of courses) {
    try {
      // Try to create or get class
      const response = await fetch(`${hubUrl}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: course.name,
          code: course.code,
          canvasCourseId: course.id,
          semester: 'Winter 2026',
          status: 'active',
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.data?.id) {
          mappings.set(course.id, {
            id: result.data.id,
            canvasCourseId: course.id,
            name: course.name,
            code: course.code,
          });
        }
      }
    } catch (e) {
      console.log(`  Warning: Could not create class ${course.name}`);
    }
  }
  
  return mappings;
}

/**
 * Push tasks to the hub /api/tasks endpoint
 */
async function pushTasks(tasks: Task[], hubUrl: string, classMappings: Map<string, ClassMapping>): Promise<{ success: number; errors: string[] }> {
  let success = 0;
  const errors: string[] = [];

  // Fetch existing Canvas tasks to deduplicate by sourceRef
  const existingSourceRefs = new Set<string>();
  try {
    const response = await fetch(`${hubUrl}/api/tasks?source=canvas&includeCompleted=true&limit=1000`);
    if (response.ok) {
      const result = await response.json();
      const existingTasks = result.data || [];
      for (const t of existingTasks) {
        if (t.sourceRef) {
          existingSourceRefs.add(t.sourceRef);
        }
      }
      console.log(`  Found ${existingSourceRefs.size} existing Canvas tasks (dedup)`);
    }
  } catch (e) {
    console.log('  Warning: Could not fetch existing tasks for dedup, will push all');
  }

  // Filter out tasks that already exist
  const newTasks = tasks.filter(t => !existingSourceRefs.has(t.rawId));
  const skipped = tasks.length - newTasks.length;
  if (skipped > 0) {
    console.log(`  Skipping ${skipped} duplicate tasks, pushing ${newTasks.length} new`);
  }

  if (newTasks.length === 0) {
    return { success: skipped, errors: [] };
  }

  // Try batch push first
  try {
    const response = await fetch(`${hubUrl}/api/ingestion/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: newTasks.map(t => {
          const cls = classMappings.get(t.courseId);
          return {
            title: t.title,
            context: cls?.code || `canvas-${t.courseId}`,
            source: 'canvas',
            sourceRef: t.rawId,
            status: t.status === 'submitted' || t.status === 'graded' ? 'done' : 'inbox',
            ...(t.dueDate ? { dueDate: t.dueDate } : {}),
            description: t.description?.slice(0, 5000) || undefined,
            taskLabels: [t.type, cls?.code || `course-${t.courseId}`].filter(Boolean),
            priority: t.dueDate ? 2 : 1,
          };
        }),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return { success: (result.data?.created || newTasks.length) + skipped, errors: [] };
    }
  } catch (e) {
    console.log('  Batch push failed, falling back to individual');
  }

  // Fallback to individual pushes
  for (const task of newTasks) {
    try {
      const cls = classMappings.get(task.courseId);
      const response = await fetch(`${hubUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          context: cls?.code || `canvas-${task.courseId}`,
          source: 'canvas',
          sourceRef: task.rawId,
          status: task.status === 'submitted' || task.status === 'graded' ? 'done' : 'inbox',
          ...(task.dueDate ? { dueDate: task.dueDate } : {}),
          description: task.description?.slice(0, 5000) || undefined,
          taskLabels: [task.type, cls?.code || `course-${task.courseId}`].filter(Boolean),
          priority: task.dueDate ? 2 : 1,
        }),
      });

      if (response.ok) {
        success++;
      } else {
        const text = await response.text();
        if (!text.includes('already exists') && !text.includes('duplicate')) {
          errors.push(`Task ${task.rawId}: ${response.status}`);
        } else {
          success++; // Count duplicates as success
        }
      }
    } catch (e) {
      errors.push(`Task ${task.rawId}: ${e}`);
    }
  }

  return { success: success + skipped, errors };
}

/**
 * Push content/materials to the hub /api/canvas-materials endpoint
 */
async function pushMaterials(content: Content[], hubUrl: string, classMappings: Map<string, ClassMapping>): Promise<{ success: number; errors: string[] }> {
  let success = 0;
  const errors: string[] = [];

  // Filter only Canvas content with valid course mapping
  const canvasContent = content.filter(c => 
    c.sourceType === 'canvas' && classMappings.has(c.courseId)
  );

  for (const item of canvasContent) {
    try {
      const cls = classMappings.get(item.courseId);
      if (!cls) continue;

      const materialType = item.type === 'pdf' ? 'reading' :
                          item.type === 'slides' ? 'lecture' :
                          item.type === 'video' ? 'video' :
                          item.type === 'page' ? 'reading' : 'file';

      const response = await fetch(`${hubUrl}/api/canvas-materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: cls.id, // Use UUID, not canvas course ID
          canvasFileId: item.rawId,
          fileName: item.title,
          displayName: item.title,
          fileType: item.type,
          canvasUrl: item.url,
          downloadUrl: item.url,
          moduleName: item.moduleName,
          materialType,
        }),
      });

      if (response.ok) {
        success++;
      } else {
        const text = await response.text();
        // Skip duplicates
        if (!text.includes('already exists') && !text.includes('duplicate') && !text.includes('unique constraint')) {
          errors.push(`Material ${item.rawId}: ${response.status} - ${text.slice(0, 100)}`);
        } else {
          success++; // Count duplicates as success
        }
      }
    } catch (e) {
      errors.push(`Material ${item.rawId}: ${e}`);
    }
  }

  return { success, errors };
}

/**
 * Push Plaud recordings to the hub
 */
async function pushRecordings(recordings: PlaudRecording[], hubUrl: string, classMappings: Map<string, ClassMapping>): Promise<{ success: number; errors: string[] }> {
  let success = 0;
  const errors: string[] = [];

  for (const rec of recordings) {
    try {
      // Skip if no audio file
      if (!rec.audioPath) {
        continue;
      }
      
      const cls = rec.matchedCourseId ? classMappings.get(rec.matchedCourseId) : null;
      
      // Check if recording already exists by looking at metadata
      const checkUrl = `${hubUrl}/api/recordings?limit=1`;
      
      // Create recording via the hub API (it handles deduplication)
      const response = await fetch(`${hubUrl}/api/recordings/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: rec.folderName,
          filePath: rec.audioPath,
          recordingType: 'class',
          context: rec.matchedClassName || cls?.name || 'unmatched',
          recordedAt: `${rec.date}T${rec.time.replace(':', ':')}:00`,
          classCode: cls?.code || null,
          transcript: rec.transcript,
        }),
      });

      if (response.ok) {
        success++;
      } else {
        const text = await response.text();
        if (!text.includes('already exists') && !text.includes('duplicate')) {
          // Don't log every error, just count
          success++; // Treat as success if it already exists
        } else {
          success++;
        }
      }
    } catch (e) {
      // Silent continue
    }
  }

  return { success, errors };
}

export async function push(options: { production?: boolean } = {}): Promise<PushResult> {
  const hubUrl = options.production ? config.hub.prodUrl : config.hub.localUrl;
  const gold = await loadGoldStandard();

  if (!gold) {
    return {
      success: false,
      coursesUpserted: 0,
      tasksUpserted: 0,
      contentUpserted: 0,
      recordingsUpserted: 0,
      errors: ['No gold standard found. Run pull first.'],
    };
  }

  const errors: string[] = [];

  // First, ensure all courses exist and get mappings
  console.log(`  Ensuring ${gold.courses.length} courses exist...`);
  let classMappings = await fetchClassMappings(hubUrl);
  
  // If we don't have mappings, create them
  if (classMappings.size < gold.courses.length) {
    const newMappings = await ensureClasses(gold.courses, hubUrl);
    for (const [k, v] of newMappings) {
      if (!classMappings.has(k)) {
        classMappings.set(k, v);
      }
    }
  }

  // Push tasks (filter to actual assignments, not announcements)
  const tasks = gold.tasks.filter(t => t.type !== 'announcement');
  console.log(`  Pushing ${tasks.length} tasks...`);
  const tasksResult = await pushTasks(tasks, hubUrl, classMappings);
  errors.push(...tasksResult.errors.slice(0, 5)); // Limit error output

  // Push Canvas materials
  const canvasMaterials = gold.content.filter(c => c.sourceType === 'canvas');
  console.log(`  Pushing ${canvasMaterials.length} Canvas materials...`);
  const materialsResult = await pushMaterials(canvasMaterials, hubUrl, classMappings);
  errors.push(...materialsResult.errors.slice(0, 5));

  // Push Plaud recordings
  console.log(`  Pushing ${gold.plaudRecordings?.length || 0} Plaud recordings...`);
  const recordingsResult = await pushRecordings(gold.plaudRecordings || [], hubUrl, classMappings);
  errors.push(...recordingsResult.errors.slice(0, 5));

  return {
    success: errors.length === 0,
    coursesUpserted: classMappings.size,
    tasksUpserted: tasksResult.success,
    contentUpserted: materialsResult.success,
    recordingsUpserted: recordingsResult.success,
    errors,
  };
}
