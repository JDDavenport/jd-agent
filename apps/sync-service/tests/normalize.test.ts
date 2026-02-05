import { describe, it, expect } from 'vitest';
import { normalizeTasks, normalizeContent, mergeGoldStandard } from '../src/normalize.js';
import type { Task, Content, GoldStandard } from '../src/types.js';

describe('normalizeTasks', () => {
  it('should normalize task dates to ISO format', () => {
    const tasks: Task[] = [{
      id: 'test-1',
      courseId: '123',
      title: 'Test Assignment',
      type: 'assignment',
      dueDate: '2026-02-15T23:59:00Z',
      description: '<p>Test description</p>',
      status: 'pending',
      points: 100,
      url: null,
      sourceType: 'canvas',
      rawId: '1',
    }];

    const normalized = normalizeTasks(tasks);
    expect(normalized[0].dueDate).toBe('2026-02-15T23:59:00.000Z');
    expect(normalized[0].description).toBe('Test description');
  });

  it('should handle null due dates', () => {
    const tasks: Task[] = [{
      id: 'test-2',
      courseId: '123',
      title: 'Announcement',
      type: 'announcement',
      dueDate: null,
      description: '',
      status: 'none',
      points: null,
      url: null,
      sourceType: 'canvas',
      rawId: '2',
    }];

    const normalized = normalizeTasks(tasks);
    expect(normalized[0].dueDate).toBeNull();
  });

  it('should normalize status values', () => {
    const tasks: Task[] = [{
      id: 'test-3',
      courseId: '123',
      title: 'Test',
      type: 'assignment',
      dueDate: null,
      description: '',
      status: 'not_submitted' as any,
      points: null,
      url: null,
      sourceType: 'canvas',
      rawId: '3',
    }];

    const normalized = normalizeTasks(tasks);
    expect(normalized[0].status).toBe('pending');
  });
});

describe('normalizeContent', () => {
  it('should normalize content types', () => {
    const content: Content[] = [{
      id: 'test-1',
      courseId: '123',
      title: '  Slides.pdf  ',
      type: 'file',
      url: null,
      sourceType: 'canvas',
      rawId: '1',
    }];

    const normalized = normalizeContent(content);
    expect(normalized[0].title).toBe('Slides.pdf');
  });
});

describe('mergeGoldStandard', () => {
  it('should create new gold standard when none exists', () => {
    const newData = {
      courses: [{ id: '1', canvasId: '1', name: 'Test', code: 'TST', term: '2026' }],
      tasks: [],
      content: [],
    };

    const merged = mergeGoldStandard(null, newData);
    expect(merged.courses).toHaveLength(1);
    expect(merged.generatedAt).toBeDefined();
  });

  it('should merge and dedupe by id', () => {
    const existing: GoldStandard = {
      generatedAt: '2026-01-01T00:00:00Z',
      courses: [{ id: '1', canvasId: '1', name: 'Old', code: 'OLD', term: '2026' }],
      tasks: [],
      content: [],
      modules: [],
      grades: [],
      calendarEvents: [],
      plaudRecordings: [],
      remarkableNotes: [],
    };

    const newData = {
      courses: [{ id: '1', canvasId: '1', name: 'Updated', code: 'UPD', term: '2026' }],
    };

    const merged = mergeGoldStandard(existing, newData);
    expect(merged.courses).toHaveLength(1);
    expect(merged.courses[0].name).toBe('Updated');
  });
});
