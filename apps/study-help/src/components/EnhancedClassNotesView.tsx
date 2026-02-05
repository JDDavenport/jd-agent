/**
 * EnhancedClassNotesView - The Ultimate Class Notes Experience
 * 
 * Integrates:
 * - Plaud lecture recordings with AI summaries
 * - Remarkable handwritten notes (OCR'd)
 * - Flashcards & key concepts for review
 * - Canvas course materials
 * 
 * Organized by class session for easy review before class
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { format, parseISO, isToday, isTomorrow, isPast, differenceInDays } from 'date-fns';
import {
  MicrophoneIcon,
  PencilIcon,
  DocumentTextIcon,
  PlayIcon,
  PauseIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  SparklesIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  EyeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { Course } from '../types/courses';
import { useLectures, useLecture, useRemarkableNotes, useDueFlashcards } from '../hooks/useStudy';
import { getLectureAudioUrl, getRemarkablePdfUrl } from '../api';

interface EnhancedClassNotesViewProps {
  course: Course;
}

type ViewMode = 'timeline' | 'review';
type SortOrder = 'newest' | 'oldest';

interface ClassSession {
  date: string;
  recordings: Array<{
    id: string;
    title: string;
    hasAudio: boolean;
    preview: string;
    durationMinutes?: number;
  }>;
  remarkableNotes: Array<{
    id: string;
    name: string;
    pages: number;
    ocrText: string;
  }>;
  hasContent: boolean;
}

export function EnhancedClassNotesView({ course }: EnhancedClassNotesViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewProgress, setReviewProgress] = useState<Record<string, boolean>>({});
  
  const { data: lectures, isLoading: isLoadingLectures } = useLectures(course.id);
  const { data: remarkableNotes, isLoading: isLoadingRemarkable } = useRemarkableNotes(course.id);
  const { data: flashcards } = useDueFlashcards();

  // Group content by date into class sessions
  const classSessions = useMemo(() => {
    const byDate: Record<string, ClassSession> = {};
    
    // Add lectures
    if (lectures) {
      for (const lecture of lectures) {
        if (!byDate[lecture.date]) {
          byDate[lecture.date] = {
            date: lecture.date,
            recordings: [],
            remarkableNotes: [],
            hasContent: false,
          };
        }
        byDate[lecture.date].recordings.push({
          id: lecture.id,
          title: lecture.title,
          hasAudio: lecture.hasAudio,
          preview: lecture.previewSnippet || '',
          durationMinutes: lecture.durationMinutes,
        });
        byDate[lecture.date].hasContent = true;
      }
    }
    
    // TODO: Add remarkable notes by date when API supports it
    // For now, just note that we have them
    if (remarkableNotes && remarkableNotes.length > 0) {
      // Group remarkable notes with the most recent session for now
      const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
      if (sortedDates.length > 0) {
        byDate[sortedDates[0]].remarkableNotes = remarkableNotes.map(note => ({
          id: note.id,
          name: note.name,
          pages: note.pages,
          ocrText: note.ocrText,
        }));
      }
    }
    
    // Convert to array and sort
    const sessions = Object.values(byDate).filter(s => s.hasContent);
    sessions.sort((a, b) => 
      sortOrder === 'newest' 
        ? b.date.localeCompare(a.date) 
        : a.date.localeCompare(b.date)
    );
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return sessions.filter(session => {
        const matchRecording = session.recordings.some(r => 
          r.title.toLowerCase().includes(query) || 
          r.preview.toLowerCase().includes(query)
        );
        const matchNotes = session.remarkableNotes.some(n =>
          n.name.toLowerCase().includes(query) ||
          n.ocrText.toLowerCase().includes(query)
        );
        return matchRecording || matchNotes;
      });
    }
    
    return sessions;
  }, [lectures, remarkableNotes, sortOrder, searchQuery]);

  // Auto-expand the most recent session
  useEffect(() => {
    if (classSessions.length > 0 && expandedSessions.size === 0) {
      setExpandedSessions(new Set([classSessions[0].date]));
    }
  }, [classSessions]);

  const toggleSession = (date: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSessions(new Set(classSessions.map(s => s.date)));
  };

  const collapseAll = () => {
    setExpandedSessions(new Set());
  };

  const markSessionReviewed = (date: string) => {
    setReviewProgress(prev => ({ ...prev, [date]: true }));
  };

  const isLoading = isLoadingLectures || isLoadingRemarkable;
  const hasContent = classSessions.length > 0;
  const totalRecordings = classSessions.reduce((sum, s) => sum + s.recordings.length, 0);
  const totalNotes = classSessions.reduce((sum, s) => sum + s.remarkableNotes.length, 0);
  const reviewedCount = Object.values(reviewProgress).filter(Boolean).length;

  if (isLoading) {
    return <ClassNotesLoading />;
  }

  return (
    <div className="min-h-[600px]">
      {/* Header Bar */}
      <div className={clsx('sticky top-0 z-10 border-b', course.bgColor)}>
        <div className="px-4 py-3">
          {/* Title and Stats */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={clsx('p-2 rounded-lg', course.bgColor)}>
                <BookOpenIcon className={clsx('w-5 h-5', course.color)} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Class Notes</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MicrophoneIcon className="w-3.5 h-3.5 text-red-500" />
                    {totalRecordings} recordings
                  </span>
                  <span className="flex items-center gap-1">
                    <PencilIcon className="w-3.5 h-3.5 text-blue-500" />
                    {totalNotes} notes
                  </span>
                  <span className="flex items-center gap-1">
                    <AcademicCapIcon className="w-3.5 h-3.5 text-amber-500" />
                    {classSessions.length} sessions
                  </span>
                </div>
              </div>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    viewMode === 'timeline'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setViewMode('review')}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1',
                    viewMode === 'review'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <RocketLaunchIcon className="w-3.5 h-3.5" />
                  Review
                </button>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notes and recordings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'newest' ? (
                <ArrowDownIcon className="w-4 h-4" />
              ) : (
                <ArrowUpIcon className="w-4 h-4" />
              )}
              {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
            </button>
            
            {/* Expand/Collapse */}
            <button
              onClick={expandedSessions.size > 0 ? collapseAll : expandAll}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {expandedSessions.size > 0 ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {!hasContent ? (
        <EmptyState course={course} />
      ) : viewMode === 'timeline' ? (
        <TimelineView
          sessions={classSessions}
          course={course}
          expandedSessions={expandedSessions}
          toggleSession={toggleSession}
          reviewProgress={reviewProgress}
          markSessionReviewed={markSessionReviewed}
        />
      ) : (
        <ReviewModeView
          sessions={classSessions}
          course={course}
          reviewProgress={reviewProgress}
          markSessionReviewed={markSessionReviewed}
        />
      )}
    </div>
  );
}

