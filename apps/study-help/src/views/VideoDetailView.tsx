import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PlayIcon,
  ClockIcon,
  SparklesIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useVideo, useVideoSummary, useReprocessVideo } from '../hooks/useStudy';
import type { SummaryLength } from '../types';

export function VideoDetailView() {
  const { videoId } = useParams<{ videoId: string }>();
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  
  const { data: video, isLoading: videoLoading } = useVideo(videoId!);
  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useVideoSummary(videoId!, summaryLength);
  const reprocessVideo = useReprocessVideo();

  if (videoLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="h-10 w-64 bg-gray-200 rounded" />
          <div className="aspect-video bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500">Video not found</p>
          <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isProcessing = video.status === 'pending' || video.status === 'processing';
  const hasError = video.status === 'error';

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{video.title}</h1>
          {video.channelName && <p className="text-gray-500">{video.channelName}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Video Embed */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${video.youtubeId}`}
              title={video.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          
          {/* Video Info */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {video.durationSeconds && (
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {formatDuration(video.durationSeconds)}
                </span>
              )}
              {video.canvasModuleName && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                  {video.canvasModuleName}
                </span>
              )}
              {video.tags?.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              <div>
                <p className="font-medium text-blue-800">Processing Video</p>
                <p className="text-sm text-blue-600">
                  Fetching transcript and generating summaries. This may take a minute.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Status */}
        {hasError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-800">Processing Error</p>
                <p className="text-sm text-red-600 mt-1">{video.processingError}</p>
                <button
                  onClick={() => reprocessVideo.mutate(video.id)}
                  disabled={reprocessVideo.isPending}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Retry Processing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Section */}
        {video.status === 'ready' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Summary Length Selector */}
            <div className="flex border-b border-gray-200">
              {(['short', 'medium', 'long'] as const).map((len) => {
                const labels = {
                  short: { name: 'Quick Summary', time: '~2 min read' },
                  medium: { name: 'Full Summary', time: '~5 min read' },
                  long: { name: 'Detailed Notes', time: '~10 min read' },
                };
                return (
                  <button
                    key={len}
                    onClick={() => setSummaryLength(len)}
                    className={clsx(
                      'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                      summaryLength === len
                        ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <span className="block">{labels[len].name}</span>
                    <span className="text-xs opacity-70">{labels[len].time}</span>
                  </button>
                );
              })}
            </div>

            {/* Summary Content */}
            <div className="p-6">
              {summaryLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600">Generating {summaryLength} summary...</p>
                </div>
              ) : summaryError ? (
                <div className="text-center py-12 text-red-600">
                  <p>Failed to generate summary</p>
                  <p className="text-sm mt-1">{String(summaryError)}</p>
                </div>
              ) : summaryData?.summary ? (
                <div className="prose prose-sm max-w-none">
                  {summaryData.summary.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) {
                      return <h2 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace('## ', '')}</h2>;
                    }
                    if (line.startsWith('### ')) {
                      return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.replace('### ', '')}</h3>;
                    }
                    if (line.startsWith('- ')) {
                      return <li key={i} className="ml-4">{line.replace('- ', '')}</li>;
                    }
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="mb-2">{line}</p>;
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <SparklesIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Click a summary length to generate</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Key Concepts */}
        {video.keyConcepts && video.keyConcepts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <LightBulbIcon className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-900">Key Concepts</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {video.keyConcepts.map((concept, i) => (
                <div key={i} className="p-4">
                  <h3 className="font-medium text-gray-900">{concept.term}</h3>
                  <p className="text-sm text-gray-600 mt-1">{concept.definition}</p>
                  {concept.context && (
                    <p className="text-xs text-gray-400 mt-2 italic">"{concept.context}"</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript */}
        {video.transcript && (
          <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <summary className="px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-700">Full Transcript</span>
              <span className="text-sm text-gray-400 ml-auto">
                {video.wordCount?.toLocaleString()} words
              </span>
            </summary>
            <div className="p-4 max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {video.transcript}
              </p>
            </div>
          </details>
        )}

        {/* Watch on YouTube Link */}
        <a
          href={video.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 hover:bg-red-100 transition-colors"
        >
          <PlayIcon className="w-5 h-5" />
          Watch on YouTube
        </a>
      </div>
    </div>
  );
}
