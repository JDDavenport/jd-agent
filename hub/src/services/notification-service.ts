/**
 * JD Agent - Notification Service
 * 
 * Supports multiple notification channels:
 * - Telegram (primary - user has token)
 * - Twilio SMS (optional)
 * - Email via Resend (optional)
 * 
 * Features:
 * - Immediate alerts for urgent items
 * - Daily digest compilation
 * - Priority-based notification routing
 */

import { db } from '../db/client';
import { tasks, calendarEvents, vaultEntries, recordings } from '../db/schema';
import { and, eq, gte, lte, desc, isNull, not } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export type NotificationChannel = 'telegram' | 'sms' | 'email';

export interface NotificationOptions {
  channel?: NotificationChannel;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  silent?: boolean;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
}

interface TelegramResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

// ============================================
// Notification Service
// ============================================

export class NotificationService {
  private telegramToken: string | null = null;
  private telegramChatId: string | null = null;
  private twilioClient: any = null;
  private twilioPhoneFrom: string | null = null;
  private twilioPhoneTo: string | null = null;
  private resendClient: any = null;
  private userEmail: string | null = null;
  private preferredChannel: NotificationChannel = 'telegram';

  constructor() {
    this.initializeTelegram();
    this.initializeTwilio();
    this.initializeResend();
    
    // Determine preferred channel based on available credentials
    if (this.telegramToken && this.telegramChatId) {
      this.preferredChannel = 'telegram';
      console.log('[NotificationService] Telegram configured as primary channel');
    } else if (this.twilioClient) {
      this.preferredChannel = 'sms';
      console.log('[NotificationService] Twilio SMS configured as primary channel');
    } else if (this.resendClient) {
      this.preferredChannel = 'email';
      console.log('[NotificationService] Email configured as primary channel');
    } else {
      console.log('[NotificationService] No notification channels configured - notifications disabled');
    }
  }

  private initializeTelegram() {
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (token) {
      this.telegramToken = token;
      this.telegramChatId = chatId || null;
      console.log('[NotificationService] Telegram token found');
      
      if (!chatId) {
        console.log('[NotificationService] Note: TELEGRAM_CHAT_ID not set - will need to be configured');
      }
    }
  }

  private initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const userPhone = process.env.USER_PHONE_NUMBER;

