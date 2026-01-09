/**
 * JD Agent - Setup Wizard Service
 * 
 * Manages initial setup and configuration:
 * - Credential verification
 * - Service connection testing
 * - Setup progress tracking
 */

import { db } from '../db/client';
import { classes, tasks, systemLogs } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { notificationService } from './notification-service';
import { canvasIntegration } from '../integrations/canvas';

// ============================================
// Types
// ============================================

export type ServiceName =
  | 'database'
  | 'openai'
  | 'telegram'
  | 'twilio'
  | 'resend'
  | 'google_calendar'
  | 'canvas'
  | 'remarkable';

export interface ServiceStatus {
  name: ServiceName;
  displayName: string;
  configured: boolean;
  connected: boolean;
  details?: string;
  error?: string;
  required: boolean;
}

export interface SetupStatus {
  complete: boolean;
  currentStep: number;
  totalSteps: number;
  steps: SetupStep[];
  services: ServiceStatus[];
}

export interface SetupStep {
  id: string;
  name: string;
  description: string;
  complete: boolean;
  skippable: boolean;
}

export interface CeremonyConfig {
  morningTime: string; // HH:MM format
  eveningTime: string;
  notificationChannel: 'telegram' | 'sms' | 'email';
  phoneNumber?: string;
  email?: string;
}

export interface ClassInfo {
  name: string;
  courseCode: string;
  professor?: string;
  canvasCourseId?: string;
  schedule?: {
    days: string[]; // ['Monday', 'Wednesday', 'Friday']
    startTime: string; // HH:MM
    endTime: string;
  };
}

// ============================================
// Setup Service
// ============================================

export class SetupService {
  private setupSteps: SetupStep[] = [
    {
      id: 'connect',
      name: 'Connect Services',
      description: 'Connect your accounts and verify API keys',
      complete: false,
      skippable: false,
    },
    {
      id: 'brain-dump',
      name: 'Brain Dump',
      description: 'Get everything out of your head into your inbox',
      complete: false,
      skippable: true,
    },
    {
      id: 'process-inbox',
      name: 'Process Inbox',
      description: 'Organize your inbox items with dates and labels',
      complete: false,
      skippable: true,
    },
    {
      id: 'ceremonies',
      name: 'Set Up Ceremonies',
      description: 'Configure your morning and evening briefings',
      complete: false,
      skippable: true,
    },
    {
      id: 'classes',
      name: 'Add Classes',
      description: 'Set up your class schedule (for students)',
      complete: false,
      skippable: true,
    },
    {
      id: 'complete',
      name: 'Complete',
      description: 'Review and finish setup',
      complete: false,
      skippable: false,
    },
  ];

  /**
   * Get overall setup status
   */
  async getStatus(): Promise<SetupStatus> {
    const services = await this.checkAllServices();
    
    // Check if essential services are connected
    const essentialConnected = services
      .filter(s => s.required)
      .every(s => s.connected);

    // Determine current step based on what's complete
    const steps = [...this.setupSteps];
    steps[0].complete = essentialConnected;

    // Check if user has done brain dump (has any manual tasks)
    const manualTaskCount = await this.countManualTasks();
    steps[1].complete = manualTaskCount > 0;

    // Check if inbox is processed (less than 5 items or user marked complete)
    const inboxCount = await this.countInboxTasks();
    steps[2].complete = inboxCount < 5;

    // Check if ceremonies are configured
    steps[3].complete = notificationService.isConfigured();

    // Check if classes are added
    const classCount = await this.countClasses();
    steps[4].complete = classCount > 0;

    // Final step
    const allPreviousComplete = steps.slice(0, 5).every(s => s.complete || s.skippable);
    steps[5].complete = allPreviousComplete;

    const currentStep = steps.findIndex(s => !s.complete && !s.skippable) + 1 || 
                        steps.findIndex(s => !s.complete) + 1 || 
                        steps.length;

    return {
      complete: steps.every(s => s.complete || s.skippable),
      currentStep,
      totalSteps: steps.length,
      steps,
      services,
    };
  }

