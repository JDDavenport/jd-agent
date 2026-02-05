// Lecture types for the study-help app

export interface TranscriptSegment {
  timestamp: string;
  seconds: number;
  text: string;
  timestampText?: string;
  speaker?: string;
}

export interface TranscriptLine {
  timestamp: number;
  timestampText: string;
  text: string;
  speaker?: string;
}

export interface Lecture {
  id: string;
  date: string;
  title: string;
  duration?: string;
  durationMinutes?: number;
  preview: string;
  previewSnippet?: string;
  transcriptPath: string;
  audioPath?: string;
  hasAudio: boolean;
}

export interface LectureDetail extends Lecture {
  transcript: TranscriptLine[];
  segments: TranscriptSegment[];
  summary?: string;
  keyConcepts?: Array<{
    term: string;
    definition: string;
  }>;
}