    if (accountSid && authToken && phoneNumber && userPhone) {
      try {
        // Dynamic import would be better, but for simplicity:
        const Twilio = require('twilio');
        this.twilioClient = new Twilio(accountSid, authToken);
        this.twilioPhoneFrom = phoneNumber;
        this.twilioPhoneTo = userPhone;
        console.log('[NotificationService] Twilio initialized');
      } catch (error) {
        console.log('[NotificationService] Twilio not available');
      }
    }
  }

  private initializeResend() {
    const apiKey = process.env.RESEND_API_KEY;
    const userEmail = process.env.USER_EMAIL || process.env.GOOGLE_USER_EMAIL;

    if (apiKey && userEmail) {
      try {
        const { Resend } = require('resend');
        this.resendClient = new Resend(apiKey);
        this.userEmail = userEmail;
        console.log('[NotificationService] Resend email initialized');
      } catch (error) {
        console.log('[NotificationService] Resend not available');
      }
    }
  }

  /**
   * Check if notifications are configured
   */
  isConfigured(): boolean {
    return !!(this.telegramToken || this.twilioClient || this.resendClient);
  }

  /**
   * Get available channels
   */
  getAvailableChannels(): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    if (this.telegramToken && this.telegramChatId) channels.push('telegram');
    if (this.twilioClient) channels.push('sms');
    if (this.resendClient) channels.push('email');
    return channels;
  }

  /**
   * Send a notification
   */
  async send(
    message: string,
    options: NotificationOptions = {}
  ): Promise<NotificationResult> {
    const channel = options.channel || this.preferredChannel;

    switch (channel) {
      case 'telegram':
        return this.sendTelegram(message, options);
      case 'sms':
        return this.sendSms(message, options);
      case 'email':
        return this.sendEmail('JD Agent Notification', message, options);
      default:
        return { success: false, channel, error: 'Unknown channel' };
    }
  }

  /**
   * Send a Telegram message
   */
  async sendTelegram(
    message: string,
    options: NotificationOptions = {}
  ): Promise<NotificationResult> {
    if (!this.telegramToken) {
      return { success: false, channel: 'telegram', error: 'Telegram not configured' };
    }

    if (!this.telegramChatId) {
      return { 
        success: false, 
        channel: 'telegram', 
        error: 'TELEGRAM_CHAT_ID not set. Send /start to your bot to get the chat ID.' 
      };
    }

    try {
      const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text: message,
          parse_mode: 'Markdown',
          disable_notification: options.silent || false,
        }),
      });

      const data = await response.json() as TelegramResponse;

      if (data.ok) {
        return {
          success: true,
          channel: 'telegram',
          messageId: data.result?.message_id?.toString(),
        };
      } else {
        return {
          success: false,
          channel: 'telegram',
          error: data.description || 'Unknown Telegram error',
        };
      }
    } catch (error) {
      return {
        success: false,
        channel: 'telegram',
        error: String(error),
      };
    }
  }

  /**
   * Send an SMS via Twilio
   */
  async sendSms(
    message: string,
    _options: NotificationOptions = {}
  ): Promise<NotificationResult> {
    if (!this.twilioClient || !this.twilioPhoneFrom || !this.twilioPhoneTo) {
      return { success: false, channel: 'sms', error: 'Twilio not configured' };
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioPhoneFrom,
        to: this.twilioPhoneTo,
      });

      return {
        success: true,
        channel: 'sms',
        messageId: result.sid,
      };
    } catch (error) {
      return {
        success: false,
        channel: 'sms',
        error: String(error),
      };
    }
  }

  /**
   * Send an email via Resend
   */
  async sendEmail(
    subject: string,
    message: string,
    _options: NotificationOptions = {}
  ): Promise<NotificationResult> {
    if (!this.resendClient || !this.userEmail) {
      return { success: false, channel: 'email', error: 'Email not configured' };
    }

    try {
      const result = await this.resendClient.emails.send({
        from: 'JD Agent <agent@notifications.jdagent.dev>',
        to: this.userEmail,
        subject,
        text: message,
      });

      return {
        success: true,
        channel: 'email',
        messageId: result.id,
      };
    } catch (error) {
      return {
        success: false,
        channel: 'email',
        error: String(error),
      };
    }
  }

  /**
   * Send to all available channels (for critical notifications)
   */
  async broadcast(message: string): Promise<NotificationResult[]> {
    const channels = this.getAvailableChannels();
    const results = await Promise.all(
      channels.map(channel => this.send(message, { channel }))
    );
    return results;
  }

  /**
   * Send a formatted ceremony notification
   */
  async sendCeremony(
    title: string,
    sections: { heading: string; content: string }[]
  ): Promise<NotificationResult> {
    // Format for Telegram/Markdown
    let message = `🌟 *${title}*\n\n`;
    
    for (const section of sections) {
      message += `*${section.heading}*\n${section.content}\n\n`;
    }

    return this.send(message.trim());
  }

  /**
   * Set the Telegram chat ID (used during setup)
   */
  setTelegramChatId(chatId: string): void {
    this.telegramChatId = chatId;
    console.log(`[NotificationService] Telegram chat ID set to: ${chatId}`);
  }

  /**
   * Get bot info (for setup)
   */
  async getTelegramBotInfo(): Promise<{ username?: string; error?: string }> {
    if (!this.telegramToken) {
      return { error: 'Telegram not configured' };
    }

    try {
      const url = `https://api.telegram.org/bot${this.telegramToken}/getMe`;
      const response = await fetch(url);
      const data = await response.json() as { ok: boolean; result?: { username: string }; description?: string };

      if (data.ok && data.result) {
        return { username: data.result.username };
      }
      return { error: data.description || 'Unknown error' };
    } catch (error) {
      return { error: String(error) };
    }
  }

  // ============================================
  // Daily Digest
  // ============================================

  /**
   * Generate and send the morning digest
   */
  async sendMorningDigest(): Promise<NotificationResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Get today's events
    const todayEvents = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, today),
          lte(calendarEvents.startTime, tomorrow)
        )
      )
      .orderBy(calendarEvents.startTime);

    // Get tasks due today
    const tasksDueToday = await db
      .select()
      .from(tasks)
      .where(
        and(
          gte(tasks.dueDate, today),
          lte(tasks.dueDate, tomorrow),
          not(eq(tasks.status, 'done'))
        )
      )
      .orderBy(tasks.dueDate);

    // Get tasks due this week
    const tasksThisWeek = await db
      .select()
      .from(tasks)
      .where(
        and(
          gte(tasks.dueDate, tomorrow),
          lte(tasks.dueDate, weekEnd),
          not(eq(tasks.status, 'done'))
        )
      )
      .orderBy(tasks.dueDate);

    // Get overdue tasks
    const overdueTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          lte(tasks.dueDate, today),
          not(eq(tasks.status, 'done'))
        )
      )
      .orderBy(desc(tasks.dueDate))
      .limit(5);

    // Build digest message
    let message = `☀️ *Good Morning!*\n`;
    message += `📅 ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n\n`;

    // Today's schedule
    if (todayEvents.length > 0) {
      message += `*📆 Today's Schedule:*\n`;
      for (const event of todayEvents) {
        const time = event.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        message += `• ${time} - ${event.title}\n`;
      }
      message += `\n`;
    }

    // Overdue tasks
    if (overdueTasks.length > 0) {
      message += `*⚠️ Overdue (${overdueTasks.length}):*\n`;
      for (const task of overdueTasks) {
        const daysOverdue = Math.ceil((today.getTime() - (task.dueDate?.getTime() || 0)) / (1000 * 60 * 60 * 24));
        message += `• ${task.title} (${daysOverdue}d overdue)\n`;
      }
      message += `\n`;
    }

    // Tasks due today
    if (tasksDueToday.length > 0) {
      message += `*📋 Due Today (${tasksDueToday.length}):*\n`;
      for (const task of tasksDueToday) {
        // Priority is numeric: 3=urgent, 2=high, 1=normal, 0=low
        const priority = task.priority >= 3 ? '🔴' : task.priority >= 2 ? '🟠' : '';
        message += `• ${priority}${task.title}\n`;
      }
      message += `\n`;
    }

    // Tasks this week
    if (tasksThisWeek.length > 0) {
      message += `*📌 This Week (${tasksThisWeek.length}):*\n`;
      for (const task of tasksThisWeek.slice(0, 5)) {
        const dayName = task.dueDate?.toLocaleDateString('en-US', { weekday: 'short' }) || '';
        message += `• ${dayName}: ${task.title}\n`;
      }
      if (tasksThisWeek.length > 5) {
        message += `  _... and ${tasksThisWeek.length - 5} more_\n`;
      }
      message += `\n`;
    }

    // Summary stats
    const totalTasks = tasksDueToday.length + tasksThisWeek.length + overdueTasks.length;
    message += `\n---\n`;
    message += `${todayEvents.length} events • ${totalTasks} tasks pending`;

    return this.send(message);
  }

  /**
   * Generate and send the evening digest
   */
  async sendEveningDigest(): Promise<NotificationResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // Get what was accomplished today
    const completedToday = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'done'),
          gte(tasks.updatedAt, today)
        )
      )
      .limit(10);

    // Get tomorrow's events
    const tomorrowEvents = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, tomorrow),
          lte(calendarEvents.startTime, dayAfter)
        )
      )
      .orderBy(calendarEvents.startTime);

    // Get tasks due tomorrow
    const tasksDueTomorrow = await db
      .select()
      .from(tasks)
      .where(
        and(
          gte(tasks.dueDate, tomorrow),
          lte(tasks.dueDate, dayAfter),
          not(eq(tasks.status, 'done'))
        )
      )
      .orderBy(tasks.dueDate);

    // Build message
    let message = `🌙 *Evening Wrap-up*\n\n`;

    // What was accomplished
    if (completedToday.length > 0) {
      message += `*✅ Completed Today (${completedToday.length}):*\n`;
      for (const task of completedToday.slice(0, 5)) {
        message += `• ${task.title}\n`;
      }
      if (completedToday.length > 5) {
        message += `  _... and ${completedToday.length - 5} more_\n`;
      }
      message += `\n`;
    } else {
      message += `*No tasks completed today.*\n\n`;
    }

    // Tomorrow preview
    if (tomorrowEvents.length > 0 || tasksDueTomorrow.length > 0) {
      message += `*📌 Tomorrow Preview:*\n`;
      
      for (const event of tomorrowEvents.slice(0, 3)) {
        const time = event.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        message += `📅 ${time} - ${event.title}\n`;
      }
      
      for (const task of tasksDueTomorrow.slice(0, 3)) {
        message += `📋 ${task.title}\n`;
      }
    }

    message += `\n---\n`;
    message += `Rest well! 🌟`;

    return this.send(message);
  }

  // ============================================
  // Immediate Alerts
  // ============================================

  /**
   * Send an urgent deadline alert
   */
  async sendDeadlineAlert(task: {
    title: string;
    dueDate: Date;
    context?: string;
  }): Promise<NotificationResult> {
    const hoursUntil = Math.ceil((task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60));
    
    let urgency = '';
    if (hoursUntil <= 1) {
      urgency = '🚨 URGENT';
    } else if (hoursUntil <= 6) {
      urgency = '⚠️ Due Soon';
    } else if (hoursUntil <= 24) {
      urgency = '📋 Due Today';
    }

    const message = `${urgency}\n\n*${task.title}*\n` +
      `Due: ${task.dueDate.toLocaleString()}\n` +
      (task.context ? `Context: ${task.context}\n` : '') +
      `\n⏰ ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''} remaining`;

    return this.send(message, { priority: hoursUntil <= 1 ? 'urgent' : 'high' });
  }

  /**
   * Send a new assignment alert
   */
  async sendNewAssignmentAlert(assignment: {
    title: string;
    courseName: string;
    dueDate?: Date;
    points?: number;
  }): Promise<NotificationResult> {
    let message = `📚 *New Assignment*\n\n`;
    message += `*${assignment.title}*\n`;
    message += `Course: ${assignment.courseName}\n`;
    
    if (assignment.dueDate) {
      message += `Due: ${assignment.dueDate.toLocaleDateString()}\n`;
    }
    
    if (assignment.points) {
      message += `Points: ${assignment.points}\n`;
    }

    return this.send(message);
  }

  /**
   * Send a calendar reminder
   */
  async sendEventReminder(event: {
    title: string;
    startTime: Date;
    location?: string;
  }, minutesBefore: number): Promise<NotificationResult> {
    const message = `⏰ *Event Reminder*\n\n` +
      `*${event.title}*\n` +
      `Starts in ${minutesBefore} minutes\n` +
      (event.location ? `📍 ${event.location}\n` : '');

    return this.send(message, { priority: minutesBefore <= 15 ? 'high' : 'normal' });
  }

  /**
   * Send an email summary alert
   */
  async sendEmailSummaryAlert(summary: {
    from: string;
    subject: string;
    priority: 'high' | 'normal' | 'low';
    actionRequired: boolean;
    briefSummary: string;
  }): Promise<NotificationResult> {
    const priorityIcon = summary.priority === 'high' ? '🔴' : summary.priority === 'normal' ? '🟡' : '⚪';
    
    let message = `📧 *New Email*\n\n`;
    message += `${priorityIcon} ${summary.actionRequired ? '⚡ Action Required' : ''}\n`;
    message += `From: ${summary.from}\n`;
    message += `Subject: ${summary.subject}\n\n`;
    message += `${summary.briefSummary}`;

    return this.send(message, { priority: summary.priority });
  }

  /**
   * Check and send alerts for upcoming deadlines
   */
  async checkAndSendDeadlineAlerts(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Get tasks due within 24 hours that haven't been notified
    const upcomingTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          gte(tasks.dueDate, now),
          lte(tasks.dueDate, soon),
          not(eq(tasks.status, 'done'))
        )
      );

    for (const task of upcomingTasks) {
      if (!task.dueDate) continue;
      
      const hoursUntil = (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Alert at 24h, 6h, and 1h marks
      if (hoursUntil <= 1 || (hoursUntil <= 6 && hoursUntil > 5.5) || (hoursUntil <= 24 && hoursUntil > 23.5)) {
        await this.sendDeadlineAlert({
          title: task.title,
          dueDate: task.dueDate,
          context: task.context,
        });
      }
    }
  }
}

// ============================================
// Singleton instance
// ============================================

export const notificationService = new NotificationService();
