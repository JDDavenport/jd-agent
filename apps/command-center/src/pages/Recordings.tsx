import { useState, useRef } from 'react';
import {
  useRecordings,
  useRecording,
  useAudioUrl,
  useRecordingStats,
  useUpdateSpeaker,
  useReprocessRecording,
  useSyncRecordings,
  formatDuration,
  formatFileSize,
} from '../hooks/useRecordings';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Status badge colors
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  transcribing: 'bg-blue-500/20 text-blue-400',
  summarizing: 'bg-purple-500/20 text-purple-400',
  complete: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
};

// Type badge colors
const typeColors: Record<string, string> = {
  class: 'bg-indigo-500/20 text-indigo-400',
  meeting: 'bg-cyan-500/20 text-cyan-400',
  conversation: 'bg-orange-500/20 text-orange-400',
  other: 'bg-gray-500/20 text-gray-400',
};

function Recordings() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [editingSpeaker, setEditingSpeaker] = useState<number | null>(null);
  const [speakerName, setSpeakerName] = useState('');

  const { data: recordingsData, isLoading: loadingRecordings } = useRecordings({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });
  const { data: selectedRecording, isLoading: loadingSelected } = useRecording(selectedId);
  const { data: audioData } = useAudioUrl(selectedId);
  const { data: stats, isLoading: loadingStats } = useRecordingStats();

  const syncRecordings = useSyncRecordings();
  const reprocessRecording = useReprocessRecording();
  const updateSpeaker = useUpdateSpeaker();

  const audioRef = useRef<HTMLAudioElement>(null);

  const handleSync = async () => {
    try {
      const result = await syncRecordings.mutateAsync();
      alert(result.message || 'Sync completed');
    } catch (error) {
      alert(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleReprocess = async () => {
    if (!selectedId) return;
    try {
      await reprocessRecording.mutateAsync(selectedId);
      alert('Recording queued for reprocessing');
    } catch (error) {
      alert(`Reprocess failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSaveSpeaker = async (speakerId: number) => {
    if (!selectedId || !speakerName.trim()) return;
    try {
      await updateSpeaker.mutateAsync({
        recordingId: selectedId,
        deepgramSpeakerId: speakerId,
        speakerName: speakerName.trim(),
      });
      setEditingSpeaker(null);
      setSpeakerName('');
    } catch (error) {
      alert(`Failed to save speaker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Get unique speakers from transcript
  const getSpeakers = () => {
    if (!selectedRecording?.transcript?.segments) return [];
    const speakers = new Set<number>();
    for (const seg of selectedRecording.transcript.segments) {
      if (seg.speaker !== undefined) {
        speakers.add(seg.speaker);
      }
    }
    return Array.from(speakers).sort();
  };

  const getSpeakerLabel = (speakerId: number) => {
    return selectedRecording?.transcript?.speakerLabels?.[speakerId] || `Speaker ${speakerId + 1}`;
  };

  if (loadingRecordings && loadingStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-2xl">🎙️</span>
            Plaud Recordings
          </h1>
          <p className="text-text-muted mt-1">
            {stats?.recentCount || 0} recordings this week • {formatDuration(stats?.totalDurationSeconds || 0)} total
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={handleSync}
            disabled={syncRecordings.isPending}
          >
            {syncRecordings.isPending ? 'Syncing...' : '🔄 Sync Now'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">{stats?.byStatus?.complete || 0}</div>
          <div className="text-sm text-text-muted">Complete</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-yellow-400">{stats?.byStatus?.pending || 0}</div>
          <div className="text-sm text-text-muted">Pending</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-400">{stats?.byStatus?.transcribing || 0}</div>
          <div className="text-sm text-text-muted">Processing</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-red-400">{stats?.byStatus?.failed || 0}</div>
          <div className="text-sm text-text-muted">Failed</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recordings List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input text-sm flex-1"
            >
              <option value="">All Status</option>
              <option value="complete">Complete</option>
              <option value="pending">Pending</option>
              <option value="transcribing">Transcribing</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input text-sm flex-1"
            >
              <option value="">All Types</option>
              <option value="class">Class</option>
              <option value="meeting">Meeting</option>
              <option value="conversation">Conversation</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {recordingsData?.data?.map((recording) => (
              <button
                key={recording.id}
                onClick={() => setSelectedId(recording.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedId === recording.id
                    ? 'bg-accent/20 border-accent'
                    : 'bg-dark-card border-dark-border hover:border-accent/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {recording.originalFilename || 'Untitled Recording'}
                    </div>
                    <div className="text-sm text-text-muted mt-1">
                      {recording.recordedAt
                        ? new Date(recording.recordedAt).toLocaleString()
                        : 'Unknown date'}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[recording.status] || statusColors.other}`}>
                        {recording.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${typeColors[recording.recordingType] || typeColors.other}`}>
                        {recording.recordingType}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-text-muted">
                    <div>{formatDuration(recording.durationSeconds)}</div>
                    <div>{formatFileSize(recording.fileSizeBytes)}</div>
                  </div>
                </div>
              </button>
            ))}

            {recordingsData?.data?.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                No recordings found. Click "Sync Now" to import.
              </div>
            )}
          </div>
        </div>

        {/* Recording Detail */}
        <div className="lg:col-span-2">
          {selectedId && loadingSelected ? (
            <div className="card p-8 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : selectedRecording ? (
            <div className="space-y-4">
              {/* Audio Player */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {selectedRecording.originalFilename || 'Recording'}
                  </h2>
                  <div className="flex items-center gap-2">
                    {selectedRecording.status === 'failed' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleReprocess}
                        disabled={reprocessRecording.isPending}
                      >
                        🔄 Retry
                      </Button>
                    )}
                  </div>
                </div>

                {audioData?.url ? (
                  <audio
                    ref={audioRef}
                    src={audioData.url}
                    controls
                    className="w-full"
                  />
                ) : (
                  <div className="text-text-muted text-sm">
                    Audio not available
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                  <div>
                    <div className="text-text-muted">Duration</div>
                    <div className="font-medium">{formatDuration(selectedRecording.durationSeconds)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Size</div>
                    <div className="font-medium">{formatFileSize(selectedRecording.fileSizeBytes)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Status</div>
                    <div className={`font-medium ${statusColors[selectedRecording.status]?.split(' ')[1] || ''}`}>
                      {selectedRecording.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Speaker Labels */}
              {selectedRecording.transcript && getSpeakers().length > 0 && (
                <div className="card p-4">
                  <h3 className="text-md font-semibold mb-3">Speaker Labels</h3>
                  <div className="flex flex-wrap gap-2">
                    {getSpeakers().map((speakerId) => (
                      <div key={speakerId} className="flex items-center gap-2">
                        {editingSpeaker === speakerId ? (
                          <>
                            <input
                              type="text"
                              value={speakerName}
                              onChange={(e) => setSpeakerName(e.target.value)}
                              placeholder="Enter name"
                              className="input text-sm w-32"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSpeaker(speakerId);
                                if (e.key === 'Escape') setEditingSpeaker(null);
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveSpeaker(speakerId)}
                              disabled={updateSpeaker.isPending}
                            >
                              Save
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingSpeaker(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingSpeaker(speakerId);
                              setSpeakerName(selectedRecording.transcript?.speakerLabels?.[speakerId] || '');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-dark-card-hover border border-dark-border hover:border-accent transition-colors"
                          >
                            <span className="text-accent font-medium">
                              {getSpeakerLabel(speakerId)}
                            </span>
                            <span className="text-text-muted ml-2 text-sm">✏️</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {selectedRecording.transcript ? (
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-semibold">Transcript</h3>
                    <div className="text-sm text-text-muted">
                      {selectedRecording.transcript.wordCount} words •
                      {selectedRecording.transcript.speakerCount} speakers •
                      {selectedRecording.transcript.confidenceScore
                        ? ` ${Math.round(selectedRecording.transcript.confidenceScore * 100)}% confidence`
                        : ''}
                    </div>
                  </div>

                  {selectedRecording.transcript.segments ? (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                      {selectedRecording.transcript.segments.map((segment, idx) => (
                        <div key={idx} className="flex gap-3">
                          <button
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = segment.start;
                                audioRef.current.play();
                              }
                            }}
                            className="text-xs text-accent hover:underline whitespace-nowrap"
                          >
                            {formatDuration(segment.start)}
                          </button>
                          <div className="flex-1">
                            {segment.speaker !== undefined && (
                              <span className="text-xs font-medium text-accent mr-2">
                                {getSpeakerLabel(segment.speaker)}:
                              </span>
                            )}
                            <span className="text-text">{segment.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{selectedRecording.transcript.fullText}</p>
                    </div>
                  )}
                </div>
              ) : selectedRecording.status === 'complete' ? (
                <div className="card p-8 text-center text-text-muted">
                  No transcript available for this recording.
                </div>
              ) : selectedRecording.status === 'pending' || selectedRecording.status === 'transcribing' ? (
                <div className="card p-8 text-center">
                  <LoadingSpinner />
                  <p className="text-text-muted mt-4">Processing transcript...</p>
                </div>
              ) : selectedRecording.status === 'failed' ? (
                <div className="card p-8 text-center">
                  <div className="text-red-400 text-4xl mb-4">⚠️</div>
                  <p className="text-red-400 font-medium">Processing failed</p>
                  <p className="text-text-muted mt-2 text-sm">
                    {selectedRecording.errorMessage || 'Unknown error'}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={handleReprocess}
                    disabled={reprocessRecording.isPending}
                  >
                    🔄 Retry Processing
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card p-8 text-center text-text-muted">
              Select a recording to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Recordings;
