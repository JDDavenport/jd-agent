import { Hono } from 'hono';
import { z } from 'zod';
import { ValidationError } from '../middleware/error-handler';
import { getMasterAgent } from '../../agents/master-agent';

const chatRouter = new Hono();

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  context: z.object({
    currentView: z.string().optional(),
    selectedTaskId: z.string().uuid().optional(),
    selectedProjectId: z.string().uuid().optional(),
  }).optional(),
});

// POST /api/chat - Chat with AI agent
chatRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = chatSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const { message } = parseResult.data;

  // Get the master agent singleton
  const agent = getMasterAgent();

  // Check if agent is configured
  if (!agent.isConfigured()) {
    return c.json({
      success: true,
      data: {
        response: "I'm not fully configured yet. The OPENAI_API_KEY environment variable needs to be set to enable AI chat capabilities. Once configured, I'll be able to help you manage tasks, search your vault, add to your calendar, and provide productivity insights!",
        message: "I'm not fully configured yet. The OPENAI_API_KEY environment variable needs to be set to enable AI chat capabilities. Once configured, I'll be able to help you manage tasks, search your vault, add to your calendar, and provide productivity insights!",
        actions: [],
        toolsUsed: [],
      },
    });
  }

  try {
    // Use the master agent to process the message
    const result = await agent.chat(message);

    return c.json({
      success: true,
      data: {
        response: result.message,
        message: result.message, // Keep both for backward compatibility
        toolsUsed: result.toolsUsed,
        context: result.context,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return a user-friendly error message
    return c.json({
      success: false,
      error: {
        code: 'CHAT_ERROR',
        message: 'Failed to process message',
        details: errorMessage,
      },
    }, 500);
  }
});

// GET /api/chat/status - Check chat service status
chatRouter.get('/status', async (c) => {
  const agent = getMasterAgent();
  const isConfigured = agent.isConfigured();
  const providers = agent.getProviders();

  return c.json({
    success: true,
    data: {
      configured: isConfigured,
      providers: providers,
      lastProvider: agent.getLastProvider(),
      historyLength: agent.getHistoryLength(),
    },
  });
});

// POST /api/chat/clear - Clear conversation history
chatRouter.post('/clear', async (c) => {
  const agent = getMasterAgent();
  agent.clearHistory();

  return c.json({
    success: true,
    data: {
      message: 'Conversation history cleared',
    },
  });
});

export { chatRouter };