  /**
   * Check all service connections
   */
  async checkAllServices(): Promise<ServiceStatus[]> {
    const services: ServiceStatus[] = [];

    // Database
    services.push(await this.checkDatabase());

    // OpenAI
    services.push(await this.checkOpenAI());

    // Telegram
    services.push(await this.checkTelegram());

    // Twilio
    services.push(this.checkTwilio());

    // Resend
    services.push(this.checkResend());

    // Google Calendar
    services.push(await this.checkGoogleCalendar());

    // Canvas
    services.push(await this.checkCanvas());

    // Remarkable
    services.push(this.checkRemarkable());

    return services;
  }

  /**
   * Check database connection
   */
  private async checkDatabase(): Promise<ServiceStatus> {
    try {
      await db.execute(sql`SELECT 1`);
      return {
        name: 'database',
        displayName: 'PostgreSQL Database',
        configured: true,
        connected: true,
        details: 'Connected',
        required: true,
      };
    } catch (error) {
      return {
        name: 'database',
        displayName: 'PostgreSQL Database',
        configured: !!process.env.DATABASE_URL,
        connected: false,
        error: String(error),
        required: true,
      };
    }
  }

  /**
   * Check OpenAI connection
   */
  private async checkOpenAI(): Promise<ServiceStatus> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        name: 'openai',
        displayName: 'OpenAI GPT-4',
        configured: false,
        connected: false,
        required: true,
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      
      if (response.ok) {
        return {
          name: 'openai',
          displayName: 'OpenAI GPT-4',
          configured: true,
          connected: true,
          details: 'API key valid',
          required: true,
        };
      } else {
        return {
          name: 'openai',
          displayName: 'OpenAI GPT-4',
          configured: true,
          connected: false,
          error: 'Invalid API key',
          required: true,
        };
      }
    } catch (error) {
      return {
        name: 'openai',
        displayName: 'OpenAI GPT-4',
        configured: true,
        connected: false,
        error: String(error),
        required: true,
      };
    }
  }

  /**
   * Check Telegram connection
   */
  private async checkTelegram(): Promise<ServiceStatus> {
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token) {
      return {
        name: 'telegram',
        displayName: 'Telegram Bot',
        configured: false,
        connected: false,
        required: false,
      };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json() as { ok: boolean; result?: { username: string } };

      if (data.ok && data.result) {
        return {
          name: 'telegram',
          displayName: 'Telegram Bot',
          configured: true,
          connected: !!chatId,
          details: chatId ? `@${data.result.username} connected` : `@${data.result.username} - needs chat ID`,
          required: false,
        };
      }
      return {
        name: 'telegram',
        displayName: 'Telegram Bot',
        configured: true,
        connected: false,
        error: 'Invalid token',
        required: false,
      };
    } catch (error) {
      return {
        name: 'telegram',
        displayName: 'Telegram Bot',
        configured: true,
        connected: false,
        error: String(error),
        required: false,
      };
    }
  }

  /**
   * Check Twilio configuration
   */
  private checkTwilio(): ServiceStatus {
    const configured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER &&
      process.env.USER_PHONE_NUMBER
    );

    return {
      name: 'twilio',
      displayName: 'Twilio SMS',
      configured,
      connected: configured, // Will verify on test
      details: configured ? 'Configured' : undefined,
      required: false,
    };
  }

  /**
   * Check Resend configuration
   */
  private checkResend(): ServiceStatus {
    const configured = !!(
      process.env.RESEND_API_KEY &&
      (process.env.USER_EMAIL || process.env.GOOGLE_USER_EMAIL)
    );

    return {
      name: 'resend',
      displayName: 'Resend Email',
      configured,
      connected: configured,
      details: configured ? 'Configured' : undefined,
      required: false,
    };
  }

  /**
   * Check Google Calendar connection
   */
  private async checkGoogleCalendar(): Promise<ServiceStatus> {
    const configured = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
    );

    if (!configured) {
      return {
        name: 'google_calendar',
        displayName: 'Google Calendar',
        configured: false,
        connected: false,
        required: false,
      };
    }

    // Could test the connection here, but for now just check config
    return {
      name: 'google_calendar',
      displayName: 'Google Calendar',
      configured: true,
      connected: true,
      details: process.env.GOOGLE_CALENDAR_ID || 'Configured',
      required: false,
    };
  }

  /**
   * Check Canvas connection
   */
  private async checkCanvas(): Promise<ServiceStatus> {
    if (!canvasIntegration.isConfigured()) {
      return {
        name: 'canvas',
        displayName: 'Canvas LMS',
        configured: false,
        connected: false,
        required: false,
      };
    }

    try {
      const courses = await canvasIntegration.getCourses();
      return {
        name: 'canvas',
        displayName: 'Canvas LMS',
        configured: true,
        connected: true,
        details: `${courses.length} courses found`,
        required: false,
      };
    } catch (error) {
      return {
        name: 'canvas',
        displayName: 'Canvas LMS',
        configured: true,
        connected: false,
        error: String(error),
        required: false,
      };
    }
  }

  /**
   * Check Remarkable configuration
   */
  private checkRemarkable(): ServiceStatus {
    const syncPath = process.env.REMARKABLE_SYNC_PATH;
    
    return {
      name: 'remarkable',
      displayName: 'Remarkable Tablet',
      configured: !!syncPath,
      connected: !!syncPath,
      details: syncPath ? `Watching: ${syncPath}` : undefined,
      required: false,
    };
  }

  /**
   * Test a specific service
   */
  async testService(service: ServiceName): Promise<{ success: boolean; message: string }> {
    switch (service) {
      case 'telegram': {
        const result = await notificationService.sendTelegram('🧪 Test notification from JD Agent setup wizard!');
        return {
          success: result.success,
          message: result.success ? 'Test message sent to Telegram!' : result.error || 'Failed to send',
        };
      }
      
      case 'twilio': {
        const result = await notificationService.sendSms('🧪 Test SMS from JD Agent setup wizard!');
        return {
          success: result.success,
          message: result.success ? 'Test SMS sent!' : result.error || 'Failed to send',
        };
      }
      
      case 'resend': {
        const result = await notificationService.sendEmail(
          'JD Agent Test',
          '🧪 This is a test email from your JD Agent setup wizard!'
        );
        return {
          success: result.success,
          message: result.success ? 'Test email sent!' : result.error || 'Failed to send',
        };
      }
      
      case 'canvas': {
        try {
          const courses = await canvasIntegration.getCourses();
          return {
            success: true,
            message: `Successfully connected! Found ${courses.length} courses.`,
          };
        } catch (error) {
          return { success: false, message: String(error) };
        }
      }

      default:
        return { success: false, message: 'Test not available for this service' };
    }
  }

  /**
   * Count manual tasks (for brain dump check)
   */
  private async countManualTasks(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(eq(tasks.source, 'manual'));
    return Number(result[0]?.count || 0);
  }

  /**
   * Count inbox tasks
   */
  private async countInboxTasks(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(eq(tasks.status, 'inbox'));
    return Number(result[0]?.count || 0);
  }

  /**
   * Count classes
   */
  private async countClasses(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes);
    return Number(result[0]?.count || 0);
  }

  /**
   * Add a class
   */
  async addClass(classInfo: ClassInfo): Promise<{ id: string }> {
    const [newClass] = await db.insert(classes).values({
      name: classInfo.name,
      code: classInfo.courseCode,
      professor: classInfo.professor,
      canvasCourseId: classInfo.canvasCourseId,
      schedule: classInfo.schedule ? {
        days: classInfo.schedule.days,
        startTime: classInfo.schedule.startTime,
        endTime: classInfo.schedule.endTime,
      } : null,
      status: 'active',
    }).returning();

    return { id: newClass.id };
  }

  /**
   * Get all classes
   */
  async getClasses(): Promise<Array<{
    id: string;
    name: string;
    code: string | null;
    professor: string | null;
    canvasCourseId: string | null;
  }>> {
    const result = await db.select().from(classes);
    return result.map(c => ({
      id: c.id,
      name: c.name,
      code: c.code,
      professor: c.professor,
      canvasCourseId: c.canvasCourseId,
    }));
  }

  /**
   * Mark setup as complete
   */
  async markComplete(): Promise<void> {
    await db.insert(systemLogs).values({
      logType: 'info',
      component: 'setup',
      message: 'Setup wizard completed',
      details: { completedAt: new Date().toISOString() },
    });
  }
}

// ============================================
// Singleton instance
// ============================================

export const setupService = new SetupService();
