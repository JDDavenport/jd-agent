/**
 * Voice Command Service
 *
 * Detects and processes voice commands from transcripts.
 * Supports wake word detection ("Plaud") and command parsing.
 *
 * Phase 3 of VIP Pipeline implementation.
 */

import { db } from '../db/client';
import { tasks, speakerMappings, voiceProfiles } from '../db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export type CommandType = 'task' | 'reminder' | 'note' | 'highlight' | 'event';

export interface DetectedCommand {
  type: CommandType;
  rawText: string;
  parsedIntent: {
    action: string;
    subject: string;
    dueDate?: Date;
    priority?: number;
  };
  timestampSeconds: number;
  speakerId: number;
  confidence: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
}

export interface CommandExecutionResult {
  success: boolean;
  commandType: CommandType;
  createdId?: string;
  error?: string;
}

// ============================================
// Wake Word Patterns
// ============================================

// Wake word variations (Plaud might be transcribed differently)
const WAKE_WORDS = [
  'plaud',
  'plod',
  'plod',
  'cloud',  // Common mishearing
  'plot',
  'plaid',
];

// Command patterns after wake word
const COMMAND_PATTERNS: Array<{
  pattern: RegExp;
  type: CommandType;
  extractAction: (match: RegExpMatchArray) => { action: string; subject: string };
}> = [
  // Task creation: "Plaud, add task call mom"
  {
    pattern: /(?:add|create|new)\s+(?:a\s+)?task\s+(.+)/i,
    type: 'task',
    extractAction: (match) => ({ action: 'create_task', subject: match[1].trim() }),
  },
  // Reminder: "Plaud, remind me to submit assignment"
  {
    pattern: /remind\s+(?:me\s+)?(?:to\s+)?(.+)/i,
    type: 'reminder',
    extractAction: (match) => ({ action: 'create_reminder', subject: match[1].trim() }),
  },
  // Note: "Plaud, note important point about X"
  {
    pattern: /note\s*[:\s]+(.+)/i,
    type: 'note',
    extractAction: (match) => ({ action: 'create_note', subject: match[1].trim() }),
  },
  // Highlight: "Plaud, highlight this" or "Plaud, mark this important"
  {
    pattern: /(?:highlight|mark)\s+(?:this|that|important)?\s*(.*)$/i,
    type: 'highlight',
    extractAction: (match) => ({ action: 'highlight', subject: match[1]?.trim() || 'marked section' }),
  },
  // Event: "Plaud, schedule meeting with John tomorrow"
  {
    pattern: /schedule\s+(.+)/i,
    type: 'event',
    extractAction: (match) => ({ action: 'create_event', subject: match[1].trim() }),
  },
  // Todo shorthand: "Plaud, todo buy groceries"
  {
    pattern: /(?:todo|to-do|to do)\s+(.+)/i,
    type: 'task',
    extractAction: (match) => ({ action: 'create_task', subject: match[1].trim() }),
  },
];

// Date extraction patterns
const DATE_PATTERNS: Array<{ pattern: RegExp; getDate: () => Date }> = [
  { pattern: /\btoday\b/i, getDate: () => new Date() },
  { pattern: /\btomorrow\b/i, getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; } },
  { pattern: /\bmonday\b/i, getDate: () => getNextDayOfWeek(1) },
  { pattern: /\btuesday\b/i, getDate: () => getNextDayOfWeek(2) },
  { pattern: /\bwednesday\b/i, getDate: () => getNextDayOfWeek(3) },
  { pattern: /\bthursday\b/i, getDate: () => getNextDayOfWeek(4) },
  { pattern: /\bfriday\b/i, getDate: () => getNextDayOfWeek(5) },
  { pattern: /\bsaturday\b/i, getDate: () => getNextDayOfWeek(6) },
  { pattern: /\bsunday\b/i, getDate: () => getNextDayOfWeek(0) },
  { pattern: /\bnext week\b/i, getDate: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; } },
  { pattern: /\bend of (?:the )?week\b/i, getDate: () => getNextDayOfWeek(5) }, // Friday
];

// Priority keywords
const PRIORITY_KEYWORDS: Array<{ pattern: RegExp; priority: number }> = [
  { pattern: /\b(?:urgent|asap|immediately)\b/i, priority: 4 },
  { pattern: /\b(?:high priority|important)\b/i, priority: 3 },
  { pattern: /\b(?:medium priority)\b/i, priority: 2 },
  { pattern: /\b(?:low priority|when you can|eventually)\b/i, priority: 1 },
];

// ============================================
// Helper Functions
// ============================================

function getNextDayOfWeek(dayOfWeek: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  const result = new Date(today);
  result.setDate(today.getDate() + daysUntil);
  result.setHours(23, 59, 59, 0);
  return result;
}

function extractDate(text: string): Date | undefined {
  for (const { pattern, getDate } of DATE_PATTERNS) {
    if (pattern.test(text)) {
      return getDate();
    }
  }
  return undefined;
}

function extractPriority(text: string): number {
  for (const { pattern, priority } of PRIORITY_KEYWORDS) {
    if (pattern.test(text)) {
      return priority;
    }
  }
  return 0; // No priority
}

function containsWakeWord(text: string): boolean {
  const lowerText = text.toLowerCase();
  return WAKE_WORDS.some(word => lowerText.includes(word));
}

function extractCommandAfterWakeWord(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const wakeWord of WAKE_WORDS) {
    const wakeIndex = lowerText.indexOf(wakeWord);
    if (wakeIndex !== -1) {
      // Get text after wake word, removing common separators
      const afterWake = text.substring(wakeIndex + wakeWord.length).replace(/^[,.\s]+/, '').trim();
      if (afterWake.length > 0) {
        return afterWake;
      }
    }
  }

  return null;
}

