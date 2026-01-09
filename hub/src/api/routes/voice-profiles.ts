/**
 * Voice Profile API Routes
 *
 * Manages voice profiles for speaker identification and
 * speaker-to-name mapping in transcripts.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { voiceProfileService, VoiceProfileCategory } from '../../services/voice-profile-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const voiceProfilesRouter = new Hono();

// Validation schemas
const voiceProfileCategorySchema = z.enum(['self', 'family', 'teacher', 'classmate', 'colleague', 'other']);

const createProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: voiceProfileCategorySchema,
  personId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  category: voiceProfileCategorySchema.optional(),
  personId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
});

const assignSpeakerSchema = z.object({
  voiceProfileId: z.string().uuid(),
  confidence: z.number().min(0).max(1).optional(),
});

// ========================================
// Voice Profile Routes
// ========================================

// GET /api/voice-profiles - List all voice profiles
voiceProfilesRouter.get('/', async (c) => {
  const category = c.req.query('category') as VoiceProfileCategory | undefined;
  const activeOnly = c.req.query('active') === 'true';

  const profiles = await voiceProfileService.listProfiles({
    category,
    activeOnly,
  });

  return c.json({
    success: true,
    data: profiles,
    count: profiles.length,
  });
});

// GET /api/voice-profiles/self - Get or create the "self" voice profile
voiceProfilesRouter.get('/self', async (c) => {
  let profile = await voiceProfileService.getSelfProfile();

  if (!profile) {
    // Auto-create self profile if it doesn't exist
    profile = await voiceProfileService.createSelfProfile();
  }

  return c.json({ success: true, data: profile });
});

// GET /api/voice-profiles/:id - Get a single voice profile
voiceProfilesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const profile = await voiceProfileService.getProfile(id);

  if (!profile) {
    throw new NotFoundError('Voice profile');
  }

  return c.json({ success: true, data: profile });
});

// POST /api/voice-profiles - Create a new voice profile
voiceProfilesRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createProfileSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(
      parseResult.error.errors.map((e) => e.message).join(', ')
    );
  }

  const profile = await voiceProfileService.createProfile(parseResult.data);

  return c.json(
    { success: true, data: profile, message: 'Voice profile created' },
    201
  );
});

// PATCH /api/voice-profiles/:id - Update a voice profile
voiceProfilesRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateProfileSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(
      parseResult.error.errors.map((e) => e.message).join(', ')
    );
  }

  const profile = await voiceProfileService.updateProfile(id, parseResult.data);

  if (!profile) {
    throw new NotFoundError('Voice profile');
  }

  return c.json({ success: true, data: profile, message: 'Voice profile updated' });
});

// DELETE /api/voice-profiles/:id - Delete a voice profile
voiceProfilesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await voiceProfileService.deleteProfile(id);

  if (!deleted) {
    throw new NotFoundError('Voice profile');
  }

  return c.json({ success: true, message: 'Voice profile deleted' });
});

// ========================================
// Speaker Mapping Routes
// ========================================

// GET /api/voice-profiles/transcripts/:transcriptId/speakers - Get speaker mappings for a transcript
voiceProfilesRouter.get('/transcripts/:transcriptId/speakers', async (c) => {
  const transcriptId = c.req.param('transcriptId');
  const speakers = await voiceProfileService.getTranscriptSpeakers(transcriptId);

  if (!speakers) {
    throw new NotFoundError('Transcript');
  }

  return c.json({ success: true, data: speakers });
});

// POST /api/voice-profiles/transcripts/:transcriptId/speakers/:speakerId - Assign a speaker to a voice profile
voiceProfilesRouter.post(
  '/transcripts/:transcriptId/speakers/:speakerId',
  async (c) => {
    const transcriptId = c.req.param('transcriptId');
    const speakerId = parseInt(c.req.param('speakerId'), 10);

    if (isNaN(speakerId) || speakerId < 0) {
      throw new ValidationError('Invalid speaker ID');
    }

    const body = await c.req.json();
    const parseResult = assignSpeakerSchema.safeParse(body);

    if (!parseResult.success) {
      throw new ValidationError(
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const mapping = await voiceProfileService.assignSpeaker({
      transcriptId,
      deepgramSpeakerId: speakerId,
      voiceProfileId: parseResult.data.voiceProfileId,
      confidence: parseResult.data.confidence,
    });

    // Update profile stats
    await voiceProfileService.updateProfileStats(parseResult.data.voiceProfileId);

    return c.json({
      success: true,
      data: mapping,
      message: 'Speaker assigned to voice profile',
    });
  }
);

// DELETE /api/voice-profiles/transcripts/:transcriptId/speakers/:speakerId - Remove speaker assignment
voiceProfilesRouter.delete(
  '/transcripts/:transcriptId/speakers/:speakerId',
  async (c) => {
    const transcriptId = c.req.param('transcriptId');
    const speakerId = parseInt(c.req.param('speakerId'), 10);

    if (isNaN(speakerId) || speakerId < 0) {
      throw new ValidationError('Invalid speaker ID');
    }

    const removed = await voiceProfileService.unassignSpeaker(
      transcriptId,
      speakerId
    );

    if (!removed) {
      throw new NotFoundError('Speaker mapping');
    }

    return c.json({ success: true, message: 'Speaker assignment removed' });
  }
);

// POST /api/voice-profiles/transcripts/:transcriptId/initialize - Initialize speaker mappings for a transcript
voiceProfilesRouter.post('/transcripts/:transcriptId/initialize', async (c) => {
  const transcriptId = c.req.param('transcriptId');

  await voiceProfileService.initializeSpeakerMappings(transcriptId);

  const speakers = await voiceProfileService.getTranscriptSpeakers(transcriptId);

  return c.json({
    success: true,
    data: speakers,
    message: 'Speaker mappings initialized',
  });
});

export { voiceProfilesRouter };
