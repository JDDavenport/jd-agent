/**
 * API-Only Tests - No UI Required
 *
 * These tests directly hit the backend API endpoints
 * and verify responses, data integrity, and business logic
 * without needing the React frontend.
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api';

// Helper function to make API requests
async function apiRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const data = await response.json();
  return { response, data };
}

test.describe('API Tests - Tasks Endpoint', () => {
  test('GET /tasks should return tasks list', async () => {
    const { response, data } = await apiRequest('/tasks');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('POST /tasks should create a new task', async () => {
    const newTask = {
      title: 'API Test Task - ' + Date.now(),
      description: 'Created via API test',
      status: 'today',
      priority: 2,
      source: 'manual',
      context: 'test',
    };

    const { response, data } = await apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(newTask),
    });

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe(newTask.title);
    expect(data.data.id).toBeDefined();
  });

  test('GET /tasks/today should return today tasks', async () => {
    const { response, data } = await apiRequest('/tasks/today');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('GET /tasks/counts should return task counts', async () => {
    const { response, data } = await apiRequest('/tasks/counts');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(typeof data.data.inbox).toBe('number');
    expect(typeof data.data.today).toBe('number');
    expect(typeof data.data.upcoming).toBe('number');
  });

  test('PATCH /tasks/:id should update a task', async () => {
    // First create a task
    const createRes = await apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Task to Update',
        source: 'manual',
        context: 'test',
      }),
    });

    const taskId = createRes.data.data.id;

    // Then update it
    const { response, data } = await apiRequest(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Updated Title',
        status: 'done',
      }),
    });

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe('Updated Title');
  });

  test('DELETE /tasks/:id should delete a task', async () => {
    // First create a task
    const createRes = await apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Task to Delete',
        source: 'manual',
        context: 'test',
      }),
    });

    const taskId = createRes.data.data.id;

    // Then delete it
    const { response, data } = await apiRequest(`/tasks/${taskId}`, {
      method: 'DELETE',
    });

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('POST /tasks/:id/complete should complete a task', async () => {
    // Create a task
    const createRes = await apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Task to Complete',
        source: 'manual',
        context: 'test',
      }),
    });

    const taskId = createRes.data.data.id;

    // Complete it
    const { response, data } = await apiRequest(`/tasks/${taskId}/complete`, {
      method: 'POST',
    });

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('done');
    expect(data.data.completedAt).toBeDefined();
  });
});

test.describe('API Tests - Vault Endpoint', () => {
  test('GET /vault should return vault entries', async () => {
    const { response, data } = await apiRequest('/vault');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('POST /vault should create a new entry', async () => {
    const newEntry = {
      title: 'API Test Note - ' + Date.now(),
      content: '# Test Note\n\nThis is a test note created via API.',
      contentType: 'note',
      context: 'test',
      source: 'manual',
      tags: ['test', 'api'],
    };

    const { response, data } = await apiRequest('/vault', {
      method: 'POST',
      body: JSON.stringify(newEntry),
    });

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe(newEntry.title);
    expect(data.data.id).toBeDefined();
  });

  test('GET /vault/search should search entries', async () => {
    const { response, data } = await apiRequest('/vault/search?query=test');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('GET /vault/contexts should return unique contexts', async () => {
    const { response, data } = await apiRequest('/vault/contexts');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('GET /vault/tags should return unique tags', async () => {
    const { response, data } = await apiRequest('/vault/tags');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('PATCH /vault/:id should update an entry', async () => {
    // Create entry
    const createRes = await apiRequest('/vault', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Entry to Update',
        content: 'Original content',
        contentType: 'note',
        context: 'test',
        source: 'manual',
      }),
    });

    const entryId = createRes.data.data.id;

    // Update it
    const { response, data } = await apiRequest(`/vault/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Updated Entry',
        content: 'Updated content',
      }),
    });

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe('Updated Entry');
  });
});

test.describe('API Tests - Chat Endpoint', () => {
  // Skip - requires OpenAI API key which is not available in test environment
  // These tests timeout because the /chat endpoint needs OpenAI integration
  // TODO: Add mocking for AI responses or configure test OpenAI key
  test.skip('POST /chat should send a message', async () => {
    const { response, data } = await apiRequest('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello, what tasks do I have today?',
      }),
    });

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.message).toBeDefined();
    expect(typeof data.data.message).toBe('string');
  });

  // Skip - requires OpenAI API key which is not available in test environment
  test.skip('POST /chat should handle multiple messages', async () => {
    const messages = [
      'What is my schedule today?',
      'Add a task: Review code',
      'Show me my vault entries',
    ];

    for (const message of messages) {
      const { response, data } = await apiRequest('/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });

      expect(response.ok).toBeTruthy();
      expect(data.success).toBe(true);
    }
  });
});

test.describe('API Tests - Calendar Endpoint', () => {
  test('GET /calendar should return events', async () => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { response, data } = await apiRequest(`/calendar?start=${today}&end=${nextWeek}`);

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('GET /calendar/upcoming should return upcoming events', async () => {
    const { response, data } = await apiRequest('/calendar/upcoming');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });
});

test.describe('API Tests - Analytics Endpoint', () => {
  test('GET /analytics/dashboard should return dashboard stats', async () => {
    const { response, data } = await apiRequest('/analytics/dashboard');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.tasks).toBeDefined();
    expect(typeof data.data.tasks.today).toBe('number');
  });

  test('GET /analytics/health should return health metrics', async () => {
    const { response, data } = await apiRequest('/analytics/health');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.tasksCompleted7d).toBeDefined();
  });
});

test.describe('API Tests - Setup Endpoint', () => {
  test('GET /setup/status should return setup status', async () => {
    const { response, data } = await apiRequest('/setup/status');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(typeof data.data.complete).toBe('boolean');
  });

  test('GET /setup/services should return service statuses', async () => {
    const { response, data } = await apiRequest('/setup/services');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('POST /setup/brain-dump should create inbox task', async () => {
    const { response, data } = await apiRequest('/setup/brain-dump', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Brain dump task - ' + Date.now(),
      }),
    });

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();
  });

  test('GET /setup/inbox should return inbox items', async () => {
    const { response, data } = await apiRequest('/setup/inbox');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('GET /setup/classes should return classes', async () => {
    const { response, data } = await apiRequest('/setup/classes');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });
});

test.describe('API Tests - System Endpoint', () => {
  test('GET /system/info should return system info', async () => {
    const { response, data } = await apiRequest('/system/info');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('JD Agent');
    expect(data.data.version).toBeDefined();
  });

  test('GET /system/health should return health summary', async () => {
    const { response, data } = await apiRequest('/system/health');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.status).toBeDefined();
  });
});

test.describe('API Tests - Ceremonies Endpoint', () => {
  test('GET /ceremonies/status should return ceremony status', async () => {
    const { response, data } = await apiRequest('/ceremonies/status');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(typeof data.data.notificationsConfigured).toBe('boolean');
  });

  test('GET /ceremonies/preview/morning should preview ceremony', async () => {
    const { response, data } = await apiRequest('/ceremonies/preview/morning');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data.content).toBeDefined();
  });
});

test.describe('API Tests - Logs Endpoint', () => {
  test('GET /logs should return activity logs', async () => {
    const { response, data } = await apiRequest('/logs?limit=10');

    expect(response.ok).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBeTruthy();
  });
});

test.describe('API Tests - Error Handling', () => {
  test('should return 404 for non-existent endpoint', async () => {
    const { response } = await apiRequest('/nonexistent');
    expect(response.status).toBe(404);
  });

  test('should return 400 for invalid task data', async () => {
    const { response } = await apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify({}), // Missing required fields
    });

    expect(response.status).toBe(400);
  });

  test('should return 404 for non-existent task ID', async () => {
    // Use a valid UUID format that doesn't exist
    const { response } = await apiRequest('/tasks/00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(404);
  });
});

test.describe('API Tests - Bulk Operations (Run 10 times)', () => {
  test('should handle 10 concurrent task creations', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: `Bulk Task ${i + 1} - ${Date.now()}`,
          source: 'manual',
          context: 'test',
        }),
      })
    );

    const results = await Promise.all(promises);

    results.forEach(({ response, data }) => {
      expect(response.ok).toBeTruthy();
      expect(data.success).toBe(true);
    });
  });

  test('should handle 10 sequential vault searches', async () => {
    for (let i = 0; i < 10; i++) {
      const { response, data } = await apiRequest(`/vault/search?query=test${i}`);
      expect(response.ok).toBeTruthy();
      expect(data.success).toBe(true);
    }
  });

  test('should handle 10 analytics requests', async () => {
    for (let i = 0; i < 10; i++) {
      const { response, data } = await apiRequest('/analytics/dashboard');
      expect(response.ok).toBeTruthy();
      expect(data.success).toBe(true);
      expect(data.data.tasks).toBeDefined();
    }
  });
});

test.describe('API Tests - Data Integrity (Run 10 times)', () => {
  test('should maintain data consistency across CRUD operations', async () => {
    for (let i = 0; i < 10; i++) {
      // Create
      const createRes = await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: `Integrity Test ${i}`,
          description: 'Testing data integrity',
          source: 'manual',
          context: 'test',
        }),
      });

      expect(createRes.data.success).toBe(true);
      const taskId = createRes.data.data.id;

      // Read
      const readRes = await apiRequest(`/tasks/${taskId}`);
      expect(readRes.data.success).toBe(true);
      expect(readRes.data.data.title).toBe(`Integrity Test ${i}`);

      // Update
      const updateRes = await apiRequest(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: `Updated Integrity Test ${i}`,
        }),
      });
      expect(updateRes.data.success).toBe(true);

      // Delete
      const deleteRes = await apiRequest(`/tasks/${taskId}`, {
        method: 'DELETE',
      });
      expect(deleteRes.data.success).toBe(true);

      // Verify deletion
      const verifyRes = await apiRequest(`/tasks/${taskId}`);
      expect(verifyRes.response.status).toBe(404);
    }
  });
});

test.describe('API Tests - Performance (Run 10 times)', () => {
  test('GET /tasks should respond within 500ms', async () => {
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const { response } = await apiRequest('/tasks');
      const duration = Date.now() - start;

      expect(response.ok).toBeTruthy();
      expect(duration).toBeLessThan(500);
    }
  });

  test('POST /tasks should respond within 1000ms', async () => {
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const { response } = await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: `Perf Test ${i}`,
          source: 'manual',
          context: 'test',
        }),
      });
      const duration = Date.now() - start;

      expect(response.ok).toBeTruthy();
      expect(duration).toBeLessThan(1000);
    }
  });

  test('GET /vault/search should respond within 800ms', async () => {
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const { response } = await apiRequest('/vault/search?query=test');
      const duration = Date.now() - start;

      expect(response.ok).toBeTruthy();
      expect(duration).toBeLessThan(800);
    }
  });
});
