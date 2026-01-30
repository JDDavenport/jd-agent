import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isPast, isToday } from 'date-fns';
import {
  XMarkIcon,
  ClockIcon,
  CalendarDaysIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  ArrowTopRightOnSquareIcon,
  ListBulletIcon,
  PlayIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { Task, Book } from '../types';
import type { Course } from '../types/courses';

// Canvas course ID mapping for building URLs
const CANVAS_COURSE_IDS: Record<string, string> = {
  'mba560': '32991',
  'mba580': '33202',
  'entrepreneurial-innovation': '33259',
  'mba664': '34638',
  'mba677': '34458',
  'mba654': '34642',
  'mba693r': '34634',
};

interface TaskDetailModalProps {
  task: Task;
  course: Course | undefined;
  books: Book[];
  onClose: () => void;
  onComplete: (taskId: string) => void;
}

// Parse sub-items from a task title or description
interface SubItem {
  type: 'watch' | 'read' | 'quiz' | 'write' | 'other';
  text: string;
  icon: typeof PlayIcon;
}

function parseSubItems(description: string | undefined): SubItem[] {
  if (!description) return [];
  
  const items: SubItem[] = [];
  
  // Remove HTML tags but preserve structure
  const text = description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  
  // Split by numbered items (1), 2), etc.) or bullet points
  const lines = text.split(/\n/).filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;
    
    // Detect item type based on keywords
    const lower = trimmed.toLowerCase();
    let type: SubItem['type'] = 'other';
    let icon = ListBulletIcon;
    
    if (lower.includes('watch') || lower.includes('video')) {
      type = 'watch';
      icon = PlayIcon;
    } else if (lower.includes('read') || lower.includes('review')) {
      type = 'read';
      icon = DocumentTextIcon;
    } else if (lower.includes('quiz') || lower.includes('take')) {
      type = 'quiz';
      icon = AcademicCapIcon;
    } else if (lower.includes('complete') || lower.includes('write') || lower.includes('submit') || lower.includes('journal')) {
      type = 'write';
      icon = PencilSquareIcon;
    }
    
    // Only add if it starts with a number or looks like a task
    if (/^\d+[\.\)]\s*/.test(trimmed) || type !== 'other') {
      items.push({
        type,
        text: trimmed.replace(/^\d+[\.\)]\s*/, '').trim(),
        icon,
      });
    }
  }
  
  return items;
}

