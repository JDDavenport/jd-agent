import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AcademicCapIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { useAvailableCourses, useAddCoursesBulk } from '../hooks/useUserCourses';

// Color mapping for course cards
const colorClasses: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', ring: 'ring-blue-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', ring: 'ring-purple-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', ring: 'ring-orange-500' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', ring: 'ring-green-500' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', ring: 'ring-rose-500' },
  cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', ring: 'ring-cyan-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'ring-amber-500' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', ring: 'ring-gray-500' },
};

export function CourseSetupView() {
  const navigate = useNavigate();
  const { data: availableCourses, isLoading } = useAvailableCourses();
  const addCoursesBulk = useAddCoursesBulk();
  
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCourse = (canvasCourseId: string) => {
    setSelectedCourses(prev => {
      const next = new Set(prev);
      if (next.has(canvasCourseId)) {
        next.delete(canvasCourseId);
      } else {
        next.add(canvasCourseId);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedCourses.size === 0) {
      setError('Please select at least one course');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addCoursesBulk.mutateAsync(Array.from(selectedCourses));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save courses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigate('/', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-10 w-10 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-gray-500">Loading courses...</p>
        </div>
      </div>
    );
  }

  const courses = availableCourses?.courses || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg">
              <AcademicCapIcon className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Welcome to Study Aide! 🎓
          </h1>
          <p className="text-lg text-gray-600">
            Select the courses you're taking this semester to personalize your experience.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-100">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Course grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {courses.map((course) => {
            const isSelected = selectedCourses.has(course.canvasCourseId);
            const colors = colorClasses[course.color] || colorClasses.gray;

            return (
              <button
                key={course.canvasCourseId}
                onClick={() => toggleCourse(course.canvasCourseId)}
                className={clsx(
                  'relative p-5 rounded-xl border-2 text-left transition-all',
                  isSelected
                    ? clsx(colors.bg, colors.border, 'ring-2', colors.ring)
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                )}
              >
                {/* Selection indicator */}
                <div className="absolute top-4 right-4">
                  {isSelected ? (
                    <CheckCircleSolid className={clsx('h-6 w-6', colors.text)} />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                  )}
                </div>

                {/* Course info */}
                <div className="flex items-start gap-4 pr-8">
                  <span className="text-3xl">{course.icon}</span>
                  <div>
                    <h3 className={clsx('font-semibold', isSelected ? colors.text : 'text-gray-900')}>
                      {course.courseName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {course.courseCode} • {course.term}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selection summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Selected courses</p>
              <p className="text-2xl font-bold text-gray-900">
                {selectedCourses.size} of {courses.length}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleContinue}
                disabled={isSubmitting || selectedCourses.size === 0}
                className={clsx(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all',
                  selectedCourses.size > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Help text */}
        <p className="text-center text-sm text-gray-500">
          You can always add or remove courses later from Settings.
        </p>
      </div>
    </div>
  );
}
