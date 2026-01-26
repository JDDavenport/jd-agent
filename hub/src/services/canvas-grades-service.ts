/**
 * Canvas Grades Service
 *
 * Canvas Complete Phase 5: Grade notifications
 * - Fetch grades from Canvas API
 * - Track grade changes
 * - Store grade history
 * - Generate notifications for new grades
 */

import { db } from '../db/client';
import { canvasItems, tasks, systemLogs } from '../db/schema';
import { eq, and, isNotNull, desc, sql } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface CanvasGrade {
  assignmentId: number;
  courseId: number;
  grade: string | null;
  score: number | null;
  pointsPossible: number;
  gradedAt: string | null;
  late: boolean;
  missing: boolean;
  workflowState: string;
  commentCount: number;
}

export interface GradeUpdate {
  canvasItemId: string;
  assignmentTitle: string;
  courseName: string;
  previousGrade: string | null;
  previousScore: number | null;
  newGrade: string | null;
  newScore: number | null;
  pointsPossible: number | null;
  percentageScore: number | null;
  gradedAt: string;
  isNew: boolean;
}

export interface GradeSummary {
  totalGraded: number;
  totalPending: number;
  averageScore: number | null;
  recentGrades: GradeUpdate[];
  courseAverages: Array<{
    courseName: string;
    averageScore: number;
    totalAssignments: number;
    gradedAssignments: number;
  }>;
}

export interface CourseGrades {
  courseId: string;
  courseName: string;
  currentGrade: string | null;
  currentScore: number | null;
  assignments: Array<{
    id: string;
    title: string;
    grade: string | null;
    score: number | null;
    pointsPossible: number | null;
    percentageScore: number | null;
    gradedAt: string | null;
    late: boolean;
    missing: boolean;
  }>;
}

// ============================================
// Service
// ============================================

class CanvasGradesService {
  private baseUrl: string | null = null;
  private token: string | null = null;

  constructor() {
    this.baseUrl = process.env.CANVAS_BASE_URL || null;
    this.token = process.env.CANVAS_TOKEN || null;
  }

  /**
   * Make an authenticated request to Canvas API
   */
  private async request<T>(endpoint: string): Promise<T> {
    if (!this.baseUrl || !this.token) {
      throw new Error('Canvas not configured');
    }

    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canvas API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetch submission/grade for a specific assignment
   */
  async getAssignmentGrade(
    courseId: number,
    assignmentId: number
  ): Promise<CanvasGrade | null> {
    try {
      const submission = await this.request<{
        assignment_id: number;
        grade: string | null;
        score: number | null;
        graded_at: string | null;
        late: boolean;
        missing: boolean;
        workflow_state: string;
        submission_comments?: Array<unknown>;
        assignment?: {
          points_possible: number;
        };
      }>(
        `/courses/${courseId}/assignments/${assignmentId}/submissions/self?include[]=submission_comments&include[]=assignment`
      );

      return {
        assignmentId: submission.assignment_id,
        courseId,
        grade: submission.grade,
        score: submission.score,
        pointsPossible: submission.assignment?.points_possible || 0,
        gradedAt: submission.graded_at,
        late: submission.late,
        missing: submission.missing,
        workflowState: submission.workflow_state,
        commentCount: submission.submission_comments?.length || 0,
      };
    } catch (error) {
      console.error('[CanvasGrades] Failed to get assignment grade:', error);
      return null;
    }
  }

  /**
   * Check for new grades and return updates
   */
  async checkForNewGrades(): Promise<GradeUpdate[]> {
    const updates: GradeUpdate[] = [];

    // Get all Canvas items that might have grades
    const items = await db
      .select()
      .from(canvasItems)
      .where(
        and(
          eq(canvasItems.canvasType, 'assignment'),
          isNotNull(canvasItems.canvasCourseId),
          isNotNull(canvasItems.canvasAssignmentId)
        )
      );

    for (const item of items) {
      if (!item.canvasCourseId || !item.canvasAssignmentId) continue;

      const grade = await this.getAssignmentGrade(
        parseInt(item.canvasCourseId),
        parseInt(item.canvasAssignmentId)
      );

      if (!grade) continue;

      // Check if grade is new or updated
      const hasNewGrade = grade.workflowState === 'graded' && grade.gradedAt;
      const previousGrade = item.grade;
      const previousScore = item.score;

      // Check if this is a new grade or grade update
      if (hasNewGrade && (
        grade.grade !== previousGrade ||
        grade.score !== previousScore
      )) {
        const isNew = previousGrade === null && previousScore === null;

        updates.push({
          canvasItemId: item.id,
          assignmentTitle: item.title,
          courseName: item.courseName,
          previousGrade,
          previousScore,
          newGrade: grade.grade,
          newScore: grade.score,
          pointsPossible: grade.pointsPossible,
          percentageScore: grade.score && grade.pointsPossible
            ? Math.round((grade.score / grade.pointsPossible) * 100)
            : null,
          gradedAt: grade.gradedAt!,
          isNew,
        });

        // Update the database with new grade
        await db
          .update(canvasItems)
          .set({
            grade: grade.grade,
            score: grade.score,
            gradedAt: grade.gradedAt ? new Date(grade.gradedAt) : null,
            isLate: grade.late,
            isMissing: grade.missing,
            updatedAt: new Date(),
          })
          .where(eq(canvasItems.id, item.id));

        // Log the grade update
        await db.insert(systemLogs).values({
          logType: 'info',
          component: 'canvas-grades',
          message: `New grade: ${item.title} - ${grade.grade || grade.score}`,
          details: {
            canvasItemId: item.id,
            courseName: item.courseName,
            grade: grade.grade,
            score: grade.score,
            pointsPossible: grade.pointsPossible,
          },
        });
      }
    }

    return updates;
  }

  /**
   * Get grade summary across all courses
   */
  async getGradeSummary(): Promise<GradeSummary> {
    // Get all graded assignments
    const items = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.canvasType, 'assignment'))
      .orderBy(desc(canvasItems.gradedAt));

