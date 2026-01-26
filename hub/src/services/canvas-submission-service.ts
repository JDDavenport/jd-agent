/**
 * Canvas Submission Service
 *
 * Canvas Complete Phase 5: Direct assignment submission
 * - Submit text entries
 * - Upload files to Canvas
 * - Track submission status
 * - Get submission history
 */

import { db } from '../db/client';
import { canvasItems, tasks } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================
// Types
// ============================================

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at: string | null;
  attempt: number;
  body: string | null;
  grade: string | null;
  score: number | null;
  graded_at: string | null;
  grader_id: number | null;
  late: boolean;
  missing: boolean;
  workflow_state: 'submitted' | 'unsubmitted' | 'graded' | 'pending_review';
  submission_type: string | null;
  attachments?: CanvasAttachment[];
  submission_comments?: SubmissionComment[];
}

export interface CanvasAttachment {
  id: number;
  uuid: string;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  content_type: string;
  created_at: string;
}

export interface SubmissionComment {
  id: number;
  author_id: number;
  author_name: string;
  comment: string;
  created_at: string;
  edited_at: string | null;
}

export interface SubmitTextInput {
  canvasItemId: string;
  textBody: string;
}

export interface SubmitFileInput {
  canvasItemId: string;
  filePath: string;
  fileName?: string;
}

export interface SubmitUrlInput {
  canvasItemId: string;
  url: string;
}

export interface SubmissionResult {
  success: boolean;
  submissionId?: number;
  attempt?: number;
  submittedAt?: string;
  error?: string;
}

export interface SubmissionStatus {
  canvasItemId: string;
  hasSubmission: boolean;
  submissionType: string | null;
  submittedAt: string | null;
  attempt: number;
  grade: string | null;
  score: number | null;
  late: boolean;
  missing: boolean;
  workflowState: string;
  comments: SubmissionComment[];
  attachments: CanvasAttachment[];
}

// ============================================
// Service
// ============================================

class CanvasSubmissionService {
  private baseUrl: string | null = null;
  private token: string | null = null;

  constructor() {
    this.baseUrl = process.env.CANVAS_BASE_URL || null;
    this.token = process.env.CANVAS_TOKEN || null;
  }