// ============================================
// Voice Command Service
// ============================================

class VoiceCommandService {
  /**
   * Detect commands in transcript segments
   */
  detectCommands(segments: TranscriptSegment[]): DetectedCommand[] {
    const commands: DetectedCommand[] = [];

    for (const segment of segments) {
      if (!containsWakeWord(segment.text)) {
        continue;
      }

      const commandText = extractCommandAfterWakeWord(segment.text);
      if (!commandText) {
        continue;
      }

      // Try to match against command patterns
      for (const { pattern, type, extractAction } of COMMAND_PATTERNS) {
        const match = commandText.match(pattern);
        if (match) {
          const { action, subject } = extractAction(match);
          const dueDate = extractDate(commandText);
          const priority = extractPriority(commandText);

          commands.push({
            type,
            rawText: segment.text,
            parsedIntent: {
              action,
              subject,
              dueDate,
              priority: priority > 0 ? priority : undefined,
            },
            timestampSeconds: segment.start,
            speakerId: segment.speaker ?? 0,
            confidence: 0.9, // High confidence for pattern match
          });

          break; // Only one command per segment
        }
      }
    }

    return commands;
  }

  /**
   * Check if a speaker is the self (JD) profile
   */
  async isSelfSpeaker(transcriptId: string, speakerId: number): Promise<boolean> {
    try {
      const [mapping] = await db
        .select({
          category: voiceProfiles.category,
        })
        .from(speakerMappings)
        .innerJoin(voiceProfiles, eq(speakerMappings.voiceProfileId, voiceProfiles.id))
        .where(
          and(
            eq(speakerMappings.transcriptId, transcriptId),
            eq(speakerMappings.deepgramSpeakerId, speakerId)
          )
        );

      return mapping?.category === 'self';
    } catch {
      return false;
    }
  }

  /**
   * Execute a detected command
   */
  async executeCommand(
    command: DetectedCommand,
    options: {
      transcriptId: string;
      recordingId: string;
      skipVerification?: boolean;
    }
  ): Promise<CommandExecutionResult> {
    const { transcriptId, recordingId, skipVerification } = options;

    // Verify speaker is self (unless skipped)
    if (!skipVerification) {
      const isSelf = await this.isSelfSpeaker(transcriptId, command.speakerId);
      if (!isSelf) {
        console.log(`[VoiceCommand] Skipping command from non-self speaker ${command.speakerId}`);
        return {
          success: false,
          commandType: command.type,
          error: 'Command not from self speaker',
        };
      }
    }

    try {
      switch (command.type) {
        case 'task':
        case 'reminder':
        case 'note':
          return await this.createTaskFromCommand(command, recordingId);

        case 'highlight':
          // For now, highlights just create a task with a special label
          return await this.createTaskFromCommand(
            { ...command, parsedIntent: { ...command.parsedIntent, subject: `Highlight: ${command.parsedIntent.subject}` } },
            recordingId
          );

        case 'event':
          // For now, events create tasks (calendar integration later)
          return await this.createTaskFromCommand(command, recordingId);

        default:
          return {
            success: false,
            commandType: command.type,
            error: `Unknown command type: ${command.type}`,
          };
      }
    } catch (error) {
      console.error(`[VoiceCommand] Error executing command:`, error);
      return {
        success: false,
        commandType: command.type,
        error: String(error),
      };
    }
  }

  /**
   * Create a task from a voice command
   */
  private async createTaskFromCommand(
    command: DetectedCommand,
    recordingId: string
  ): Promise<CommandExecutionResult> {
    const { subject, dueDate, priority } = command.parsedIntent;

    // Clean up the subject (remove date/priority words)
    let cleanSubject = subject
      .replace(/\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      .replace(/\b(?:next week|end of week)\b/gi, '')
      .replace(/\b(?:urgent|asap|immediately|high priority|important|medium priority|low priority|when you can|eventually)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter
    cleanSubject = cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1);

    const [task] = await db
      .insert(tasks)
      .values({
        title: cleanSubject,
        status: 'inbox',
        priority: priority || 0,
        dueDate: dueDate || null,
        source: 'voice_command',
        sourceRef: `recording:${recordingId}`,
        context: 'voice',
      })
      .returning();

    console.log(`[VoiceCommand] Created task: ${task.title}`);

    return {
      success: true,
      commandType: command.type,
      createdId: task.id,
    };
  }

  /**
   * Process all commands from a transcript
   * Returns summary of executed commands
   */
  async processTranscriptCommands(
    segments: TranscriptSegment[],
    transcriptId: string,
    recordingId: string
  ): Promise<{
    detected: number;
    executed: number;
    skipped: number;
    commands: Array<{
      command: DetectedCommand;
      result: CommandExecutionResult;
    }>;
  }> {
    const detectedCommands = this.detectCommands(segments);
    const results: Array<{ command: DetectedCommand; result: CommandExecutionResult }> = [];

    let executed = 0;
    let skipped = 0;

    for (const command of detectedCommands) {
      const result = await this.executeCommand(command, {
        transcriptId,
        recordingId,
      });

      results.push({ command, result });

      if (result.success) {
        executed++;
      } else {
        skipped++;
      }
    }

    return {
      detected: detectedCommands.length,
      executed,
      skipped,
      commands: results,
    };
  }
}

export const voiceCommandService = new VoiceCommandService();
