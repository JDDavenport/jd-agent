/**
 * ClassNotesView - View combined class notes (Plaud + Remarkable + typed)
 * Organized by CLASS DAY, not by content type
 * 
 * Student thinking: "What did I learn on January 22nd?"
 * NOT: "Show me all my recordings" vs "Show me all my handwritten notes"
 */

import { useState, useRef, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  MicrophoneIcon,
  PencilIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  PlayIcon,
  PauseIcon,
  BookOpenIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { Course } from '../types/courses';
import { useLectures, useLecture, useRemarkableNotes } from '../hooks/useStudy';
import { getLectureAudioUrl, getRemarkablePdfUrl } from '../api';

interface ClassNotesViewProps {
  course: Course;
}

interface ClassDay {
  date: string;
  plaudRecordings: Array<{
    id: string;
    title: string;
    hasAudio: boolean;
  }>;
  remarkableNotes: Array<{
    id: string;
    title: string;
  }>;
  typedNotes: Array<{
    id: string;
    title: string;
  }>;
}

export function ClassNotesView({ course }: ClassNotesViewProps) {
  const { data: lectures, isLoading: isLoadingLectures } = useLectures(course.id);
  const { data: remarkableNotes, isLoading: isLoadingRemarkable } = useRemarkableNotes(course.id);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [expandedRemarkable, setExpandedRemarkable] = useState<string | null>(null);
  const [playingLecture, setPlayingLecture] = useState<string | null>(null);

  // Group lectures by date into class days
  const classDays: ClassDay[] = [];
  if (lectures) {
    const byDate: Record<string, ClassDay> = {};
    
    for (const lecture of lectures) {
      if (!byDate[lecture.date]) {
        byDate[lecture.date] = {
          date: lecture.date,
          plaudRecordings: [],
          remarkableNotes: [],
          typedNotes: [],
        };
      }
      byDate[lecture.date].plaudRecordings.push({
        id: lecture.id,
        title: lecture.title,
        hasAudio: lecture.hasAudio,
      });
    }
    
    // Sort by date descending
    classDays.push(...Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)));
  }

  const isLoading = isLoadingLectures || isLoadingRemarkable;
  const hasContent = classDays.length > 0 || (remarkableNotes && remarkableNotes.length > 0);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="p-8 text-center">
        <BookOpenIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No class notes yet</h3>
        <p className="text-sm text-gray-500">
          Notes will appear here when Plaud recordings or Remarkable notes are synced.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {/* Header */}
      <div className="p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpenIcon className={clsx('w-5 h-5', course.color)} />
            <h3 className="font-semibold text-gray-900">Class Notes</h3>
            <span className="text-sm text-gray-500">
              {classDays.length > 0 && `${classDays.length} days`}
              {classDays.length > 0 && remarkableNotes && remarkableNotes.length > 0 && ' · '}
              {remarkableNotes && remarkableNotes.length > 0 && `${remarkableNotes.length} handwritten`}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-red-600">
              <MicrophoneIcon className="w-3.5 h-3.5" /> Plaud
            </span>
            <span className="flex items-center gap-1 text-blue-600">
              <PencilIcon className="w-3.5 h-3.5" /> Remarkable
            </span>
            <span className="flex items-center gap-1 text-green-600">
              <DocumentTextIcon className="w-3.5 h-3.5" /> Typed
            </span>
          </div>
        </div>
      </div>

      {/* Remarkable Notes Section */}
      {remarkableNotes && remarkableNotes.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="p-4 bg-blue-50">
            <div className="flex items-center gap-2 mb-3">
              <PencilIcon className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-blue-900">Handwritten Notes</h4>
              <span className="text-sm text-blue-600">({remarkableNotes.length})</span>
            </div>
            <div className="space-y-2">
              {remarkableNotes.map((note) => (
                <RemarkableNoteCard
                  key={note.id}
                  note={note}
                  course={course}
                  isExpanded={expandedRemarkable === note.id}
                  onToggle={() => setExpandedRemarkable(
                    expandedRemarkable === note.id ? null : note.id
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Class Days */}
      {classDays.length > 0 && (
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <MicrophoneIcon className="w-5 h-5 text-red-500" />
            <h4 className="font-semibold text-gray-900">Recordings by Date</h4>
          </div>
        </div>
      )}
      {classDays.map((day) => (
        <ClassDayCard
          key={day.date}
          day={day}
          course={course}
          isExpanded={expandedDay === day.date}
          onToggle={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
          playingLecture={playingLecture}
          setPlayingLecture={setPlayingLecture}
        />
      ))}
    </div>
  );
}

interface ClassDayCardProps {
  day: ClassDay;
  course: Course;
  isExpanded: boolean;
  onToggle: () => void;
  playingLecture: string | null;
  setPlayingLecture: (id: string | null) => void;
}

function ClassDayCard({ 
  day, 
  course, 
  isExpanded, 
  onToggle,
  playingLecture,
  setPlayingLecture,
}: ClassDayCardProps) {
  const hasPlaud = day.plaudRecordings.length > 0;
  const hasRemarkable = day.remarkableNotes.length > 0;
  const hasTyped = day.typedNotes.length > 0;
  
  let formattedDate = day.date;
  try {
    formattedDate = format(parseISO(day.date), 'EEEE, MMMM d');
  } catch {}

  return (
    <div className={clsx(
      'transition-colors',
      isExpanded && 'bg-gray-50'
    )}>
      {/* Day header - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50"
      >
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900">{formattedDate}</span>
          <p className="text-sm text-gray-500">
            {day.plaudRecordings.length > 0 && `${day.plaudRecordings.length} recording${day.plaudRecordings.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Source indicators */}
        <div className="flex items-center gap-2">
          <SourceBadge 
            icon={MicrophoneIcon} 
            active={hasPlaud} 
            color="red"
            count={day.plaudRecordings.length}
          />
          <SourceBadge 
            icon={PencilIcon} 
            active={hasRemarkable} 
            color="blue"
            count={day.remarkableNotes.length}
          />
          <SourceBadge 
            icon={DocumentTextIcon} 
            active={hasTyped} 
            color="green"
            count={day.typedNotes.length}
          />
        </div>

        <ChevronRightIcon
          className={clsx(
            'w-5 h-5 text-gray-400 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Plaud Recordings */}
          {day.plaudRecordings.map((recording) => (
            <PlaudRecordingCard
              key={recording.id}
              recording={recording}
              course={course}
              isPlaying={playingLecture === recording.id}
              onPlayToggle={() => setPlayingLecture(
                playingLecture === recording.id ? null : recording.id
              )}
            />
          ))}

          {/* Remarkable Notes placeholder */}
          {day.remarkableNotes.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <PencilIcon className="w-5 h-5" />
                <span className="font-medium">Remarkable Notes</span>
              </div>
              <p className="text-sm text-blue-600 mt-1">
                {day.remarkableNotes.length} handwritten note(s)
              </p>
            </div>
          )}

          {/* No content message */}
          {day.plaudRecordings.length === 0 && day.remarkableNotes.length === 0 && (
            <p className="text-sm text-gray-500 italic">No notes for this day yet</p>
          )}
        </div>
      )}
    </div>
  );
}

interface PlaudRecordingCardProps {
  recording: { id: string; title: string; hasAudio: boolean };
  course: Course;
  isPlaying: boolean;
  onPlayToggle: () => void;
}

function PlaudRecordingCard({ recording, course, isPlaying, onPlayToggle }: PlaudRecordingCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
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

  const handleSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const audioUrl = recording.hasAudio ? getLectureAudioUrl(course.id, recording.id) : null;

  return (
    <div className="bg-red-50 rounded-lg overflow-hidden">
      {/* Recording header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <MicrophoneIcon className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 truncate">{recording.title}</h4>
            {duration > 0 && (
              <p className="text-sm text-gray-500">{formatTime(duration)}</p>
            )}
          </div>
          {audioUrl && (
            <button
              onClick={onPlayToggle}
              className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              {isPlaying ? (
                <PauseIcon className="w-5 h-5" />
              ) : (
                <PlayIcon className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Audio player (when playing) */}
        {audioUrl && isPlaying && (
          <div className="mt-4">
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
                  className="h-full bg-red-600 rounded-full"
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
                className="px-2 py-1 text-xs font-medium text-gray-600 bg-white rounded border"
              >
                {playbackSpeed}x
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transcript preview (when expanded and playing) */}
      {isPlaying && lectureDetail?.segments && lectureDetail.segments.length > 0 && (
        <div className="border-t border-red-100 max-h-60 overflow-y-auto">
          {lectureDetail.segments.slice(0, 20).map((seg, i) => (
            <button
              key={i}
              onClick={() => handleSeek(seg.seconds)}
              className={clsx(
                'w-full text-left px-4 py-2 text-sm hover:bg-red-100 transition-colors',
                currentTime >= seg.seconds && 
                (lectureDetail.segments[i + 1] ? currentTime < lectureDetail.segments[i + 1].seconds : true)
                  ? 'bg-red-100'
                  : ''
              )}
            >
              <span className="text-red-600 font-mono text-xs mr-2">{seg.timestamp}</span>
              <span className="text-gray-700">{seg.text.substring(0, 100)}...</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SourceBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  color: 'red' | 'blue' | 'green';
  count?: number;
}

function SourceBadge({ icon: Icon, active, color, count }: SourceBadgeProps) {
  const colorClasses = {
    red: active ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400',
    blue: active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400',
    green: active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400',
  };

  return (
    <div className={clsx(
      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
      colorClasses[color]
    )}>
      <Icon className="w-3.5 h-3.5" />
      {count && count > 1 && <span>{count}</span>}
    </div>
  );
}

// ============================================
// Remarkable Note Card Component
// ============================================

interface RemarkableNoteCardProps {
  note: {
    id: string;
    name: string;
    pages: number;
    preview: string;
    ocrText: string;
  };
  course: Course;
  isExpanded: boolean;
  onToggle: () => void;
}

function RemarkableNoteCard({ note, course, isExpanded, onToggle }: RemarkableNoteCardProps) {
  const pdfUrl = getRemarkablePdfUrl(course.id, note.id);

  return (
    <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
      {/* Card header - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-blue-50 transition-colors"
      >
        <div className="p-2 bg-blue-100 rounded-lg">
          <PencilIcon className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 text-sm">{note.name}</span>
          <p className="text-xs text-gray-500">{note.pages} page{note.pages !== 1 ? 's' : ''}</p>
        </div>
        <ChevronRightIcon
          className={clsx(
            'w-4 h-4 text-gray-400 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-blue-100">
          {/* PDF viewer */}
          <div className="aspect-[8.5/11] bg-gray-100">
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title={note.name}
            />
          </div>

          {/* OCR Text */}
          <div className="p-4 bg-gray-50 border-t border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-gray-700">OCR Text</span>
            </div>
            <div className="text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
              {note.ocrText || 'No text extracted'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
