/**
 * JD Agent - Ceremony API Routes
 * 
 * Endpoints for managing and triggering ceremonies:
 * - Preview ceremonies
 * - Manually trigger ceremonies
 * - View ceremony history
 * - Notification setup
 */

import { Hono } from 'hono';
import { ceremonyService, type CeremonyType } from '../../services/ceremony-service';
import { notificationService } from '../../services/notification-service';
import { ValidationError } from '../middleware/error-handler';

const ceremoniesRouter = new Hono();

// ============================================
// Ceremony Routes
// ============================================

/**
 * GET /api/ceremonies/status
 * Get notification and ceremony status
 */
ceremoniesRouter.get('/status', async (c) => {
  const channels = notificationService.getAvailableChannels();
  const [lastMorning, lastEvening, lastWeekly] = await Promise.all([
    ceremonyService.getLastCeremony('morning'),
    ceremonyService.getLastCeremony('evening'),
    ceremonyService.getLastCeremony('weekly'),
  ]);

  return c.json({
    success: true,
    data: {
      notificationsConfigured: notificationService.isConfigured(),
      availableChannels: channels,
      lastCeremonies: {
        morning: lastMorning ? { 
          sentAt: lastMorning.sentAt, 
          status: lastMorning.deliveryStatus 
        } : null,
        evening: lastEvening ? { 
          sentAt: lastEvening.sentAt, 
          status: lastEvening.deliveryStatus 
        } : null,
        weekly: lastWeekly ? { 
          sentAt: lastWeekly.sentAt, 
          status: lastWeekly.deliveryStatus 
        } : null,
      },
      schedule: {
        morning: '6:00 AM daily',
        evening: '9:00 PM daily',
        weekly: '4:00 PM Sundays',
      },
    },
  });
});

/**
 * GET /api/ceremonies/history
 * Get ceremony history
 */
ceremoniesRouter.get('/history', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10', 10);
  const history = await ceremonyService.getHistory(limit);

  return c.json({
    success: true,
    data: history,
    count: history.length,
  });
});

/**
 * GET /api/ceremonies/preview/:type
 * Preview a ceremony without sending
 */
ceremoniesRouter.get('/preview/:type', async (c) => {
  const type = c.req.param('type') as CeremonyType;

  if (!['morning', 'evening', 'weekly'].includes(type)) {
    throw new ValidationError('Invalid ceremony type. Must be: morning, evening, or weekly');
  }

  const content = await ceremonyService.preview(type);

  // Format as readable text
  let formatted = `${content.greeting}\n\n`;
  for (const section of content.sections) {
    formatted += `${section.heading}\n`;
    formatted += `${section.content}\n`;
    if (section.items) {
      formatted += section.items.join('\n') + '\n';
    }
    formatted += '\n';
  }
  formatted += content.signOff;

  return c.json({
    success: true,
    data: {
      type,
      content,
      formatted,
    },
  });
});

/**
 * POST /api/ceremonies/run/:type
 * Manually trigger a ceremony
 */
ceremoniesRouter.post('/run/:type', async (c) => {
  const type = c.req.param('type') as CeremonyType;

  if (!['morning', 'evening', 'weekly'].includes(type)) {
    throw new ValidationError('Invalid ceremony type. Must be: morning, evening, or weekly');
  }

  let result;
  switch (type) {
    case 'morning':
      result = await ceremonyService.runMorningCeremony();
      break;
    case 'evening':
      result = await ceremonyService.runEveningCeremony();
      break;
    case 'weekly':
      result = await ceremonyService.runWeeklyCeremony();
      break;
  }

  return c.json({
    success: true,
    data: {
      type: result.type,
      timestamp: result.timestamp,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError,
      content: result.content,
    },
    message: result.notificationSent 
      ? `${type} ceremony sent successfully`
      : `${type} ceremony generated but notification failed: ${result.notificationError}`,
  });
});

// ============================================
// Notification Routes
// ============================================

/**
 * GET /api/ceremonies/notifications/status
 * Get notification configuration status
 */
