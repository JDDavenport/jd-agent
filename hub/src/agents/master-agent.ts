import OpenAI from 'openai';
import { MASTER_AGENT_SYSTEM_PROMPT } from './prompts/master';
import { AGENT_TOOLS, type ToolName } from './tools';
import { taskService } from '../services/task-service';
import { vaultService } from '../services/vault-service';
import { calendarService } from '../services/calendar-service';
import { timeTrackingService } from '../services/time-tracking-service';
import { integrityService } from '../services/integrity-service';
import { peopleService } from '../services/people-service';
import { canvasIntegration } from '../integrations/canvas';
import { jobService } from '../services/job-service';
import { getLLMProviderChain, type LLMProviderChain } from '../lib/providers';
import type { LLMMessage, LLMTool, LLMChatResponse } from '../lib/llm-provider';
import type { TaskStatus, TaskSource, EnergyLevel, VaultContentType, VaultSource } from '../types';

// ============================================
// Types
// ============================================

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentContext {
  currentTime: Date;
  todaysTasks: Array<{ id: string; title: string; status: string; dueDate?: Date | null }>;
  upcomingEvents: Array<{ id: string; title: string; startTime: Date; endTime: Date }>;
  taskCounts: Record<string, number>;
}

export interface AgentResponse {
  message: string;
  toolsUsed: string[];
  context?: AgentContext;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Convert our tool format to LLM provider format
function convertToolsToLLM(): LLMTool[] {
  return AGENT_TOOLS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema as Record<string, unknown>,
    },
  }));
}

