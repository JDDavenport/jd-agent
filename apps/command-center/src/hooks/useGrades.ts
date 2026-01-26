/**
 * Canvas Grades Hooks
 *
 * Canvas Complete Phase 5: Grade tracking and notifications
 * - Grade summary across all courses
 * - Recent grade updates
 * - Course-specific grades
 * - Pending grade checks
 */

import { useQuery } from '@tanstack/react-query';

// ============================================
// Types
// ============================================

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

export interface CourseAverage {
  courseName: string;
  averageScore: number;
  totalAssignments: number;
  gradedAssignments: number;
}

export interface GradeSummary {
  totalGraded: number;
  totalPending: number;
  averageScore: number | null;
  recentGrades: GradeUpdate[];
  courseAverages: CourseAverage[];
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

export interface PendingGrade {
  id: string;
  title: string;
  courseName: string;
  submittedAt: string;
  dueAt: string | null;
}

export interface GradeCheckResult {
  updates: GradeUpdate[];
  hasNewGrades: boolean;
  count: number;
}

// ============================================
// API Functions
// ============================================

async function fetchGradeSummary(): Promise<GradeSummary> {
  const response = await fetch('/api/canvas-integrity/grades/summary');
  if (!response.ok) throw new Error('Failed to fetch grade summary');
  const result = await response.json();
  return result.data;
}

async function checkForNewGrades(): Promise<GradeCheckResult> {
  const response = await fetch('/api/canvas-integrity/grades/check');
  if (!response.ok) throw new Error('Failed to check for new grades');
  const result = await response.json();
  return result.data;
}

async function fetchPendingGrades(): Promise<PendingGrade[]> {
  const response = await fetch('/api/canvas-integrity/grades/pending');
  if (!response.ok) throw new Error('Failed to fetch pending grades');
  const result = await response.json();
  return result.data;
}

async function fetchCourseGrades(courseId: string): Promise<CourseGrades | null> {
  const response = await fetch(`/api/canvas-integrity/grades/course/${courseId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch course grades');
  }
  const result = await response.json();
  return result.data;
}

// ============================================
// Hooks
// ============================================

/**
 * Get grade summary across all courses
 */
export function useGradeSummary() {
  return useQuery({
    queryKey: ['grade-summary'],
    queryFn: fetchGradeSummary,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
}

/**
 * Check for new grades
 * Can be used for notifications
 */
export function useGradeCheck(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['grade-check'],
    queryFn: checkForNewGrades,
    enabled: options?.enabled !== false,
    staleTime: 60000,
    refetchInterval: 600000, // 10 minutes
  });
}

/**
 * Get submitted assignments awaiting grades
 */
export function usePendingGrades() {
  return useQuery({
    queryKey: ['pending-grades'],
    queryFn: fetchPendingGrades,
    staleTime: 60000,
  });
}

/**
 * Get grades for a specific course
 */
export function useCourseGrades(courseId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['course-grades', courseId],
    queryFn: () => fetchCourseGrades(courseId!),
    enabled: options?.enabled !== false && !!courseId,
    staleTime: 60000,
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get color for grade percentage
 */
export function getGradeColor(percentage: number | null): string {
  if (percentage === null) return 'text-slate-400';
  if (percentage >= 90) return 'text-green-400';
  if (percentage >= 80) return 'text-blue-400';
  if (percentage >= 70) return 'text-yellow-400';
  if (percentage >= 60) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Get background color for grade percentage
 */
export function getGradeBgColor(percentage: number | null): string {
  if (percentage === null) return 'bg-slate-500/20';
  if (percentage >= 90) return 'bg-green-500/20';
  if (percentage >= 80) return 'bg-blue-500/20';
  if (percentage >= 70) return 'bg-yellow-500/20';
  if (percentage >= 60) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

/**
 * Format grade display
 */
export function formatGrade(grade: string | null, score: number | null, pointsPossible: number | null): string {
  if (grade) return grade;
  if (score !== null && pointsPossible !== null) {
    return `${score}/${pointsPossible}`;
  }
  if (score !== null) return score.toString();
  return '-';
}

/**
 * Calculate letter grade from percentage
 */
export function percentageToGrade(percentage: number): string {
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 63) return 'D';
  if (percentage >= 60) return 'D-';
  return 'F';
}