// ============================================
// Timeline View
// ============================================

interface TimelineViewProps {
  sessions: ClassSession[];
  course: Course;
  expandedSessions: Set<string>;
  toggleSession: (date: string) => void;
  reviewProgress: Record<string, boolean>;
  markSessionReviewed: (date: string) => void;
}

function TimelineView({
  sessions,
  course,
  expandedSessions,
  toggleSession,
  reviewProgress,
  markSessionReviewed,
}: TimelineViewProps) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      <div className="divide-y divide-gray-100">
        {sessions.map((session, index) => (
          <SessionCard
            key={session.date}
            session={session}
            course={course}
            isExpanded={expandedSessions.has(session.date)}
            onToggle={() => toggleSession(session.date)}
            isReviewed={reviewProgress[session.date]}
            onMarkReviewed={() => markSessionReviewed(session.date)}
            isFirst={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Session Card
// ============================================

interface SessionCardProps {
  session: ClassSession;
  course: Course;
  isExpanded: boolean;
  onToggle: () => void;
  isReviewed: boolean;
  onMarkReviewed: () => void;
  isFirst: boolean;
}

function SessionCard({
  session,
  course,
  isExpanded,
  onToggle,
  isReviewed,
  onMarkReviewed,
  isFirst,
}: SessionCardProps) {
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  
  const dateObj = parseISO(session.date);
  const isUpcoming = !isPast(dateObj);
  const daysAgo = differenceInDays(new Date(), dateObj);
  
  const formattedDate = format(dateObj, 'MMM d');
  const fullDate = format(dateObj, 'EEEE, MMMM d, yyyy');
  const relativeDate = isToday(dateObj) 
    ? 'Today' 
    : isTomorrow(dateObj) 
    ? 'Tomorrow'
    : daysAgo === 1 
    ? 'Yesterday'
    : daysAgo < 7 
    ? format(dateObj, 'EEEE')
    : null;

  return (
    <div className="relative">
      {/* Timeline dot */}
      <div className={clsx(
        'absolute left-4 top-5 w-4 h-4 rounded-full border-2 bg-white z-10',
        isFirst 
          ? `border-blue-500 ring-4 ring-blue-100` 
          : isReviewed 
          ? 'border-green-500' 
          : 'border-gray-300'
      )}>
        {isReviewed && (
          <CheckCircleSolid className="w-3 h-3 text-green-500 absolute -top-0.5 -left-0.5" />
        )}
      </div>
      
      {/* Card Content */}
      <div className="ml-12 py-4 pr-4">
        {/* Header - Always visible */}
        <button
          onClick={onToggle}
          className="w-full text-left group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{formattedDate}</span>
                {relativeDate && (
                  <span className={clsx(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    isFirst ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  )}>
                    {relativeDate}
                  </span>
                )}
                {isReviewed && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                    <CheckCircleIcon className="w-3 h-3" />
                    Reviewed
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{fullDate}</p>
            </div>
            
            {/* Content badges */}
            <div className="flex items-center gap-2">
              {session.recordings.length > 0 && (
                <ContentBadge
                  icon={MicrophoneIcon}
                  count={session.recordings.length}
                  color="red"
                />
              )}
              {session.remarkableNotes.length > 0 && (
                <ContentBadge
                  icon={PencilIcon}
                  count={session.remarkableNotes.length}
                  color="blue"
                />
              )}
              <ChevronDownIcon
                className={clsx(
                  'w-5 h-5 text-gray-400 transition-transform',
                  isExpanded && 'rotate-180'
                )}
              />
            </div>
          </div>
          
          {/* Preview when collapsed */}
          {!isExpanded && session.recordings.length > 0 && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
              {session.recordings[0].preview || session.recordings[0].title}
            </p>
          )}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* Recordings */}
            {session.recordings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MicrophoneIcon className="w-4 h-4 text-red-500" />
                  Lecture Recordings
                </h4>
                <div className="space-y-2">
                  {session.recordings.map((recording) => (
                    <RecordingCard
                      key={recording.id}
                      recording={recording}
                      course={course}
                      isPlaying={playingRecording === recording.id}
                      onPlayToggle={() => setPlayingRecording(
                        playingRecording === recording.id ? null : recording.id
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Remarkable Notes */}
            {session.remarkableNotes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <PencilIcon className="w-4 h-4 text-blue-500" />
                  Handwritten Notes
                </h4>
                <div className="space-y-2">
                  {session.remarkableNotes.map((note) => (
                    <RemarkableNoteCard
                      key={note.id}
                      note={note}
                      course={course}
                      isExpanded={expandedNote === note.id}
                      onToggle={() => setExpandedNote(
                        expandedNote === note.id ? null : note.id
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Mark as Reviewed Button */}
            {!isReviewed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkReviewed();
                }}
                className={clsx(
                  'w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2',
                  'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                )}
              >
                <CheckCircleIcon className="w-5 h-5" />
                Mark as Reviewed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Recording Card
// ============================================

interface RecordingCardProps {
  recording: {
    id: string;
    title: string;
    hasAudio: boolean;
    preview: string;
    durationMinutes?: number;
  };
  course: Course;
  isPlaying: boolean;
  onPlayToggle: () => void;
}

function RecordingCard({ recording, course, isPlaying, onPlayToggle }: RecordingCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.5);
  const { data: lectureDetail } = useLecture(course.id, recording.id);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const audioUrl = recording.hasAudio ? getLectureAudioUrl(course.id, recording.id) : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Play Button */}
          {audioUrl && (
            <button
              onClick={onPlayToggle}
              className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                isPlaying 
                  ? 'bg-red-500 text-white' 
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              )}
            >
              {isPlaying ? (
                <PauseIcon className="w-5 h-5" />
              ) : (
                <PlayIcon className="w-5 h-5 ml-0.5" />
              )}
            </button>
          )}
          
          <div className="flex-1 min-w-0">
            <h5 className="font-medium text-gray-900 text-sm truncate">{recording.title}</h5>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              {recording.durationMinutes && (
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  {recording.durationMinutes} min
                </span>
              )}
              {lectureDetail?.segments && (
                <span className="flex items-center gap-1">
                  <DocumentTextIcon className="w-3.5 h-3.5" />
                  {lectureDetail.segments.length} segments
                </span>
              )}
            </div>
            {recording.preview && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{recording.preview}</p>
            )}
          </div>
        </div>

        {/* Audio Player */}
        {audioUrl && isPlaying && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
              onEnded={onPlayToggle}
            />
            
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 w-10">{formatTime(currentTime)}</span>
              <div 
                className="flex-1 h-1.5 bg-gray-200 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  handleSeek(percent * duration);
                }}
              >
                <div 
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">{formatTime(duration)}</span>
            </div>

            {/* Speed control */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const speeds = [1, 1.25, 1.5, 1.75, 2];
                  const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                  setPlaybackSpeed(next);
                  if (audioRef.current) audioRef.current.playbackRate = next;
                }}
                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded border hover:bg-gray-200"
              >
                {playbackSpeed}x
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Summary (if available) */}
      {lectureDetail?.summary && (
        <div className="px-3 pb-3">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-center gap-1.5 text-xs font-medium text-purple-700 mb-1.5">
              <SparklesIcon className="w-4 h-4" />
              AI Summary
            </div>
            <p className="text-sm text-gray-700 line-clamp-3">{lectureDetail.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Remarkable Note Card
// ============================================

interface RemarkableNoteCardProps {
  note: {
    id: string;
    name: string;
    pages: number;
    ocrText: string;
  };
  course: Course;
  isExpanded: boolean;
  onToggle: () => void;
}

function RemarkableNoteCard({ note, course, isExpanded, onToggle }: RemarkableNoteCardProps) {
  const pdfUrl = getRemarkablePdfUrl(course.id, note.id);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-blue-50 transition-colors"
      >
        <div className="p-2 bg-blue-100 rounded-lg">
          <PencilIcon className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 text-sm">{note.name}</span>
          <p className="text-xs text-gray-500">{note.pages} page{note.pages !== 1 ? 's' : ''}</p>
        </div>
        <EyeIcon className={clsx('w-5 h-5 text-gray-400', isExpanded && 'text-blue-500')} />
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* PDF Preview */}
          <div className="aspect-[8.5/11] max-h-96 bg-gray-100">
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title={note.name}
            />
          </div>

          {/* OCR Text */}
          {note.ocrText && (
            <div className="p-3 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                <SparklesIcon className="w-4 h-4 text-blue-500" />
                Extracted Text
              </div>
              <div className="text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                {note.ocrText.substring(0, 500)}
                {note.ocrText.length > 500 && '...'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Review Mode View
// ============================================

interface ReviewModeViewProps {
  sessions: ClassSession[];
  course: Course;
  reviewProgress: Record<string, boolean>;
  markSessionReviewed: (date: string) => void;
}

function ReviewModeView({ sessions, course, reviewProgress, markSessionReviewed }: ReviewModeViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  
  // Get sessions that haven't been reviewed
  const unreviewedSessions = sessions.filter(s => !reviewProgress[s.date]);
  const currentSession = unreviewedSessions[currentIndex] || sessions[0];
  
  const progress = sessions.length > 0 
    ? Math.round((Object.values(reviewProgress).filter(Boolean).length / sessions.length) * 100)
    : 0;

  const goNext = () => {
    if (currentIndex < unreviewedSessions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowSummary(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowSummary(false);
    }
  };

  const markAndNext = () => {
    if (currentSession) {
      markSessionReviewed(currentSession.date);
    }
    if (currentIndex < unreviewedSessions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    setShowSummary(false);
  };

  if (unreviewedSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircleSolid className="w-10 h-10 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">All Caught Up! 🎉</h3>
        <p className="text-gray-600 text-center max-w-md mb-6">
          You've reviewed all {sessions.length} class sessions. Keep up the great work!
        </p>
        <button
          onClick={() => {
            // Reset all progress
            sessions.forEach(s => reviewProgress[s.date] = false);
            setCurrentIndex(0);
          }}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Review Progress</span>
          <span className="text-sm text-gray-500">{progress}% complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={clsx('h-full rounded-full transition-all', course.bgColor.replace('-50', '-500'))}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Session Card */}
      {currentSession && (
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden mb-4">
          <div className={clsx('px-4 py-3 border-b', course.bgColor)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Session {currentIndex + 1} of {unreviewedSessions.length}</p>
                <h3 className="font-bold text-lg text-gray-900">
                  {format(parseISO(currentSession.date), 'EEEE, MMMM d')}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-lg hover:bg-white/50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="w-5 h-5 rotate-180 text-gray-600" />
                </button>
                <button
                  onClick={goNext}
                  disabled={currentIndex >= unreviewedSessions.length - 1}
                  className="p-2 rounded-lg hover:bg-white/50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Quick Summary Toggle */}
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="w-full flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-900">Quick Summary</span>
              </div>
              <ChevronDownIcon className={clsx(
                'w-5 h-5 text-purple-600 transition-transform',
                showSummary && 'rotate-180'
              )} />
            </button>

            {showSummary && (
              <div className="bg-purple-50 rounded-lg p-4 text-sm text-gray-700">
                <p className="italic">
                  {currentSession.recordings.length > 0 
                    ? currentSession.recordings[0].preview || 'Lecture recording available'
                    : 'No recording preview available'}
                </p>
              </div>
            )}

            {/* Content Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700 mb-1">
                  <MicrophoneIcon className="w-5 h-5" />
                  <span className="font-medium">Recordings</span>
                </div>
                <p className="text-2xl font-bold text-red-900">{currentSession.recordings.length}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-700 mb-1">
                  <PencilIcon className="w-5 h-5" />
                  <span className="font-medium">Notes</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{currentSession.remarkableNotes.length}</p>
              </div>
            </div>

            {/* Key Concepts Placeholder */}
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <LightBulbIcon className="w-5 h-5" />
                <span className="font-medium">Key Concepts</span>
              </div>
              <p className="text-sm text-amber-800">
                Key concepts from this lecture will appear here when available.
              </p>
            </div>
          </div>

          {/* Mark Complete */}
          <div className="p-4 bg-gray-50 border-t">
            <button
              onClick={markAndNext}
              className={clsx(
                'w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                'bg-green-600 text-white hover:bg-green-700'
              )}
            >
              <CheckCircleIcon className="w-5 h-5" />
              Mark Reviewed & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function ContentBadge({ 
  icon: Icon, 
  count, 
  color 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  count: number; 
  color: 'red' | 'blue' | 'green';
}) {
  const colorClasses = {
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
  };

  return (
    <div className={clsx(
      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
      colorClasses[color]
    )}>
      <Icon className="w-3.5 h-3.5" />
      {count > 1 && <span>{count}</span>}
    </div>
  );
}

function ClassNotesLoading() {
  return (
    <div className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded-lg" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ course }: { course: Course }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div className={clsx('w-16 h-16 rounded-full flex items-center justify-center mb-4', course.bgColor)}>
        <BookOpenIcon className={clsx('w-8 h-8', course.color)} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Class Notes Yet</h3>
      <p className="text-gray-600 text-center max-w-md mb-6">
        Notes will appear here when Plaud recordings are synced or Remarkable notes are uploaded.
      </p>
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <MicrophoneIcon className="w-4 h-4 text-red-500" />
          <span>Record lectures with Plaud</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <PencilIcon className="w-4 h-4 text-blue-500" />
          <span>Take notes on Remarkable</span>
        </div>
      </div>
    </div>
  );
}