    const graded = items.filter(i => i.grade !== null || i.score !== null);
    const pending = items.filter(i => i.grade === null && i.score === null && i.dueAt);

    // Calculate average score
    const scores = graded
      .filter(i => i.score !== null && i.pointsPossible !== null && i.pointsPossible > 0)
      .map(i => (i.score! / i.pointsPossible!) * 100);

    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    // Get recent grades (last 10)
    const recentGrades = graded
      .filter(i => i.gradedAt)
      .slice(0, 10)
      .map(i => ({
        canvasItemId: i.id,
        assignmentTitle: i.title,
        courseName: i.courseName,
        previousGrade: null,
        previousScore: null,
        newGrade: i.grade,
        newScore: i.score,
        pointsPossible: i.pointsPossible,
        percentageScore: i.score && i.pointsPossible
          ? Math.round((i.score / i.pointsPossible) * 100)
          : null,
        gradedAt: i.gradedAt!.toISOString(),
        isNew: false,
      }));

    // Calculate course averages
    const courseMap = new Map<string, {
      courseName: string;
      scores: number[];
      total: number;
      graded: number;
    }>();

    for (const item of items) {
      if (!courseMap.has(item.courseName)) {
        courseMap.set(item.courseName, {
          courseName: item.courseName,
          scores: [],
          total: 0,
          graded: 0,
        });
      }

      const course = courseMap.get(item.courseName)!;
      course.total++;

      if (item.score !== null && item.pointsPossible !== null && item.pointsPossible > 0) {
        course.scores.push((item.score / item.pointsPossible) * 100);
        course.graded++;
      }
    }

    const courseAverages = Array.from(courseMap.values())
      .filter(c => c.graded > 0)
      .map(c => ({
        courseName: c.courseName,
        averageScore: Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length),
        totalAssignments: c.total,
        gradedAssignments: c.graded,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    return {
      totalGraded: graded.length,
      totalPending: pending.length,
      averageScore,
      recentGrades,
      courseAverages,
    };
  }

  /**
   * Get all grades for a specific course
   */
  async getCourseGrades(courseId: string): Promise<CourseGrades | null> {
    const items = await db
      .select()
      .from(canvasItems)
      .where(
        and(
          eq(canvasItems.canvasType, 'assignment'),
          eq(canvasItems.canvasCourseId, courseId)
        )
      )
      .orderBy(desc(canvasItems.dueAt));

    if (items.length === 0) return null;

    // Calculate current grade (weighted average)
    const gradedItems = items.filter(
      i => i.score !== null && i.pointsPossible !== null && i.pointsPossible > 0
    );

    let currentScore: number | null = null;
    if (gradedItems.length > 0) {
      const totalEarned = gradedItems.reduce((sum, i) => sum + (i.score || 0), 0);
      const totalPossible = gradedItems.reduce((sum, i) => sum + (i.pointsPossible || 0), 0);
      currentScore = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;
    }

    // Convert score to letter grade
    const currentGrade = currentScore !== null ? this.scoreToGrade(currentScore) : null;

    return {
      courseId,
      courseName: items[0].courseName,
      currentGrade,
      currentScore,
      assignments: items.map(i => ({
        id: i.id,
        title: i.title,
        grade: i.grade,
        score: i.score,
        pointsPossible: i.pointsPossible,
        percentageScore: i.score && i.pointsPossible
          ? Math.round((i.score / i.pointsPossible) * 100)
          : null,
        gradedAt: i.gradedAt?.toISOString() || null,
        late: i.isLate || false,
        missing: i.isMissing || false,
      })),
    };
  }

  /**
   * Convert percentage score to letter grade
   */
  private scoreToGrade(score: number): string {
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 67) return 'D+';
    if (score >= 63) return 'D';
    if (score >= 60) return 'D-';
    return 'F';
  }

  /**
   * Get ungraded assignments that have been submitted
   */
  async getPendingGrades(): Promise<Array<{
    id: string;
    title: string;
    courseName: string;
    submittedAt: string;
    dueAt: string | null;
  }>> {
    // Query items that were submitted but not yet graded
    const items = await db
      .select()
      .from(canvasItems)
      .where(
        and(
          eq(canvasItems.canvasType, 'assignment'),
          isNotNull(canvasItems.submittedAt),
          sql`${canvasItems.grade} IS NULL AND ${canvasItems.score} IS NULL`
        )
      )
      .orderBy(desc(canvasItems.submittedAt));

    return items.map(i => ({
      id: i.id,
      title: i.title,
      courseName: i.courseName,
      submittedAt: i.submittedAt!.toISOString(),
      dueAt: i.dueAt?.toISOString() || null,
    }));
  }
}

export const canvasGradesService = new CanvasGradesService();
