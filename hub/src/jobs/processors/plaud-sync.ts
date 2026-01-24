/**
 * JD Agent - Plaud Sync Job Processor
 *
 * Syncs recordings from Plaud and transcribes new audio with Deepgram.
 * Runs on a schedule (3x daily) to capture new recordings.
 */

import { Job } from 'bullmq';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { deepgramIntegration } from '../../integrations/deepgram';
import { db } from '../../db/client';
import { recordings, transcripts } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Use environment variable for sync path, with fallback
const SYNC_PATH = process.env.PLAUD_SYNC_PATH || '/Users/jddavenport/Documents/PlaudSync';
const STORAGE_PATH = join(SYNC_PATH, '.plaud-auth.json');

export interface PlaudSyncJobData {
  transcribeNew?: boolean; // Also transcribe new audio with Deepgram
}

export interface PlaudSyncJobResult {
  success: boolean;
  filesDownloaded: number;
  transcriptsCreated: number;
  audioDownloaded: number;
  deepgramTranscriptions: number;
  recordingsCreated: number;
  errors: string[];
}

/**
 * Get auth token from saved session
 */
function getToken(): string | null {
  try {
    if (!existsSync(STORAGE_PATH)) return null;
    const storage = JSON.parse(readFileSync(STORAGE_PATH, 'utf-8'));
    for (const origin of storage.origins || []) {
      for (const item of origin.localStorage || []) {
        if (item.name === 'tokenstr') {
          return item.value;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Process Plaud sync job
 */
export async function processPlaudSyncJob(
  job: Job<PlaudSyncJobData>
): Promise<PlaudSyncJobResult> {
  const result: PlaudSyncJobResult = {
    success: false,
    filesDownloaded: 0,
    transcriptsCreated: 0,
    audioDownloaded: 0,
    deepgramTranscriptions: 0,
    recordingsCreated: 0,
    errors: [],
  };

  const transcribeNew = job.data.transcribeNew ?? true;

  try {
    console.log('[PlaudSync] Starting sync job...');

    const token = getToken();
    if (!token) {
      result.errors.push('No Plaud session. Run plaud-login.ts first.');
      return result;
    }

    // Fetch file list from Plaud API
    const filesResp = await fetch(
      'https://api.plaud.ai/file/simple/web?skip=0&limit=100&is_trash=2&sort_by=start_time&is_desc=true',
      { headers: { Authorization: token } }
    );

    if (!filesResp.ok) {
      result.errors.push(`API error: ${filesResp.status}`);
      return result;
    }

    const filesData = await filesResp.json() as { data_file_list?: any[] };
    const files = filesData.data_file_list || [];

    console.log(`[PlaudSync] Found ${files.length} files`);

    for (const file of files) {
      const date = new Date(file.start_time).toISOString().split('T')[0];
      const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
      const dirPath = join(SYNC_PATH, `${date}_${safeName}_${file.id.slice(0, 8)}`);

      // Check if directory already exists with audio
      const audioExtensions = ['.m4a', '.mp3', '.wav', '.ogg'];
      const hasAudio = audioExtensions.some(ext =>
        existsSync(join(dirPath, `audio${ext}`))
      );

      if (hasAudio) {
        // Check if needs Deepgram transcription
        if (transcribeNew && !existsSync(join(dirPath, 'transcript-deepgram.json'))) {
          await transcribeWithDeepgram(dirPath, result);
        }
        continue;
      }

      // Download new file
      console.log(`[PlaudSync] Downloading: ${file.filename}`);

      try {
        // Create directory
        if (!existsSync(dirPath)) {
          const { mkdirSync } = await import('fs');
          mkdirSync(dirPath, { recursive: true });
        }

        // Save metadata
        writeFileSync(
          join(dirPath, 'metadata.json'),
          JSON.stringify(
            {
              id: file.id,
              filename: file.filename,
              duration: file.duration,
              durationMinutes: Math.round(file.duration / 60000),
              startTime: new Date(file.start_time).toISOString(),
              fileSize: file.filesize,
            },
            null,
            2
          )
        );

        // Download audio
        const audioResp = await fetch(
          `https://api.plaud.ai/file/download/${file.id}`,
          { headers: { Authorization: token } }
        );

        if (audioResp.ok) {
          const audioBuffer = Buffer.from(await audioResp.arrayBuffer());

          // Detect format
          let ext = '.m4a';
          if (audioBuffer[0] === 0xff && (audioBuffer[1] & 0xe0) === 0xe0) {
            ext = '.mp3';
          } else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
            ext = '.ogg';
          } else if (audioBuffer.indexOf('ID3') === 0) {
            ext = '.mp3';
          }

          const audioPath = join(dirPath, `audio${ext}`);
          writeFileSync(audioPath, audioBuffer);
          result.audioDownloaded++;
          console.log(`[PlaudSync]   Audio saved (${Math.round(audioBuffer.length / 1024 / 1024 * 10) / 10} MB)`);

          // Create database record
          try {
            const recordedAt = new Date(file.start_time);
            const filename = file.filename || file.fullname || `Recording ${recordedAt.toISOString().split('T')[0]}`;
            const [recording] = await db.insert(recordings).values({
              filePath: audioPath,
              originalFilename: filename,
              durationSeconds: Math.round(file.duration / 1000),
              fileSizeBytes: audioBuffer.length,
              recordingType: 'conversation', // Default, can be changed later
              context: `Plaud recording: ${filename}`,
              status: 'pending',
              recordedAt,
            }).returning();

            result.recordingsCreated++;
            console.log(`[PlaudSync]   Database record created: ${recording.id}`);

            // Transcribe with Deepgram and link to recording
            if (transcribeNew) {
              await transcribeWithDeepgram(dirPath, result, recording.id);
            }
          } catch (dbError) {
            console.error('[PlaudSync]   Failed to create database record:', dbError);
            result.errors.push(`DB error for ${file.filename}: ${dbError}`);

            // Still try to transcribe even if DB insert failed
            if (transcribeNew) {
              await transcribeWithDeepgram(dirPath, result);
            }
          }
        }

        // Download transcript if available
        const detailResp = await fetch(
          `https://api.plaud.ai/file/detail/${file.id}`,
          { headers: { Authorization: token } }
        );

        if (detailResp.ok) {
          const detail = await detailResp.json() as { data?: { content_list?: any[] } };
          const contentList = detail.data?.content_list || [];

          for (const item of contentList) {
            if (!item.data_link) continue;

            try {
              const contentResp = await fetch(item.data_link);
              if (!contentResp.ok) continue;

              const buffer = Buffer.from(await contentResp.arrayBuffer());
              let content: string;

              // Decompress if gzipped
              if (item.data_link.includes('.gz')) {
                const { gunzipSync } = await import('zlib');
                try {
                  content = gunzipSync(buffer).toString('utf-8');
                } catch {
                  content = buffer.toString('utf-8');
                }
              } else {
                content = buffer.toString('utf-8');
              }

              if (item.data_type === 'transaction') {
                writeFileSync(join(dirPath, 'transcript-plaud.json'), content);
                result.transcriptsCreated++;

                // Save readable format
                try {
                  const parsed = JSON.parse(content);
                  if (Array.isArray(parsed)) {
                    const text = parsed
                      .map((u: any) => `[${u.speaker || 'Speaker'}]: ${u.content}`)
                      .join('\n\n');
                    writeFileSync(join(dirPath, 'transcript-plaud.txt'), text);
                  }
                } catch {}
              } else if (item.data_type === 'auto_sum_note') {
                writeFileSync(join(dirPath, 'summary.md'), content);
              }
            } catch (e) {
              console.error(`[PlaudSync]   Error downloading content:`, e);
            }
          }
        }

        result.filesDownloaded++;
      } catch (e) {
        result.errors.push(`Error processing ${file.filename}: ${e}`);
      }
    }

    result.success = true;
    console.log(`[PlaudSync] Sync complete: ${result.filesDownloaded} files, ${result.audioDownloaded} audio, ${result.deepgramTranscriptions} transcriptions`);
  } catch (e) {
    result.errors.push(String(e));
    console.error('[PlaudSync] Sync failed:', e);
  }

  return result;
}

/**
 * Transcribe audio in a directory with Deepgram
 */
async function transcribeWithDeepgram(
  dirPath: string,
  result: PlaudSyncJobResult,
  recordingId?: string
): Promise<void> {
  if (!deepgramIntegration.isReady()) {
    console.log('[PlaudSync]   Deepgram not configured, skipping transcription');
    return;
  }

  // Find audio file
  const audioExtensions = ['.ogg', '.mp3', '.m4a', '.wav'];
  let audioPath: string | null = null;
  let audioExt = '';

  for (const ext of audioExtensions) {
    const path = join(dirPath, `audio${ext}`);
    if (existsSync(path)) {
      audioPath = path;
      audioExt = ext;
      break;
    }
  }

  if (!audioPath) return;

  const deepgramPath = join(dirPath, 'transcript-deepgram.json');
  if (existsSync(deepgramPath)) return;

  console.log(`[PlaudSync]   Transcribing with Deepgram...`);

  // Convert OGG/Opus to MP3 for Deepgram compatibility
  let transcribeAudioPath = audioPath;
  let transcribeExt = audioExt;

  if (audioExt === '.ogg') {
    const mp3Path = join(dirPath, 'audio_converted.mp3');
    if (!existsSync(mp3Path)) {
      console.log(`[PlaudSync]   Converting OGG to MP3 for Deepgram...`);
      try {
        execSync(`ffmpeg -i "${audioPath}" -acodec libmp3lame -ar 16000 "${mp3Path}" -y`, {
          stdio: 'pipe',
          timeout: 120000, // 2 minute timeout for conversion
        });
        console.log(`[PlaudSync]   Conversion complete`);
      } catch (convError) {
        console.error(`[PlaudSync]   FFmpeg conversion failed:`, convError);
        result.errors.push(`FFmpeg conversion failed for ${dirPath}`);
        return;
      }
    }
    transcribeAudioPath = mp3Path;
    transcribeExt = '.mp3';
  }

  const audioBuffer = readFileSync(transcribeAudioPath);
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
  };

  const transcriptResult = await deepgramIntegration.transcribeBuffer(
    audioBuffer,
    mimeTypes[transcribeExt] || 'audio/mpeg'
  );

  if (!transcriptResult.success) {
    result.errors.push(`Deepgram failed for ${dirPath}: ${transcriptResult.error}`);
    return;
  }

  // Save results
  writeFileSync(
    deepgramPath,
    JSON.stringify(
      {
        transcribedAt: new Date().toISOString(),
        wordCount: transcriptResult.wordCount,
        speakerCount: transcriptResult.speakerCount,
        duration: transcriptResult.duration,
        confidence: transcriptResult.confidence,
        segments: transcriptResult.segments,
      },
      null,
      2
    )
  );

  // Save readable transcript
  let fullText = '';
  if (transcriptResult.segments && transcriptResult.segments.length > 0) {
    fullText = transcriptResult.segments
      .map(s => `[Speaker ${s.speaker ?? 0}]: ${s.text}`)
      .join('\n\n');
    writeFileSync(join(dirPath, 'transcript-deepgram.txt'), fullText);
  } else if (transcriptResult.fullText) {
    fullText = transcriptResult.fullText;
    writeFileSync(join(dirPath, 'transcript-deepgram.txt'), fullText);
  }

  // Save to database if we have a recording ID
  if (recordingId && fullText) {
    try {
      await db.insert(transcripts).values({
        recordingId,
        fullText,
        segments: transcriptResult.segments || [],
        wordCount: transcriptResult.wordCount || 0,
        speakerCount: transcriptResult.speakerCount || 1,
        confidenceScore: transcriptResult.confidence || 0,
      });

      // Update recording status to complete
      await db.update(recordings)
        .set({ status: 'complete', processedAt: new Date() })
        .where(eq(recordings.id, recordingId));

      console.log(`[PlaudSync]   Transcript saved to database`);
    } catch (dbError) {
      console.error('[PlaudSync]   Failed to save transcript to database:', dbError);
    }
  }

  result.deepgramTranscriptions++;
  console.log(`[PlaudSync]   Transcription complete (${transcriptResult.wordCount} words, ${transcriptResult.speakerCount} speakers)`);
}
