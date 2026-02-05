import { Link } from 'react-router-dom';
import { MicrophoneIcon, PlayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import type { Lecture } from '../types/lecture';
import type { Course } from '../types/courses';

interface LecturesListProps {
  lectures: Lecture[];
  course: Course;
  isLoading?: boolean;
}

export function LecturesList({ lectures, course, isLoading }: LecturesListProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading recordings...
      </div>
    );
  }

  if (!lectures || lectures.length === 0) {
    return (
      <div className="p-8 text-center">
        <MicrophoneIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-600 mb-2">No recordings yet</p>
        <p className="text-sm text-gray-500">
          Lecture recordings from Plaud will appear here automatically
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <MicrophoneIcon className={clsx('w-5 h-5', course.color)} />
          <h3 className="font-semibold text-gray-900">Lecture Recordings</h3>
          <span className="text-sm text-gray-500">({lectures.length})</span>
        </div>
      </div>

      {lectures.map((lecture) => (
        <Link
          key={lecture.id}
          to={`/course/${course.id}/lectures/${lecture.id}`}
          className="block p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-500">
                  {formatLectureDate(lecture.date)}
                </span>
                {lecture.hasAudio && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                    <PlayIcon className="w-3 h-3" />
                    Audio
                  </span>
                )}
              </div>
              <h4 className="font-medium text-gray-900 truncate">
                {lecture.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {lecture.preview}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className={clsx(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                course.bgColor
              )}>
                <DocumentTextIcon className={clsx('w-5 h-5', course.color)} />
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function formatLectureDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'EEE, MMM d');
  } catch {
    return dateStr;
  }
}
