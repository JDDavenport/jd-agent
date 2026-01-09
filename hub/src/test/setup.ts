import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Setup that runs once before all tests
  console.log('Test suite starting...');
});

afterAll(async () => {
  // Cleanup that runs once after all tests
  console.log('Test suite complete');
});

beforeEach(() => {
  // Setup that runs before each test
});

afterEach(() => {
  // Cleanup that runs after each test
});