ceremoniesRouter.get('/notifications/status', async (c) => {
  const channels = notificationService.getAvailableChannels();
  const telegramInfo = await notificationService.getTelegramBotInfo();

  return c.json({
    success: true,
    data: {
      configured: notificationService.isConfigured(),
      availableChannels: channels,
      telegram: {
        configured: channels.includes('telegram'),
        botUsername: telegramInfo.username || null,
        error: telegramInfo.error || null,
        setupInstructions: !channels.includes('telegram') ? [
          '1. Set TELEGRAM_TOKEN environment variable',
          '2. Send /start to your bot in Telegram',
          '3. Set TELEGRAM_CHAT_ID environment variable with your chat ID',
        ] : null,
      },
      sms: {
        configured: channels.includes('sms'),
        setupInstructions: !channels.includes('sms') ? [
          '1. Set TWILIO_ACCOUNT_SID',
          '2. Set TWILIO_AUTH_TOKEN', 
          '3. Set TWILIO_PHONE_NUMBER',
          '4. Set USER_PHONE_NUMBER',
        ] : null,
      },
      email: {
        configured: channels.includes('email'),
        setupInstructions: !channels.includes('email') ? [
          '1. Set RESEND_API_KEY',
          '2. Set USER_EMAIL',
        ] : null,
      },
    },
  });
});

/**
 * POST /api/ceremonies/notifications/test
 * Send a test notification
 */
ceremoniesRouter.post('/notifications/test', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const channel = body.channel;

  if (!notificationService.isConfigured()) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'No notification channels configured',
      },
    }, 400);
  }

  const testMessage = `🧪 *Test Notification*\n\nThis is a test from JD Agent!\n\nTime: ${new Date().toLocaleString()}`;

  const result = await notificationService.send(testMessage, { channel });

  return c.json({
    success: result.success,
    data: {
      channel: result.channel,
      messageId: result.messageId,
      error: result.error,
    },
    message: result.success 
      ? 'Test notification sent successfully!'
      : `Failed to send: ${result.error}`,
  });
});

/**
 * POST /api/ceremonies/telegram/setup
 * Setup Telegram - get bot info and instructions
 */
ceremoniesRouter.post('/telegram/setup', async (c) => {
  const telegramInfo = await notificationService.getTelegramBotInfo();

  if (telegramInfo.error) {
    return c.json({
      success: false,
      error: {
        code: 'TELEGRAM_ERROR',
        message: telegramInfo.error,
      },
      data: {
        instructions: [
          '1. Make sure TELEGRAM_TOKEN is set correctly',
          '2. Get a token from @BotFather on Telegram',
        ],
      },
    }, 400);
  }

  return c.json({
    success: true,
    data: {
      botUsername: telegramInfo.username,
      setupSteps: [
        `1. Open Telegram and search for @${telegramInfo.username}`,
        '2. Send /start to the bot',
        '3. The bot will reply with your chat ID',
        '4. Set TELEGRAM_CHAT_ID environment variable with that ID',
        '5. Restart the server and test notifications',
      ],
    },
    message: `Bot found: @${telegramInfo.username}`,
  });
});

/**
 * POST /api/ceremonies/telegram/set-chat-id
 * Set the Telegram chat ID (for development)
 */
ceremoniesRouter.post('/telegram/set-chat-id', async (c) => {
  const body = await c.req.json();
  const chatId = body.chatId;

  if (!chatId) {
    throw new ValidationError('chatId is required');
  }

  notificationService.setTelegramChatId(chatId);

  // Test with a welcome message
  const result = await notificationService.sendTelegram(
    '✅ *Telegram Connected!*\n\nJD Agent is now linked to this chat. You will receive ceremony notifications here.',
  );

  return c.json({
    success: result.success,
    data: {
      chatId,
      testMessageSent: result.success,
      error: result.error,
    },
    message: result.success 
      ? 'Chat ID set and test message sent!'
      : `Chat ID set but test failed: ${result.error}`,
  });
});

export { ceremoniesRouter };