// Convert our tool format to OpenAI function format (for vision)
function convertToolsToOpenAI(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return AGENT_TOOLS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

// ============================================
// Master Agent Class
// ============================================

export class MasterAgent {
  private client: OpenAI | null = null; // Keep for vision capabilities
  private llmChain: LLMProviderChain;
  private conversationHistory: LLMMessage[] = [];
  private maxHistoryLength = 20;

  constructor() {
    // Initialize the LLM provider chain (Groq -> Gemini -> OpenAI)
    this.llmChain = getLLMProviderChain();

    // Keep OpenAI client for vision (calendar_from_image)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.client = new OpenAI({ apiKey: openaiKey });
    }

    const providers = this.llmChain.getProviders();
    if (providers.length > 0) {
      console.log(`[MasterAgent] Initialized with providers: ${providers.join(', ')}`);
    } else {
      console.log('[MasterAgent] No LLM providers configured - agent will not function');
    }
  }

  /**
   * Check if the agent is configured
   */
  isConfigured(): boolean {
    return this.llmChain.getProviders().length > 0;
  }

  /**
   * Get available providers
   */
  getProviders(): string[] {
    return this.llmChain.getProviders();
  }

  /**
   * Get which provider handled the last request
   */
  getLastProvider(): string | null {
    return this.llmChain.getLastSuccessfulProvider();
  }

  /**
   * Build the current context for the agent
   */
  async buildContext(): Promise<AgentContext> {
    const [todaysTasks, upcomingEvents, taskCounts] = await Promise.all([
      taskService.list({ status: 'today' }),
      calendarService.getUpcoming(3),
      taskService.getCounts(),
    ]);

    return {
      currentTime: new Date(),
      todaysTasks: todaysTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
      })),
      upcomingEvents: upcomingEvents.map(e => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
      })),
      taskCounts,
    };
  }

  /**
   * Build the system prompt with current context
   */
  private buildSystemPrompt(context: AgentContext): string {
    const contextSection = `

## Current Context

**Current Time:** ${context.currentTime.toISOString()}

**Today's Tasks (${context.todaysTasks.length}):**
${context.todaysTasks.length > 0 
  ? context.todaysTasks.map(t => `- [${t.status}] ${t.title}${t.dueDate ? ` (due: ${new Date(t.dueDate).toLocaleTimeString()})` : ''}`).join('\n')
  : '- No tasks scheduled for today'}

**Upcoming Events (next 3 days):**
${context.upcomingEvents.length > 0
  ? context.upcomingEvents.map(e => `- ${e.title} (${new Date(e.startTime).toLocaleString()})`).join('\n')
  : '- No upcoming events'}

**Task Counts:**
- Inbox: ${context.taskCounts.inbox || 0}
- Today: ${context.taskCounts.today || 0}
- Upcoming: ${context.taskCounts.upcoming || 0}
- Waiting: ${context.taskCounts.waiting || 0}
`;

    return MASTER_AGENT_SYSTEM_PROMPT + contextSection;
  }

  /**
   * Execute a tool call
   */
  private async executeTool(name: ToolName, input: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (name) {
        // Task tools
        case 'task_create': {
          // Determine status based on whether scheduledStart is provided
          // If scheduledStart is provided, task is "fully baked" - scheduled for today or upcoming
          // If no scheduledStart, task goes to inbox (needs clarification)
          let status: TaskStatus = 'inbox';
          let scheduledStart: Date | undefined;
          let scheduledEnd: Date | undefined;

          if (input.scheduledStart) {
            scheduledStart = new Date(input.scheduledStart as string);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const scheduledDate = new Date(scheduledStart);
            scheduledDate.setHours(0, 0, 0, 0);

            // If scheduled for today, status is 'today', otherwise 'upcoming'
            status = scheduledDate.getTime() === today.getTime() ? 'today' : 'upcoming';

            // Calculate scheduledEnd if not provided
            if (input.scheduledEnd) {
              scheduledEnd = new Date(input.scheduledEnd as string);
            } else {
              // Default to timeEstimate or 1 hour
              const durationMinutes = (input.timeEstimateMinutes as number) || 60;
              scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);
            }
          }

          const task = await taskService.create({
            title: input.title as string,
            description: input.description as string | undefined,
            status,
            dueDate: input.dueDate ? new Date(input.dueDate as string) : undefined,
            dueDateIsHard: input.dueDateIsHard as boolean | undefined,
            source: (input.source as TaskSource) || 'chat',
            context: (input.context as string) || 'General',
            priority: input.priority as number | undefined,
            timeEstimateMinutes: input.timeEstimateMinutes as number | undefined,
            energyLevel: input.energyLevel as EnergyLevel | undefined,
            scheduledStart,
            scheduledEnd,
          });

          const statusMessage = status === 'inbox'
            ? 'Added to inbox (needs scheduling)'
            : `Scheduled for ${status === 'today' ? 'today' : scheduledStart?.toLocaleDateString()}`;

          return {
            success: true,
            data: {
              id: task.id,
              title: task.title,
              status: task.status,
              scheduledStart: task.scheduledStart,
              dueDate: task.dueDate,
              message: statusMessage,
            }
          };
        }

        case 'task_list': {
          const tasks = await taskService.list({
            status: input.status as TaskStatus | undefined,
            context: input.context as string | undefined,
            dueBefore: input.dueBefore ? new Date(input.dueBefore as string) : undefined,
            dueAfter: input.dueAfter ? new Date(input.dueAfter as string) : undefined,
            includeCompleted: input.includeCompleted as boolean | undefined,
          });
          return {
            success: true,
            data: tasks.map(t => ({
              id: t.id,
              title: t.title,
              status: t.status,
              context: t.context,
              dueDate: t.dueDate,
              priority: t.priority,
            })),
          };
        }

        case 'task_update': {
          const task = await taskService.update(input.taskId as string, {
            title: input.title as string | undefined,
            status: input.status as TaskStatus | undefined,
            dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate as string) : undefined,
            priority: input.priority as number | undefined,
            context: input.context as string | undefined,
          });
          if (!task) return { success: false, error: 'Task not found' };
          return { success: true, data: { id: task.id, title: task.title, status: task.status } };
        }

        case 'task_complete': {
          const task = await taskService.complete(input.taskId as string);
          if (!task) return { success: false, error: 'Task not found' };
          return { success: true, data: { id: task.id, title: task.title, completedAt: task.completedAt } };
        }

        case 'task_counts': {
          const counts = await taskService.getCounts();
          return { success: true, data: counts };
        }

        // Vault tools
        case 'vault_search': {
          const entries = await vaultService.search({
            query: input.query as string,
            context: input.context as string | undefined,
            contentType: input.contentType as VaultContentType | undefined,
            limit: (input.limit as number) || 10,
          });
          return {
            success: true,
            data: entries.map(e => ({
              id: e.id,
              title: e.title,
              contentType: e.contentType,
              context: e.context,
              tags: e.tags,
              preview: e.content?.substring(0, 200) + (e.content && e.content.length > 200 ? '...' : ''),
            })),
          };
        }

        case 'vault_create': {
          const entry = await vaultService.create({
            title: input.title as string,
            content: input.content as string | undefined,
            contentType: input.contentType as VaultContentType,
            context: input.context as string,
            tags: input.tags as string[] | undefined,
            source: (input.source as VaultSource) || 'manual',
          });
          return { success: true, data: { id: entry.id, title: entry.title } };
        }

        case 'vault_get': {
          const entry = await vaultService.getById(input.entryId as string);
          if (!entry) return { success: false, error: 'Entry not found' };
          return { success: true, data: entry };
        }

        case 'vault_stats': {
          const stats = await vaultService.getStats();
          return { success: true, data: stats };
        }

        case 'vault_smart_add': {
          const content = input.content as string;
          const contentLower = content.toLowerCase();

          // Smart classification based on content patterns
          let contentType: VaultContentType = 'note';
          let context = 'General';
          const tags: string[] = input.suggestedTags as string[] || [];

          // Detect content type based on patterns
          if (input.isSensitive ||
              /password|pwd|pass:|secret|api[_\s]?key|token/i.test(content)) {
            contentType = 'credential';
            context = 'Security';
            tags.push('sensitive', 'credential');
          } else if (/ssn|social\s*security|account\s*number|routing|bank|credit\s*card/i.test(content)) {
            contentType = 'financial';
            context = 'Financial';
            tags.push('sensitive', 'financial');
          } else if (/birthday|born|dob|phone|email|address|contact/i.test(content) ||
                     input.relatedPersonName) {
            contentType = 'person';
            context = 'People';
            tags.push('contact-info');
          } else if (/meeting|discussed|agreed|action\s*items/i.test(contentLower)) {
            contentType = 'meeting_notes';
            context = 'Meetings';
          } else if (/medical|doctor|prescription|diagnosis|health/i.test(contentLower)) {
            contentType = 'medical';
            context = 'Health';
            tags.push('sensitive', 'medical');
          } else if (/contract|agreement|legal|attorney|lawyer/i.test(contentLower)) {
            contentType = 'legal';
            context = 'Legal';
            tags.push('legal');
          }

          // Generate title if not provided
          let title = input.title as string;
          if (!title) {
            // Create title from first line or first 50 chars
            const firstLine = content.split('\n')[0].trim();
            title = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
            if (contentType !== 'note') {
              title = `[${contentType.toUpperCase()}] ${title}`;
            }
          }

          // If related to a person, try to find them
          let relatedPersonId: string | undefined;
          if (input.relatedPersonName) {
            const people = await peopleService.list(input.relatedPersonName as string);
            if (people.length > 0) {
              relatedPersonId = people[0].id;
              tags.push(`person:${people[0].name}`);
            }
          }

          const entry = await vaultService.create({
            title,
            content,
            contentType,
            context,
            tags,
            source: 'chat',
          });

          return {
            success: true,
            data: {
              id: entry.id,
              title: entry.title,
              contentType,
              context,
              tags,
              relatedPersonId,
              message: `Saved to vault as ${contentType} in ${context}`,
            },
          };
        }

        // Calendar tools
        case 'calendar_today': {
          const events = await calendarService.getToday();
          return {
            success: true,
            data: events.map(e => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime,
              endTime: e.endTime,
              location: e.location,
              eventType: e.eventType,
            })),
          };
        }

        case 'calendar_upcoming': {
          const days = (input.days as number) || 7;
          const events = await calendarService.getUpcoming(days);
          return {
            success: true,
            data: events.map(e => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime,
              endTime: e.endTime,
              eventType: e.eventType,
            })),
          };
        }

        case 'calendar_query': {
          const events = await calendarService.list({
            startDate: new Date(input.startDate as string),
            endDate: new Date(input.endDate as string),
            eventType: input.eventType as string | undefined,
          });
          return { success: true, data: events };
        }

        case 'calendar_create': {
          const event = await calendarService.create({
            title: input.title as string,
            description: input.description as string | undefined,
            startTime: new Date(input.startTime as string),
            endTime: new Date(input.endTime as string),
            location: input.location as string | undefined,
            attendees: input.attendees as string[] | undefined,
            eventType: input.eventType as any,
            context: input.context as string | undefined,
          });
          return {
            success: true,
            data: {
              id: event.id,
              title: event.title,
              startTime: event.startTime,
              location: event.location,
              attendees: event.attendees,
            }
          };
        }

        case 'calendar_check_conflicts': {
          const result = await calendarService.checkConflicts(
            new Date(input.startTime as string),
            new Date(input.endTime as string)
          );
          return {
            success: true,
            data: {
              hasConflict: result.hasConflict,
              conflicts: result.conflictingEvents.map(e => ({ title: e.title, startTime: e.startTime })),
            },
          };
        }

        case 'calendar_from_image': {
          // Use OpenAI Vision to extract event details from image
          if (!this.client) {
            return { success: false, error: 'OpenAI client not configured' };
          }

          const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

          if (input.imageUrl) {
            imageContent.push({
              type: 'image_url',
              image_url: { url: input.imageUrl as string },
            });
          } else if (input.imageBase64) {
            imageContent.push({
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` },
            });
          } else {
            return { success: false, error: 'Either imageUrl or imageBase64 must be provided' };
          }

          const additionalContext = input.additionalContext as string || '';

          try {
            const visionResponse = await this.client.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Extract event details from this image. Return a JSON object with:
- title: event name/title
- date: the date in YYYY-MM-DD format (use ${new Date().getFullYear()} if year not specified)
- startTime: start time in HH:MM format (24 hour)
- endTime: end time in HH:MM format (24 hour), estimate if not shown
- location: address or venue name if visible
- attendees: array of any names/people mentioned
- description: any other relevant details

Additional context: ${additionalContext}

Return ONLY valid JSON, no markdown.`,
                    },
                    ...imageContent,
                  ],
                },
              ],
              max_tokens: 500,
            });

            const extractedText = visionResponse.choices[0].message.content || '';

            // Parse the JSON response
            let eventDetails;
            try {
              eventDetails = JSON.parse(extractedText);
            } catch {
              return {
                success: false,
                error: 'Could not parse event details from image',
                rawExtraction: extractedText,
              };
            }

            // Build the date/time
            const eventDate = eventDetails.date || new Date().toISOString().split('T')[0];
            const startTimeStr = eventDetails.startTime || '09:00';
            const endTimeStr = eventDetails.endTime || '10:00';

            const startTime = new Date(`${eventDate}T${startTimeStr}:00`);
            const endTime = new Date(`${eventDate}T${endTimeStr}:00`);

            // Create the calendar event
            const event = await calendarService.create({
              title: eventDetails.title || 'Event from image',
              description: eventDetails.description,
              startTime,
              endTime,
              location: eventDetails.location,
              attendees: eventDetails.attendees,
              eventType: 'meeting',
            });

            return {
              success: true,
              data: {
                id: event.id,
                title: event.title,
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location,
                attendees: event.attendees,
                extractedDetails: eventDetails,
                message: `Created event "${event.title}" from image`,
              },
            };
          } catch (error) {
            console.error('[MasterAgent] Vision extraction failed:', error);
            return { success: false, error: `Failed to extract event from image: ${error}` };
          }
        }

        // Canvas/Ingestion tools
        case 'canvas_sync': {
          if (!canvasIntegration.isConfigured()) {
            return { success: false, error: 'Canvas not configured' };
          }
          const result = await canvasIntegration.fullSync();
          return {
            success: true,
            data: {
              courses: result.courses,
              assignments: result.assignments,
              announcements: result.announcements,
              errors: result.errors.length,
            },
          };
        }

        case 'canvas_assignments': {
          if (!canvasIntegration.isConfigured()) {
            return { success: false, error: 'Canvas not configured' };
          }
          const assignments = await canvasIntegration.getUpcomingAssignments();
          return {
            success: true,
            data: assignments.slice(0, 20).map(a => ({
              name: a.name,
              course: a.courseName,
              dueAt: a.due_at,
              points: a.points_possible,
            })),
          };
        }

        // Time tracking tools
        case 'time_log': {
          const date = (input.date as string) || new Date().toISOString().split('T')[0];
          const result = await timeTrackingService.logDay({
            date,
            totalScreenTime: input.totalScreenTimeMinutes as number | undefined,
            productive: input.productiveMinutes as number | undefined,
            waste: input.wasteMinutes as number | undefined,
          });
          return { success: true, data: result };
        }

        case 'time_report': {
          const dateStr = (input.date as string) || undefined;
          const reportDate = dateStr ? new Date(dateStr) : new Date();
          const report = await timeTrackingService.getDailyReport(reportDate);
          return { success: true, data: report };
        }

        case 'time_stats': {
          const days = (input.days as number) || 7;
          const stats = await timeTrackingService.getStats(days);
          return { success: true, data: stats };
        }

        // Scheduling tools
        case 'schedule_task': {
          const { schedulingService } = await import('../services/scheduling-service');
          const result = await schedulingService.scheduleTask({
            taskId: input.taskId as string,
            startTime: new Date(input.startTime as string),
            endTime: input.endTime ? new Date(input.endTime as string) : undefined,
            createCalendarEvent: input.createCalendarEvent as boolean ?? true,
          });
          return { success: result.success, data: result };
        }

        case 'schedule_suggestions': {
          const { schedulingService } = await import('../services/scheduling-service');
          const days = (input.days as number) || 7;
          const suggestions = await schedulingService.suggestSchedule(days);
          return {
            success: true,
            data: suggestions.map(s => ({
              taskId: s.task.id,
              title: s.task.title,
              dueDate: s.task.dueDate,
              suggestedStart: s.suggestedStart,
              suggestedEnd: s.suggestedEnd,
              reason: s.reason,
            })),
          };
        }

        case 'schedule_today': {
          const { schedulingService } = await import('../services/scheduling-service');
          const tasks = await schedulingService.getTodaysSchedule();
          return {
            success: true,
            data: tasks.map(t => ({
              id: t.id,
              title: t.title,
              context: t.context,
              scheduledStart: t.scheduledStart,
              scheduledEnd: t.scheduledEnd,
              dueDate: t.dueDate,
            })),
          };
        }

        case 'unschedule_task': {
          const { schedulingService } = await import('../services/scheduling-service');
          const result = await schedulingService.unscheduleTask(input.taskId as string);
          return { success: result.success, error: result.error };
        }

        // System tools
        case 'system_health': {
          const health = await integrityService.getHealthSummary();
          return { success: true, data: health };
        }

        case 'integrity_check': {
          const autoFix = (input.autoFix as boolean) || false;
          const report = await integrityService.runAllChecks(autoFix);
          return {
            success: true,
            data: {
              health: report.overallHealth,
              passed: report.passed,
              failed: report.failed,
              warnings: report.warnings,
              checks: report.checks.map(c => ({
                type: c.type,
                passed: c.passed,
                message: c.message,
              })),
            },
          };
        }

        // People tools
        case 'people_create': {
          const person = await peopleService.create({
            name: input.name as string,
            email: input.email as string | undefined,
            phone: input.phone as string | undefined,
            howMet: input.howMet as string | undefined,
            whereMet: input.whereMet as string | undefined,
            firstMetDate: input.firstMetDate as string | undefined,
            relationshipType: input.relationshipType as string | undefined,
            keyFacts: input.keyFacts as string[] | undefined,
            notes: input.notes as string | undefined,
          });
          return {
            success: true,
            data: {
              id: person.id,
              name: person.name,
              relationshipType: person.relationshipType,
              message: `Added ${person.name} to people database`,
            },
          };
        }

        case 'people_search': {
          const people = await peopleService.list(input.query as string);
          return {
            success: true,
            data: people.map(p => ({
              id: p.id,
              name: p.name,
              email: p.email,
              phone: p.phone,
              relationshipType: p.relationshipType,
              lastInteractionDate: p.lastInteractionDate,
            })),
          };
        }

        case 'people_get': {
          const person = await peopleService.getWithInteractions(input.personId as string);
          if (!person) return { success: false, error: 'Person not found' };
          return { success: true, data: person };
        }

        case 'people_update': {
          const updated = await peopleService.update(input.personId as string, {
            name: input.name as string | undefined,
            email: input.email as string | undefined,
            phone: input.phone as string | undefined,
            keyFacts: input.keyFacts as string[] | undefined,
            notes: input.notes as string | undefined,
            relationshipType: input.relationshipType as string | undefined,
          });
          if (!updated) return { success: false, error: 'Person not found' };
          return {
            success: true,
            data: {
              id: updated.id,
              name: updated.name,
              message: `Updated ${updated.name}`,
            },
          };
        }

        case 'people_add_interaction': {
          const interaction = await peopleService.addInteraction({
            personId: input.personId as string,
            interactionDate: input.interactionDate as string,
            interactionType: input.interactionType as string | undefined,
            summary: input.summary as string | undefined,
            commitmentsByThem: input.commitmentsByThem as string[] | undefined,
            commitmentsByMe: input.commitmentsByMe as string[] | undefined,
          });
          return {
            success: true,
            data: {
              id: interaction.id,
              personId: interaction.personId,
              message: 'Logged interaction',
            },
          };
        }

        // Utility tools
        case 'get_current_context': {
          const context = await this.buildContext();
          return { success: true, data: context };
        }

        // Job hunting tools
        case 'job_search': {
          const jobs = await jobService.list({
            status: input.status as any,
            company: input.query as string | undefined,
          });

          // Filter by query if provided
          let filtered = jobs;
          if (input.query) {
            const query = (input.query as string).toLowerCase();
            filtered = jobs.filter(
              (j) =>
                j.title.toLowerCase().includes(query) ||
                j.company.toLowerCase().includes(query)
            );
          }

          const limit = (input.limit as number) || 10;
          return {
            success: true,
            data: filtered.slice(0, limit).map((j) => ({
              id: j.id,
              company: j.company,
              title: j.title,
              status: j.status,
              matchScore: j.matchScore,
              appliedAt: j.appliedAt,
            })),
          };
        }

        case 'job_stats': {
          const stats = await jobService.getStats();
          return { success: true, data: stats };
        }

        case 'job_update_status': {
          const job = await jobService.update(input.jobId as string, {
            status: input.status as any,
            notes: input.notes as string | undefined,
          });
          if (!job) return { success: false, error: 'Job not found' };
          return {
            success: true,
            data: {
              id: job.id,
              company: job.company,
              title: job.title,
              status: job.status,
              message: `Updated ${job.company} - ${job.title} to ${job.status}`,
            },
          };
        }

        case 'job_followups': {
          const followUps = await jobService.getFollowUps();
          return {
            success: true,
            data: followUps.map((j) => ({
              id: j.id,
              company: j.company,
              title: j.title,
              status: j.status,
              nextFollowUp: j.nextFollowUp,
            })),
          };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      console.error(`[MasterAgent] Tool ${name} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Chat with the agent using the LLM provider chain
   */
  async chat(userMessage: string): Promise<AgentResponse> {
    if (!this.isConfigured()) {
      return {
        message: 'Agent not configured. Please set at least one LLM provider API key (GROQ_API_KEY, GOOGLE_AI_API_KEY, or OPENAI_API_KEY).',
        toolsUsed: [],
      };
    }

    const toolsUsed: string[] = [];
    const context = await this.buildContext();
    const systemPrompt = this.buildSystemPrompt(context);
    const tools = convertToolsToLLM();

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Trim history if too long
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }

    try {
      // Build messages for the LLM
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory,
      ];

      let response = await this.llmChain.chat(messages, tools, { toolChoice: 'auto' });

      // Process tool calls in a loop until we get a final response
      while (response.toolCalls && response.toolCalls.length > 0) {
        // Add assistant message with tool calls to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content,
          tool_calls: response.toolCalls,
        });

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name as ToolName;
          const toolInput = JSON.parse(toolCall.function.arguments);

          console.log(`[MasterAgent] Executing tool: ${toolName} (via ${response.provider})`);
          toolsUsed.push(toolName);

          const result = await this.executeTool(toolName, toolInput);

          // Add tool result to history
          this.conversationHistory.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          });
        }

        // Continue the conversation
        const continueMessages: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory,
        ];

        response = await this.llmChain.chat(continueMessages, tools, { toolChoice: 'auto' });
      }

      // Extract final text response
      const finalMessage = response.content || 'I completed the requested actions.';

      // Add final response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalMessage,
      });

      console.log(`[MasterAgent] Response from ${response.provider}`);

      return {
        message: finalMessage,
        toolsUsed,
        context,
      };
    } catch (error) {
      console.error('[MasterAgent] Chat failed:', error);
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history length
   */
  getHistoryLength(): number {
    return this.conversationHistory.length;
  }
}

// ============================================
// Singleton instance
// ============================================

let agentInstance: MasterAgent | null = null;

export function getMasterAgent(): MasterAgent {
  if (!agentInstance) {
    agentInstance = new MasterAgent();
  }
  return agentInstance;
}

export { MasterAgent as default };
