/**
 * JD Agent - Email Triage Job Processor
 * 
 * Analyzes emails and determines:
 * - Action required vs FYI vs Spam
 * - Priority level
 * - Tasks to extract
 * - Suggested replies
 */

import { Job } from 'bullmq';
import OpenAI from 'openai';
import { db } from '../../db/client';
import { tasks, vaultEntries } from '../../db/schema';
import type { EmailTriageJobData } from '../queue';

// ============================================
// Triage Prompt
// ============================================

const EMAIL_TRIAGE_PROMPT = `You are an expert email assistant. Analyze this email and determine how to handle it.

Classify the email:
1. **Category**: action (requires response/action), fyi (informational only), spam (junk/promotional), personal (personal matter)
2. **Priority**: urgent (needs attention today), normal (within 48 hours), low (whenever)
3. **Action Required**: true/false - does the recipient need to do something?
4. **Task**: If action required, what specific task should be created? (Start with a verb)
5. **Reply Needed**: Does this need a reply? If yes, draft a brief suggested reply.

Consider:
- Is there a direct question or request?
- Is there a deadline mentioned?
- Is this from an important sender (professor, employer, etc.)?
- Is this automated/promotional?

Format your response as JSON:
{
  "category": "action" | "fyi" | "spam" | "personal",
  "priority": "urgent" | "normal" | "low",
  "actionRequired": true | false,
  "task": "Task description starting with verb" | null,
  "replyNeeded": true | false,
  "suggestedReply": "Brief reply text" | null,
  "reasoning": "Brief explanation of your categorization"
}`;

// ============================================
// Processor
// ============================================

export async function processEmailTriageJob(job: Job<EmailTriageJobData>): Promise<{
  success: boolean;
  category?: string;
  priority?: string;
  taskCreated?: boolean;
  error?: string;
}> {
  const { emailId, from, subject, body, receivedAt } = job.data;
  
  console.log(`[EmailTriage] Processing email: ${subject}`);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('[EmailTriage] OPENAI_API_KEY not configured');
    return { success: false, error: 'OpenAI not configured' };
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Truncate body if too long
    const truncatedBody = body.length > 4000 ? body.substring(0, 4000) + '...' : body;

    const emailContent = `
From: ${from}
Subject: ${subject}
Received: ${new Date(receivedAt).toLocaleString()}

${truncatedBody}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: EMAIL_TRIAGE_PROMPT },
        { role: 'user', content: emailContent },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);
    
    console.log(`[EmailTriage] Result for "${subject}": ${result.category}/${result.priority}, action: ${result.actionRequired}`);

    let taskCreated = false;

    // Create task if action required
    if (result.actionRequired && result.task) {
      // Extract sender name from email address
      const senderName = from.match(/^([^<]+)/)?.[1]?.trim() || from;

      await db.insert(tasks).values({
        title: result.task,
        description: `From: ${senderName}\nSubject: ${subject}\n\nEmail requires action. ${result.suggestedReply ? `\n\nSuggested reply: ${result.suggestedReply}` : ''}`,
        status: result.priority === 'urgent' ? 'today' : 'inbox',
        priority: result.priority === 'urgent' ? 2 : result.priority === 'normal' ? 1 : 0,
        source: 'email',
        sourceRef: `email:${emailId}`,
        context: 'Email',
        dueDate: result.priority === 'urgent' ? new Date() : null,
      });
      
      taskCreated = true;
      console.log(`[EmailTriage] Created task: ${result.task}`);
    }

    // Store important emails in vault
    if (result.category === 'action' || result.priority === 'urgent') {
      await db.insert(vaultEntries).values({
        title: `Email: ${subject}`,
        content: `# Email: ${subject}\n\n**From:** ${from}\n**Date:** ${new Date(receivedAt).toLocaleString()}\n**Priority:** ${result.priority}\n\n${body}\n\n---\n**AI Analysis:** ${result.reasoning}`,
        contentType: 'reference',
        context: 'Email',
        tags: ['email', result.category, result.priority],
        source: 'email',
        sourceRef: `email:${emailId}`,
        sourceDate: new Date(receivedAt),
      });
    }

    return {
      success: true,
      category: result.category,
      priority: result.priority,
      taskCreated,
    };
  } catch (error) {
    console.error(`[EmailTriage] Failed for "${subject}":`, error);
    return {
      success: false,
      error: String(error),
    };
  }
}
