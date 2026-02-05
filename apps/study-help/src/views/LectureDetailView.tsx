import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlayIcon, PauseIcon, SpeakerWaveIcon } from '@heroicons/react/24/solid';
import { BackwardIcon, ForwardIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { useLecture } from '../hooks/useStudy';
import { getLectureAudioUrl } from '../api';
import { getCourseById } from '../types/courses';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function LectureDetailView() {
  const { courseId, lectureId } = useParams<{ courseId: string; lectureId: string }>();
  const course = getCourseById(courseId || '');
  const { data: lecture, isLoading, error } = useLecture(courseId || '', lectureId || '');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeTranscriptIndex, setActiveTranscriptIndex] = useState(-1);

  // Update current transcript line based on playback time
  useEffect(() => {
    if (!lecture?.transcript || lecture.transcript.length === 0) return;
    
    const index = lecture.transcript.findIndex((line, i) => {
      const nextLine = lecture.transcript[i + 1];
      return currentTime >= line.timestamp && (!nextLine || currentTime < nextLine.timestamp);
    });
    setActiveTranscriptIndex(index);
  }, [currentTime, lecture?.transcript]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const handleSkip = (delta: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSpeedChange = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!course) {
    return <div className="p-6 text-center">Course not found</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !lecture) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Failed to load lecture</p>
        <Link to={`/course/${courseId}`} className="text-blue-600 hover:underline mt-2 inline-block">
          Back to course
        </Link>
      </div>
    );
  }

  const audioUrl = lecture.hasAudio ? getLectureAudioUrl(courseId || '', lectureId || '') : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={clsx('sticky top-0 z-10 border-b', course.bgColor)}>
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            to={`/course/${courseId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to {course.shortName}
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{lecture.title}</h1>
          <p className="text-sm text-gray-600">
            {formatLectureDate(lecture.date)}
            {lecture.durationMinutes && ` • ${lecture.durationMinutes} minutes`}
          </p>
        </div>
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <div className="sticky top-[88px] z-10 bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
              onEnded={() => setIsPlaying(false)}
            />
            
            {/* Progress Bar */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-gray-500 w-12">{formatTime(currentTime)}</span>
              <div 
                className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  handleSeek(percent * duration);
                }}
              >
                <div 
                  className={clsx('h-full rounded-full', course.bgColor.replace('bg-', 'bg-').replace('-50', '-500'))}
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm text-gray-500 w-12 text-right">{formatTime(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleSkip(-15)}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="Back 15 seconds"
              >
                <BackwardIcon className="w-6 h-6" />
              </button>
              
              <button
                onClick={handlePlayPause}
                className={clsx(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {isPlaying ? (
                  <PauseIcon className="w-6 h-6" />
                ) : (
                  <PlayIcon className="w-6 h-6 ml-0.5" />
                )}
              </button>
              
              <button
                onClick={() => handleSkip(15)}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="Forward 15 seconds"
              >
                <ForwardIcon className="w-6 h-6" />
              </button>

              <button
                onClick={handleSpeedChange}
                className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 border rounded-lg"
              >
                {playbackSpeed}x
              </button>
            </div>
          </div>
        </div>
      )}

      {!audioUrl && (
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
            No audio file available for this lecture
          </div>
        </div>
      )}

      {/* Transcript */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SpeakerWaveIcon className="w-5 h-5" />
          Transcript
          {lecture.transcript && lecture.transcript.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              ({lecture.transcript.length} lines)
            </span>
          )}
        </h2>
        
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {lecture.transcript && lecture.transcript.length > 0 ? (
            lecture.transcript.map((line, i) => (
              <button
                key={i}
                onClick={() => audioUrl && handleSeek(line.timestamp)}
                className={clsx(
                  'w-full text-left p-4 transition-colors',
                  audioUrl ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default',
                  activeTranscriptIndex === i && 'bg-blue-50'
                )}
              >
                <div className="flex gap-4">
                  <span className={clsx(
                    'text-sm font-mono flex-shrink-0 min-w-[50px]',
                    activeTranscriptIndex === i ? 'text-blue-600 font-semibold' : 'text-gray-400'
                  )}>
                    {line.timestampText}
                  </span>
                  <div className="flex-1">
                    {line.speaker && (
                      <span className="text-xs font-medium text-gray-500 mr-2">
                        {line.speaker}:
                      </span>
                    )}
                    <span className={clsx(
                      'text-gray-700',
                      activeTranscriptIndex === i && 'text-gray-900 font-medium'
                    )}>
                      {line.text}
                    </span>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              <SpeakerWaveIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No transcript available for this lecture</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatLectureDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, MMMM d, yyyy');
  } catch {
    return dateStr;
  }
}
