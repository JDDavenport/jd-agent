/**
 * Test fixtures and mock data for E2E tests
 */

export const mockTasks = [
  {
    id: '1',
    title: 'Complete project documentation',
    status: 'today',
    priority: 'high',
    dueDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Review pull requests',
    status: 'upcoming',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Prepare presentation',
    status: 'someday',
    priority: 'low',
    createdAt: new Date().toISOString(),
  },
];

export const mockVaultEntries = [
  {
    id: 'v1',
    title: 'Meeting Notes - Project Kickoff',
    contentType: 'meeting',
    context: 'Work',
    tags: ['important', 'project'],
    content: 'Discussion about new project requirements...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'v2',
    title: 'Lecture 5: Data Structures',
    contentType: 'lecture',
    context: 'CS101',
    tags: ['algorithms', 'study'],
    content: 'Topics covered: Trees, Graphs, Hash Tables...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'v3',
    title: 'Research Article Summary',
    contentType: 'article',
    context: 'Research',
    tags: ['machine-learning', 'ai'],
    content: 'Key findings from the recent ML paper...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockClasses = [
  {
    id: 'c1',
    name: 'Data Structures and Algorithms',
    courseCode: 'CS 201',
    professor: 'Dr. Smith',
    canvasCourseId: '12345',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'c2',
    name: 'Web Development',
    courseCode: 'CS 350',
    professor: 'Prof. Johnson',
    createdAt: new Date().toISOString(),
  },
];

export const mockChatMessages = [
  {
    role: 'user',
    content: 'What tasks do I have today?',
    timestamp: new Date().toISOString(),
  },
  {
    role: 'agent',
    content: 'You have 3 tasks scheduled for today: Complete project documentation, Review pull requests, and Prepare presentation.',
    timestamp: new Date().toISOString(),
    toolsUsed: ['tasks.list'],
  },
];

export const mockStats = {
  tasksToday: 5,
  tasksUpcoming: 12,
  tasksCompleted: 48,
  vaultEntries: 23,
  upcomingDeadlines: 3,
};

export const mockCalendarEvents = [
  {
    id: 'e1',
    title: 'Team Meeting',
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600000).toISOString(),
    type: 'meeting',
  },
  {
    id: 'e2',
    title: 'CS 201 Lecture',
    start: new Date(Date.now() + 86400000).toISOString(),
    end: new Date(Date.now() + 90000000).toISOString(),
    type: 'class',
  },
];

export const mockCeremonyStatus = {
  lastCeremonies: {
    morning: {
      sentAt: new Date(Date.now() - 3600000).toISOString(),
      channel: 'telegram',
    },
    evening: {
      sentAt: new Date(Date.now() - 86400000).toISOString(),
      channel: 'telegram',
    },
    weekly: {
      sentAt: new Date(Date.now() - 604800000).toISOString(),
      channel: 'email',
    },
  },
};

export const mockCeremonyConfig = {
  morningTime: '6:00 AM',
  eveningTime: '9:00 PM',
  weeklyDay: 'Sunday',
  weeklyTime: '4:00 PM',
  notificationChannels: {
    telegram: {
      configured: true,
      chatId: '123456789',
    },
    sms: {
      configured: false,
      phoneNumber: null,
    },
    email: {
      configured: true,
      email: 'user@example.com',
    },
  },
};

export const mockServices = [
  {
    name: 'telegram',
    displayName: 'Telegram',
    configured: true,
    connected: true,
  },
  {
    name: 'canvas',
    displayName: 'Canvas LMS',
    configured: true,
    connected: false,
  },
  {
    name: 'linear',
    displayName: 'Linear',
    configured: false,
    connected: false,
  },
];

export const mockSystemHealth = {
  status: 'healthy',
  services: {
    database: { status: 'up', latency: 15 },
    api: { status: 'up', latency: 23 },
    telegram: { status: 'up', latency: 120 },
  },
  metrics: {
    tasksProcessed: 156,
    apiCalls: 2341,
    uptime: 99.9,
  },
  recentActivities: [
    {
      id: 'a1',
      action: 'Task created',
      timestamp: new Date().toISOString(),
      details: 'Complete project documentation',
    },
    {
      id: 'a2',
      action: 'Ceremony sent',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      details: 'Morning briefing via Telegram',
    },
  ],
};

export const mockInboxItems = [
  {
    id: 'i1',
    title: 'Follow up on client email',
    description: 'Client requested update on project status',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'i2',
    title: 'Schedule dentist appointment',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'i3',
    title: 'Research new framework',
    description: 'Look into React 19 features',
    createdAt: new Date().toISOString(),
  },
];

export const mockSetupSummary = {
  connectedServices: ['Telegram', 'Canvas'],
  taskCounts: {
    total: 15,
    today: 3,
    upcoming: 8,
    someday: 4,
  },
  classCount: 2,
  nextSteps: [
    'Complete inbox processing',
    'Set up weekly review time',
    'Link Canvas courses to classes',
  ],
};

export const mockGoals = [
  {
    id: 'g1',
    title: 'Complete all CS assignments',
    progress: 75,
    target: 100,
    deadline: new Date(Date.now() + 604800000).toISOString(),
  },
  {
    id: 'g2',
    title: 'Read 5 research papers',
    progress: 3,
    target: 5,
    deadline: new Date(Date.now() + 1209600000).toISOString(),
  },
];

// API Response builders
export function buildSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}

export function buildErrorResponse(message: string, code = 'ERROR') {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

// Test user data
export const testUser = {
  id: 'user123',
  email: 'test@example.com',
  name: 'Test User',
  preferences: {
    theme: 'dark',
    timezone: 'America/New_York',
  },
};

// Test environment config
export const testConfig = {
  apiUrl: 'http://localhost:3000/api',
  appUrl: 'http://localhost:5173',
  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000,
  },
};
