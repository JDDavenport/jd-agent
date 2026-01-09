// Common test data fixtures

export const testTask = {
  id: 'test-task-1',
  title: 'Test Task',
  description: 'A test task',
  status: 'pending' as const,
  priority: 'medium' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const testGoal = {
  id: 'test-goal-1',
  title: 'Test Goal',
  description: 'A test goal',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Add more fixtures as needed