export function TaskDetailModal({ task, course, books, onClose, onComplete }: TaskDetailModalProps) {
  const isCompleted = task.status === 'done';
  
  // Detect if this is a "Deliverables" task (contains multiple sub-items)
  const isDeliverables = task.title.toLowerCase().includes('deliverables');
  
  // Parse sub-items from description
  const subItems = useMemo(() => parseSubItems(task.description), [task.description]);
  
  // Find related readings based on task title/context
  const relatedReadings = useMemo(() => {
    if (!books || books.length === 0) return [];
    
    const taskText = [
      task.title,
      task.description || '',
      task.context || '',
      ...(task.taskLabels || []),
    ].join(' ').toLowerCase();
    
    // Score each book by relevance
    const scoredBooks = books.map(book => {
      let score = 0;
      const bookText = [
        book.title,
        book.author || '',
        ...(book.tags || []),
      ].join(' ').toLowerCase();
      
      // Check if task mentions book title or parts of it
      const titleWords = book.title.toLowerCase().split(/[\s\-_:,]+/).filter(w => w.length > 3);
      for (const word of titleWords) {
        if (taskText.includes(word)) score += 2;
      }
      
      // Check tags match course
      if (course && book.tags) {
        const courseTag = course.code.toLowerCase().replace(/\s+/g, '');
        for (const tag of book.tags) {
          if (tag.toLowerCase().includes(courseTag) || 
              tag.toLowerCase().includes(course.shortName.toLowerCase()) ||
              tag.toLowerCase() === course.id) {
            score += 5;
          }
        }
      }
      
      // Check for common keywords
      const keywords = ['case', 'reading', 'chapter', 'article', 'prep', 'preparation'];
      for (const kw of keywords) {
        if (taskText.includes(kw) && bookText.includes(kw)) score += 1;
      }
      
      // Boost if task title contains book title
      if (task.title.toLowerCase().includes(book.title.toLowerCase().slice(0, 20))) {
        score += 10;
      }
      
      return { book, score };
    });
    
    // Return books with score > 0, sorted by score
    return scoredBooks
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ book }) => book);
  }, [task, books, course]);
  
  // Build Canvas URL
  const canvasUrl = useMemo(() => {
    if (task.sourceRef?.startsWith('canvas:')) {
      const parts = task.sourceRef.split(':');
      const type = parts[1];
      const id = parts[2]?.replace('assignment_', '').replace('quiz_', '');
      
      // Try to get course ID from mapping or context
      let canvasCourseId = course?.id ? CANVAS_COURSE_IDS[course.id] : null;
      
      // Fallback: try to extract from context
      if (!canvasCourseId) {
        const contextMatch = task.context?.match(/(\d{4,})/);
        if (contextMatch) canvasCourseId = contextMatch[1];
      }
      
      if (canvasCourseId && id) {
        if (type === 'assignment') {
          return `https://byu.instructure.com/courses/${canvasCourseId}/assignments/${id}`;
        } else if (type === 'quiz') {
          return `https://byu.instructure.com/courses/${canvasCourseId}/quizzes/${id}`;
        }
      }
    }
    return null;
  }, [task, course]);
  
  const formatDueDate = (dueDate: string | undefined) => {
    if (!dueDate) return null;
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) {
      return { text: 'Overdue', urgent: true };
    }
    if (isToday(date)) {
      return { text: 'Due today', urgent: true };
    }
    return { text: `Due ${format(date, 'MMM d, h:mm a')}`, urgent: false };
  };
  
  const dueInfo = formatDueDate(task.dueDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={clsx(
          'px-6 py-4 border-b',
          course?.bgColor || 'bg-gray-50',
          course?.borderColor || 'border-gray-200'
        )}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {course && <span className="text-2xl">{course.icon}</span>}
                <span className={clsx(
                  'text-sm font-medium px-2 py-0.5 rounded',
                  course?.bgColor?.replace('50', '100') || 'bg-gray-100',
                  course?.color || 'text-gray-700'
                )}>
                  {course?.shortName || 'Task'}
                </span>
                {isDeliverables && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1">
                    <ListBulletIcon className="w-3 h-3" />
                    Multiple Items
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mt-2">{task.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Deliverables Alert */}
          {isDeliverables && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <ListBulletIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800">This task contains multiple deliverables</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Check Canvas for the full list of items to complete. Typically includes: readings, videos, quizzes, and case writeups.
                  </p>
                  {canvasUrl && (
                    <a
                      href={canvasUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                    >
                      <LinkIcon className="w-4 h-4" />
                      View Full List in Canvas
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Status & Due Date */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              onClick={() => !isCompleted && onComplete(task.id)}
              disabled={isCompleted}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                isCompleted
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              {isCompleted ? (
                <>
                  <CheckCircleSolid className="w-5 h-5" />
                  Completed
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  Mark Complete
                </>
              )}
            </button>
            
            {dueInfo && (
              <span className={clsx(
                'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium',
                dueInfo.urgent
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
              )}>
                {dueInfo.urgent && <ExclamationTriangleIcon className="w-4 h-4" />}
                <CalendarDaysIcon className="w-4 h-4" />
                {dueInfo.text}
              </span>
            )}
            
            {task.timeEstimateMinutes && (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600">
                <ClockIcon className="w-4 h-4" />
                {task.timeEstimateMinutes} min
              </span>
            )}
          </div>
          
          {/* Sub-items (if parsed from description) */}
          {subItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <ListBulletIcon className="w-4 h-4" />
                What to Complete ({subItems.length} items)
              </h3>
              <div className="space-y-2">
                {subItems.map((item, i) => {
                  const Icon = item.icon;
                  const bgColors = {
                    watch: 'bg-purple-50 border-purple-200',
                    read: 'bg-blue-50 border-blue-200',
                    quiz: 'bg-green-50 border-green-200',
                    write: 'bg-orange-50 border-orange-200',
                    other: 'bg-gray-50 border-gray-200',
                  };
                  const iconColors = {
                    watch: 'text-purple-600',
                    read: 'text-blue-600',
                    quiz: 'text-green-600',
                    write: 'text-orange-600',
                    other: 'text-gray-600',
                  };
                  return (
                    <div
                      key={i}
                      className={clsx(
                        'flex items-start gap-3 p-3 rounded-lg border',
                        bgColors[item.type]
                      )}
                    >
                      <Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', iconColors[item.type])} />
                      <span className="text-sm text-gray-700">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Description (if no sub-items parsed, show raw) */}
          {task.description && subItems.length === 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
              <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 rounded-lg p-4">
                {task.description}
              </div>
            </div>
          )}
          
          {/* Canvas Link (if not Deliverables, since it's already shown above) */}
          {canvasUrl && !isDeliverables && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Canvas Assignment</h3>
              <a
                href={canvasUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 hover:bg-orange-100 transition-colors"
              >
                <LinkIcon className="w-5 h-5" />
                <span className="flex-1">Open in Canvas</span>
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
          )}
          
          {/* Related Readings */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
              <BookOpenIcon className="w-4 h-4" />
              Related Readings
            </h3>
            
            {relatedReadings.length > 0 ? (
              <div className="space-y-2">
                {relatedReadings.map(book => (
                  <Link
                    key={book.id}
                    to={course ? `/course/${course.id}/readings/${book.id}` : `/readings/${book.id}`}
                    onClick={onClose}
                    className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-10 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center">
                      <BookOpenIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 group-hover:text-blue-700 line-clamp-1">
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="text-sm text-gray-500">{book.author}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {book.pageCount && (
                          <span className="text-xs text-gray-400">{book.pageCount} pages</span>
                        )}
                      </div>
                    </div>
                    <ArrowTopRightOnSquareIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                <BookOpenIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No related readings found</p>
                <p className="text-sm mt-1">
                  {isDeliverables 
                    ? 'Check Canvas for required readings'
                    : 'Upload PDFs to the course to see them here'}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Source: {task.source} {task.sourceRef && `• ${task.sourceRef.split(':')[1]}`}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
