/**
 * Telegram Bot - Two-way Chat Interface
 * 
 * This is how you SHOULD interact with your AI agent - 
 * by messaging a Telegram bot, not running curl commands!
 */

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

interface TelegramMessage {
  chatId: number;
  text: string;
  replyToMessageId?: number;
}

export class TelegramBot {
  private token: string;
  private baseUrl: string;
  private authorizedChatId: number;
  private lastUpdateId: number = 0;
  private isPolling: boolean = false;
  private pollInterval: NodeJS.Timer | null = null;
  private messageHandler: ((message: string, chatId: number) => Promise<string>) | null = null;

  constructor() {
    this.token = process.env.TELEGRAM_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
    this.authorizedChatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0');
    
    if (!this.token) {
      console.log('[TelegramBot] No token configured');
    } else {
      console.log('[TelegramBot] Configured for chat ID:', this.authorizedChatId);
    }
  }

  /**
   * Check if bot is properly configured
   */
  isConfigured(): boolean {
    return !!this.token && !!this.authorizedChatId;
  }

  /**
   * Set the handler for incoming messages
   */
  setMessageHandler(handler: (message: string, chatId: number) => Promise<string>): void {
    this.messageHandler = handler;
  }

  /**
   * Send a message
   */
  async sendMessage(chatId: number, text: string, replyToMessageId?: number): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown',
          reply_to_message_id: replyToMessageId,
        }),
      });

      const result = await response.json() as { ok: boolean; description?: string };
      
      if (!result.ok) {
        console.error('[TelegramBot] Failed to send message:', result.description);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[TelegramBot] Error sending message:', error);
      return false;
    }
  }

  /**
   * Get updates (new messages)
   */
  async getUpdates(): Promise<TelegramUpdate[]> {
    if (!this.token) return [];

    try {
      const response = await fetch(
        `${this.baseUrl}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`
      );
      const result = await response.json() as { ok: boolean; result?: TelegramUpdate[] };

      if (result.ok && result.result) {
        return result.result;
      }

      return [];
    } catch (error) {
      console.error('[TelegramBot] Error getting updates:', error);
      return [];
    }
  }

  /**
   * Process a single update
   */
  async processUpdate(update: TelegramUpdate): Promise<void> {
    this.lastUpdateId = update.update_id;

    if (!update.message?.text) return;

    const chatId = update.message.chat.id;
    const text = update.message.text;
    const messageId = update.message.message_id;

    // Security: Only respond to authorized chat
    if (chatId !== this.authorizedChatId) {
      console.log(`[TelegramBot] Ignoring message from unauthorized chat: ${chatId}`);
      await this.sendMessage(chatId, "⚠️ Unauthorized. This bot only responds to its owner.");
      return;
    }

    // Handle special commands
    if (text.startsWith('/')) {
      await this.handleCommand(text, chatId, messageId);
      return;
    }

    // Process message through agent
    if (this.messageHandler) {
      try {
        // Send typing indicator
        await fetch(`${this.baseUrl}/sendChatAction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
        });

        const response = await this.messageHandler(text, chatId);
        await this.sendMessage(chatId, response, messageId);
      } catch (error) {
        console.error('[TelegramBot] Error processing message:', error);
        await this.sendMessage(chatId, "❌ Sorry, something went wrong processing your message.", messageId);
      }
    }
  }

  /**
   * Handle bot commands
   */
  async handleCommand(text: string, chatId: number, messageId: number): Promise<void> {
    const command = text.split(' ')[0].toLowerCase();

    switch (command) {
      case '/start':
        await this.sendMessage(chatId, `
👋 *Hey! I'm your JD Agent.*

I'm here to help you stay organized and productive. Just message me naturally:

• "What do I have today?"
• "Add task: Review MBA 560 notes"
• "What's due this week?"
• "Sync my Canvas"

*Quick Commands:*
/today - Today's tasks & calendar
/inbox - Items needing attention
/week - This week's overview
/canvas - Canvas assignments
/help - All commands
        `.trim());
        break;

      case '/help':
        await this.sendMessage(chatId, `
*📖 Available Commands*

*Tasks:*
/today - Today's tasks
/inbox - Inbox items
/add <task> - Quick add task

*Calendar:*
/week - Week overview
/tomorrow - Tomorrow's schedule

*School:*
/canvas - Canvas assignments
/courses - Your courses
/due - Upcoming due dates

*System:*
/health - System status
/morning - Morning briefing
/evening - Evening review

Or just message me naturally! I understand plain English.
        `.trim());
        break;

      case '/today':
        if (this.messageHandler) {
          const response = await this.messageHandler("What's on my schedule today? Give me tasks and calendar events.", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/inbox':
        if (this.messageHandler) {
          const response = await this.messageHandler("Show me my inbox items that need processing.", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/week':
        if (this.messageHandler) {
          const response = await this.messageHandler("What does my week look like? Tasks and calendar.", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/canvas':
        if (this.messageHandler) {
          const response = await this.messageHandler("What Canvas assignments are coming up?", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/courses':
        if (this.messageHandler) {
          const response = await this.messageHandler("List my current courses and which ones are published.", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/due':
        if (this.messageHandler) {
          const response = await this.messageHandler("What assignments are due in the next 7 days?", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/health':
        if (this.messageHandler) {
          const response = await this.messageHandler("Check the system health and status.", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/morning':
        if (this.messageHandler) {
          const response = await this.messageHandler("Give me my morning briefing.", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/evening':
        if (this.messageHandler) {
          const response = await this.messageHandler("Give me my evening review.", chatId);
          await this.sendMessage(chatId, response, messageId);
        }
        break;

      case '/add':
        const taskTitle = text.replace('/add', '').trim();
        if (taskTitle && this.messageHandler) {
          const response = await this.messageHandler(`Add this task to my inbox: ${taskTitle}`, chatId);
          await this.sendMessage(chatId, response, messageId);
        } else {
          await this.sendMessage(chatId, "Usage: /add <task title>", messageId);
        }
        break;

      default:
        await this.sendMessage(chatId, "❓ Unknown command. Try /help for available commands.", messageId);
    }
  }

  /**
   * Start long polling for messages
   */
  startPolling(): void {
    if (this.isPolling) return;
    if (!this.isConfigured()) {
      console.log('[TelegramBot] Cannot start polling - not configured');
      return;
    }

    this.isPolling = true;
    console.log('[TelegramBot] Starting long polling...');

    const poll = async () => {
      while (this.isPolling) {
        try {
          const updates = await this.getUpdates();
          for (const update of updates) {
            await this.processUpdate(update);
          }
        } catch (error) {
          console.error('[TelegramBot] Polling error:', error);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    };

    poll();
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    this.isPolling = false;
    console.log('[TelegramBot] Stopped polling');
  }
}

// Singleton instance
let botInstance: TelegramBot | null = null;

export function getTelegramBot(): TelegramBot {
  if (!botInstance) {
    botInstance = new TelegramBot();
  }
  return botInstance;
}

export default TelegramBot;
