import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API base URL - use relative URLs to leverage Vite proxy
const API_BASE = import.meta.env.VITE_API_URL || '';

// Types
export interface UserCourse {
  id: string;
  canvasCourseId: string;
  courseName: string;
  courseCode: string | null;
  term: string | null;
  isPinned: boolean;
  icon: string;
  color: string;
}

export interface AvailableCourse {
  canvasCourseId: string;
  courseName: string;
  courseCode: string;
  term: string;
  icon: string;
  color: string;
  isEnrolled: boolean;
}

// API helper with credentials
async function courseFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}/api/study-help/courses${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    },
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || 'Request failed');
  }

  return json.data;
}

/**
 * Get user's enrolled courses
 */
export function useUserCourses() {
  return useQuery({
    queryKey: ['user-courses'],
    queryFn: () => courseFetch<{ courses: UserCourse[] }>(''),
    select: (data) => data.courses,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get available courses for enrollment
 */
export function useAvailableCourses() {
  return useQuery({
    queryKey: ['available-courses'],
    queryFn: () => courseFetch<{ courses: AvailableCourse[] }>('/available'),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Add a single course
 */
export function useAddCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (canvasCourseId: string) =>
      courseFetch<{ course: UserCourse }>('', {
        method: 'POST',
        body: JSON.stringify({ canvasCourseId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-courses'] });
      queryClient.invalidateQueries({ queryKey: ['available-courses'] });
    },
  });
}

/**
 * Add multiple courses at once
 */
export function useAddCoursesBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (canvasCourseIds: string[]) =>
      courseFetch<{ courses: UserCourse[] }>('/bulk', {
        method: 'POST',
        body: JSON.stringify({ canvasCourseIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-courses'] });
      queryClient.invalidateQueries({ queryKey: ['available-courses'] });
    },
  });
}

/**
 * Remove a course
 */
export function useRemoveCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: string) =>
      courseFetch<{ message: string }>(`/${courseId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-courses'] });
      queryClient.invalidateQueries({ queryKey: ['available-courses'] });
    },
  });
}

/**
 * Toggle course pin status
 */
export function useToggleCoursePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: string) =>
      courseFetch<{ course: UserCourse }>(`/${courseId}/pin`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-courses'] });
    },
  });
}

/**
 * Check if user has any courses set up
 */
export function useHasCourses() {
  const { data: courses, isLoading } = useUserCourses();
  return {
    hasCourses: (courses?.length || 0) > 0,
    isLoading,
  };
}