  /**
   * Make an authenticated request to Canvas API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.baseUrl || !this.token) {
      throw new Error('Canvas not configured');
    }

    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canvas API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get Canvas item details (courseId and canvasAssignmentId)
   */
  private async getCanvasItemDetails(
    canvasItemId: string
  ): Promise<{ courseId: number; assignmentId: number } | null> {
    const item = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.id, canvasItemId))
      .limit(1);

    if (item.length === 0) return null;

    const canvasItem = item[0];
    if (!canvasItem.canvasAssignmentId || !canvasItem.canvasCourseId) {
      return null;
    }

    return {
      courseId: parseInt(canvasItem.canvasCourseId),
      assignmentId: parseInt(canvasItem.canvasAssignmentId),
    };
  }

  /**
   * Get current submission status for an assignment
   */
  async getSubmissionStatus(canvasItemId: string): Promise<SubmissionStatus | null> {
    const details = await this.getCanvasItemDetails(canvasItemId);
    if (!details) return null;

    try {
      const submission = await this.request<CanvasSubmission>(
        `/courses/${details.courseId}/assignments/${details.assignmentId}/submissions/self?include[]=submission_comments`
      );

      return {
        canvasItemId,
        hasSubmission: submission.workflow_state !== 'unsubmitted',
        submissionType: submission.submission_type,
        submittedAt: submission.submitted_at,
        attempt: submission.attempt,
        grade: submission.grade,
        score: submission.score,
        late: submission.late,
        missing: submission.missing,
        workflowState: submission.workflow_state,
        comments: submission.submission_comments || [],
        attachments: submission.attachments || [],
      };
    } catch (error) {
      console.error('[CanvasSubmission] Failed to get submission status:', error);
      return null;
    }
  }

  /**
   * Submit a text entry
   */
  async submitText(input: SubmitTextInput): Promise<SubmissionResult> {
    const details = await this.getCanvasItemDetails(input.canvasItemId);
    if (!details) {
      return { success: false, error: 'Canvas item not found' };
    }

    try {
      const submission = await this.request<CanvasSubmission>(
        `/courses/${details.courseId}/assignments/${details.assignmentId}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify({
            submission: {
              submission_type: 'online_text_entry',
              body: input.textBody,
            },
          }),
        }
      );

      // Update task status if linked
      await this.markTaskSubmitted(input.canvasItemId);

      return {
        success: true,
        submissionId: submission.id,
        attempt: submission.attempt,
        submittedAt: submission.submitted_at || undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Submit a URL
   */
  async submitUrl(input: SubmitUrlInput): Promise<SubmissionResult> {
    const details = await this.getCanvasItemDetails(input.canvasItemId);
    if (!details) {
      return { success: false, error: 'Canvas item not found' };
    }

    try {
      const submission = await this.request<CanvasSubmission>(
        `/courses/${details.courseId}/assignments/${details.assignmentId}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify({
            submission: {
              submission_type: 'online_url',
              url: input.url,
            },
          }),
        }
      );

      await this.markTaskSubmitted(input.canvasItemId);

      return {
        success: true,
        submissionId: submission.id,
        attempt: submission.attempt,
        submittedAt: submission.submitted_at || undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Upload and submit a file
   * Canvas file upload is a 3-step process:
   * 1. Request upload URL
   * 2. Upload file to URL
   * 3. Confirm upload and get file ID
   * 4. Submit with file ID
   */
  async submitFile(input: SubmitFileInput): Promise<SubmissionResult> {
    const details = await this.getCanvasItemDetails(input.canvasItemId);
    if (!details) {
      return { success: false, error: 'Canvas item not found' };
    }

    try {
      // Read file
      const fileBuffer = await fs.readFile(input.filePath);
      const fileName = input.fileName || path.basename(input.filePath);
      const fileSize = fileBuffer.length;

      // Step 1: Request upload URL from Canvas
      const uploadRequest = await this.request<{
        upload_url: string;
        upload_params: Record<string, string>;
        file_param: string;
      }>(
        `/courses/${details.courseId}/assignments/${details.assignmentId}/submissions/self/files`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: fileName,
            size: fileSize,
          }),
        }
      );

      // Step 2: Upload file to the provided URL
      const formData = new FormData();
      for (const [key, value] of Object.entries(uploadRequest.upload_params)) {
        formData.append(key, value);
      }
      formData.append(uploadRequest.file_param || 'file', new Blob([fileBuffer]), fileName);

      const uploadResponse = await fetch(uploadRequest.upload_url, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`File upload failed: ${errorText}`);
      }

      // Step 3: Get file ID from response
      const uploadResult = await uploadResponse.json() as { id: number };
      const fileId = uploadResult.id;

      // Step 4: Submit assignment with file ID
      const submission = await this.request<CanvasSubmission>(
        `/courses/${details.courseId}/assignments/${details.assignmentId}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify({
            submission: {
              submission_type: 'online_upload',
              file_ids: [fileId],
            },
          }),
        }
      );

      await this.markTaskSubmitted(input.canvasItemId);

      return {
        success: true,
        submissionId: submission.id,
        attempt: submission.attempt,
        submittedAt: submission.submitted_at || undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Mark the linked task as submitted/completed
   */
  private async markTaskSubmitted(canvasItemId: string): Promise<void> {
    const item = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.id, canvasItemId))
      .limit(1);

    if (item.length > 0 && item[0].taskId) {
      await db
        .update(tasks)
        .set({
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, item[0].taskId));
    }
  }

  /**
   * Get submission history for an assignment
   */
  async getSubmissionHistory(
    canvasItemId: string
  ): Promise<CanvasSubmission[] | null> {
    const details = await this.getCanvasItemDetails(canvasItemId);
    if (!details) return null;

    try {
      // Canvas returns submission history in the submission object
      const submission = await this.request<CanvasSubmission & { submission_history?: CanvasSubmission[] }>(
        `/courses/${details.courseId}/assignments/${details.assignmentId}/submissions/self?include[]=submission_history&include[]=submission_comments`
      );

      return submission.submission_history || [submission];
    } catch (error) {
      console.error('[CanvasSubmission] Failed to get submission history:', error);
      return null;
    }
  }

  /**
   * Check if submission is allowed for an assignment
   */
  async canSubmit(canvasItemId: string): Promise<{
    allowed: boolean;
    reason?: string;
    submissionTypes: string[];
    allowedExtensions: string[];
  }> {
    const item = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.id, canvasItemId))
      .limit(1);

    if (item.length === 0) {
      return {
        allowed: false,
        reason: 'Assignment not found',
        submissionTypes: [],
        allowedExtensions: [],
      };
    }

    const canvasItem = item[0];

    // Check if assignment is locked
    if (canvasItem.lockAt && new Date(canvasItem.lockAt) < new Date()) {
      return {
        allowed: false,
        reason: 'Assignment is locked',
        submissionTypes: canvasItem.submissionTypes || [],
        allowedExtensions: canvasItem.allowedExtensions || [],
      };
    }

    // Check submission types
    const submissionTypes = canvasItem.submissionTypes || [];
    if (submissionTypes.length === 0 || submissionTypes.includes('none')) {
      return {
        allowed: false,
        reason: 'No submission required for this assignment',
        submissionTypes,
        allowedExtensions: [],
      };
    }

    return {
      allowed: true,
      submissionTypes,
      allowedExtensions: canvasItem.allowedExtensions || [],
    };
  }
}

export const canvasSubmissionService = new CanvasSubmissionService();
