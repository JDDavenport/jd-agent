/**
 * Acquisition API Routes - Boomer Business Finder
 *
 * REST endpoints for managing acquisition leads and CRM pipeline.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  acquisitionService,
  PIPELINE_STAGES,
  type PipelineStage,
} from '../../services/acquisition-service';
import { acquisitionEnrichmentService } from '../../services/acquisition-enrichment-service';
import { acquisitionScoringService } from '../../services/acquisition-scoring-service';
import {
  addAcquisitionEnrichJob,
  addAcquisitionEnrichBatchJob,
  addAcquisitionScoreJob,
  addAcquisitionScoreBatchJob,
} from '../../jobs/queue';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const acquisitionRouter = new Hono();

// Validation schemas
const createLeadSchema = z.object({
  entityNumber: z.string().min(1, 'Entity number is required'),
  businessName: z.string().min(1, 'Business name is required'),
  dbaName: z.string().optional(),
  entityType: z.string().optional(),
  subtype: z.string().optional(),
  filingDate: z.string().optional(),
  businessAge: z.number().optional(),
  status: z.string().optional(),
  statusDetails: z.string().optional(),
  registeredAgent: z.string().optional(),
  principalAddress: z.string().optional(),
  mailingAddress: z.string().optional(),
  notes: z.string().optional(),
});

const updateLeadSchema = z.object({
  businessName: z.string().optional(),
  dbaName: z.string().optional(),
  entityType: z.string().optional(),
  subtype: z.string().optional(),
  status: z.string().optional(),
  statusDetails: z.string().optional(),
  registeredAgent: z.string().optional(),
  principalAddress: z.string().optional(),
  mailingAddress: z.string().optional(),
  ownerName: z.string().optional(),
  ownerLinkedIn: z.string().optional(),
  ownerEmail: z.string().optional(),
  ownerPhone: z.string().optional(),
  websiteUrl: z.string().optional(),
  googlePlaceId: z.string().optional(),
  googleRating: z.number().optional(),
  googleReviewCount: z.number().optional(),
  yelpBusinessId: z.string().optional(),
  yelpRating: z.number().optional(),
  yelpReviewCount: z.number().optional(),
  industry: z.string().optional(),
  naicsCode: z.string().optional(),
  employeeCount: z.number().optional(),
  revenueEstimate: z.string().optional(),
  acquisitionScore: z.number().min(0).max(100).optional(),
  scoreBreakdown: z.record(z.number()).optional(),
  automationPotential: z.enum(['high', 'medium', 'low']).optional(),
  scoreSummary: z.string().optional(),
  pipelineStage: z.enum(PIPELINE_STAGES).optional(),
  nextFollowUpAt: z.string().optional(),
  isFavorite: z.boolean().optional(),
  isHot: z.boolean().optional(),
  doNotContact: z.boolean().optional(),
  passReason: z.string().optional(),
  notes: z.string().optional(),
  vaultEntryId: z.string().uuid().optional(),
});

const stageChangeSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
  reason: z.string().optional(),
});

const createInteractionSchema = z.object({
  interactionType: z.string().min(1, 'Interaction type is required'),
  interactionDate: z.string(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  subject: z.string().optional(),
  summary: z.string().optional(),
  outcome: z.enum(['positive', 'neutral', 'negative', 'no_response']).optional(),
  followUpNeeded: z.boolean().optional(),
  followUpDate: z.string().optional(),
  followUpNotes: z.string().optional(),
  taskId: z.string().uuid().optional(),
  recordingId: z.string().uuid().optional(),
  emailMessageId: z.string().uuid().optional(),
});

const importSchema = z.object({
  businesses: z.array(
    z.object({
      entityNumber: z.string(),
      name: z.string(),
      otherName: z.string().optional(),
      filingDateTime: z.string().optional(),
      status: z.string().optional(),
      statusDetails: z.string().optional(),
      fileDate: z.string().optional(),
      fileYear: z.number().optional(),
      entityType: z.string().optional(),
      subtype: z.string().optional(),
    })
  ),
});

// ==========================================
// LEADS ENDPOINTS
// ==========================================

// GET /api/acquisition/leads - List leads with filters
acquisitionRouter.get('/leads', async (c) => {
  const filters = {
    search: c.req.query('search'),
    stages: c.req.query('stages')?.split(',') as PipelineStage[] | undefined,
    minScore: c.req.query('minScore') ? parseInt(c.req.query('minScore')!) : undefined,
    maxScore: c.req.query('maxScore') ? parseInt(c.req.query('maxScore')!) : undefined,
    minAge: c.req.query('minAge') ? parseInt(c.req.query('minAge')!) : undefined,
    maxAge: c.req.query('maxAge') ? parseInt(c.req.query('maxAge')!) : undefined,
    entityTypes: c.req.query('entityTypes')?.split(','),
    isFavorite: c.req.query('isFavorite') === 'true' ? true : undefined,
    isHot: c.req.query('isHot') === 'true' ? true : undefined,
    hasFollowUp: c.req.query('hasFollowUp') === 'true' ? true : undefined,
    needsEnrichment: c.req.query('needsEnrichment') === 'true' ? true : undefined,
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50,
    offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
    sortBy: c.req.query('sortBy') as 'score' | 'age' | 'name' | 'created' | 'followUp' | undefined,
    sortDir: c.req.query('sortDir') as 'asc' | 'desc' | undefined,
  };

  const leads = await acquisitionService.getLeads(filters);
  return c.json({
    success: true,
    data: leads,
    count: leads.length,
  });
});

// GET /api/acquisition/leads/:id - Get single lead with interactions
acquisitionRouter.get('/leads/:id', async (c) => {
  const id = c.req.param('id');
  const lead = await acquisitionService.getLeadWithInteractions(id);
  if (!lead) throw new NotFoundError('Lead');
  return c.json({ success: true, data: lead });
});

// POST /api/acquisition/leads - Create a new lead
acquisitionRouter.post('/leads', async (c) => {
  const body = await c.req.json();
  const parseResult = createLeadSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const data = parseResult.data;
  const lead = await acquisitionService.createLead({
    ...data,
    filingDate: data.filingDate ? new Date(data.filingDate) : undefined,
  });

  return c.json({ success: true, data: lead, message: 'Lead created' }, 201);
});

// PATCH /api/acquisition/leads/:id - Update a lead
acquisitionRouter.patch('/leads/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateLeadSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const data = parseResult.data;
  const lead = await acquisitionService.updateLead(id, {
    ...data,
    nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : undefined,
  });

  if (!lead) throw new NotFoundError('Lead');
  return c.json({ success: true, data: lead, message: 'Lead updated' });
});

// DELETE /api/acquisition/leads/:id - Delete a lead
acquisitionRouter.delete('/leads/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await acquisitionService.deleteLead(id);
  if (!deleted) throw new NotFoundError('Lead');
  return c.json({ success: true, message: 'Lead deleted' });
});

// POST /api/acquisition/leads/import - Import leads from scraper
acquisitionRouter.post('/leads/import', async (c) => {
  const body = await c.req.json();
  const parseResult = importSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const result = await acquisitionService.importFromScraper(parseResult.data.businesses);
  return c.json({
    success: true,
    data: result,
    message: `Imported ${result.imported} leads, skipped ${result.skipped}`,
  });
});

// ==========================================
// PIPELINE MANAGEMENT
// ==========================================

// POST /api/acquisition/leads/:id/stage - Change pipeline stage
acquisitionRouter.post('/leads/:id/stage', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = stageChangeSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const lead = await acquisitionService.changeStage(id, parseResult.data.stage, parseResult.data.reason);
  if (!lead) throw new NotFoundError('Lead');
  return c.json({ success: true, data: lead, message: `Stage changed to ${parseResult.data.stage}` });
});

// POST /api/acquisition/leads/:id/favorite - Toggle favorite
acquisitionRouter.post('/leads/:id/favorite', async (c) => {
  const id = c.req.param('id');
  const lead = await acquisitionService.toggleFavorite(id);
  if (!lead) throw new NotFoundError('Lead');
  return c.json({
    success: true,
    data: lead,
    message: lead.isFavorite ? 'Added to favorites' : 'Removed from favorites',
  });
});

// POST /api/acquisition/leads/:id/hot - Toggle hot lead
acquisitionRouter.post('/leads/:id/hot', async (c) => {
  const id = c.req.param('id');
  const lead = await acquisitionService.toggleHot(id);
  if (!lead) throw new NotFoundError('Lead');
  return c.json({
    success: true,
    data: lead,
    message: lead.isHot ? 'Marked as hot' : 'Unmarked as hot',
  });
});

// POST /api/acquisition/leads/:id/pass - Pass on a lead
acquisitionRouter.post('/leads/:id/pass', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const reason = body.reason || 'No reason provided';

  const lead = await acquisitionService.passOnLead(id, reason);
  if (!lead) throw new NotFoundError('Lead');
  return c.json({ success: true, data: lead, message: 'Lead passed' });
});

// POST /api/acquisition/leads/:id/follow-up - Set follow-up date and create task
acquisitionRouter.post('/leads/:id/follow-up', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const followUpDate = body.followUpDate ? new Date(body.followUpDate) : new Date();
  const notes = body.notes as string | undefined;

  const lead = await acquisitionService.setFollowUp(id, followUpDate, notes);
  if (!lead) throw new NotFoundError('Lead');
  return c.json({ success: true, data: lead, message: 'Follow-up date set and task created' });
});

// ==========================================
// INTERACTIONS
// ==========================================

// GET /api/acquisition/leads/:id/interactions - Get lead interactions
acquisitionRouter.get('/leads/:id/interactions', async (c) => {
  const id = c.req.param('id');
  const interactions = await acquisitionService.getInteractions(id);
  return c.json({
    success: true,
    data: interactions,
    count: interactions.length,
  });
});

// POST /api/acquisition/leads/:id/interactions - Log an interaction
acquisitionRouter.post('/leads/:id/interactions', async (c) => {
  const leadId = c.req.param('id');
  const body = await c.req.json();
  const parseResult = createInteractionSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const data = parseResult.data;
  const interaction = await acquisitionService.logInteraction({
    leadId,
    interactionType: data.interactionType,
    interactionDate: new Date(data.interactionDate),
    direction: data.direction,
    subject: data.subject,
    summary: data.summary,
    outcome: data.outcome,
    followUpNeeded: data.followUpNeeded,
    followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    followUpNotes: data.followUpNotes,
    taskId: data.taskId,
    recordingId: data.recordingId,
    emailMessageId: data.emailMessageId,
  });

  return c.json({ success: true, data: interaction, message: 'Interaction logged' }, 201);
});

// ==========================================
// STATS & DASHBOARD
// ==========================================

// GET /api/acquisition/stats - Get pipeline statistics
acquisitionRouter.get('/stats', async (c) => {
  const stats = await acquisitionService.getPipelineStats();
  return c.json({ success: true, data: stats });
});

// GET /api/acquisition/follow-ups - Get leads needing follow-up
acquisitionRouter.get('/follow-ups', async (c) => {
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
  const leads = await acquisitionService.getFollowUps(limit);
  return c.json({
    success: true,
    data: leads,
    count: leads.length,
  });
});

// GET /api/acquisition/hot - Get hot leads
acquisitionRouter.get('/hot', async (c) => {
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 10;
  const leads = await acquisitionService.getHotLeads(limit);
  return c.json({
    success: true,
    data: leads,
    count: leads.length,
  });
});

// GET /api/acquisition/top - Get top scoring leads
acquisitionRouter.get('/top', async (c) => {
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 10;
  const minScore = c.req.query('minScore') ? parseInt(c.req.query('minScore')!) : 50;
  const leads = await acquisitionService.getTopLeads(limit, minScore);
  return c.json({
    success: true,
    data: leads,
    count: leads.length,
  });
});

// ==========================================
// ENRICHMENT
// ==========================================

// GET /api/acquisition/leads/:id/enrichment - Get enrichment history
acquisitionRouter.get('/leads/:id/enrichment', async (c) => {
  const id = c.req.param('id');
  const history = await acquisitionService.getEnrichmentHistory(id);
  return c.json({
    success: true,
    data: history,
    count: history.length,
  });
});

// GET /api/acquisition/needs-enrichment - Get leads needing enrichment
acquisitionRouter.get('/needs-enrichment', async (c) => {
  const source = c.req.query('source') || 'google_places';
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50;
  const leads = await acquisitionService.getLeadsNeedingEnrichment(source, limit);
  return c.json({
    success: true,
    data: leads,
    count: leads.length,
  });
});

// POST /api/acquisition/leads/:id/enrich - Trigger enrichment for a single lead
acquisitionRouter.post('/leads/:id/enrich', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const sources = body.sources as ('google_places' | 'yelp' | 'website' | 'linkedin')[] | undefined;
  const async = body.async === true;

  // Check if lead exists
  const lead = await acquisitionService.getLead(id);
  if (!lead) throw new NotFoundError('Lead');

  if (async) {
    // Queue background job
    const job = await addAcquisitionEnrichJob({ leadId: id, sources });
    return c.json({
      success: true,
      message: 'Enrichment job queued',
      data: { jobId: job.id },
    });
  } else {
    // Run synchronously
    const results = await acquisitionEnrichmentService.enrichLead(id, sources);
    const successCount = results.filter((r) => r.status === 'success').length;
    return c.json({
      success: true,
      message: `Enrichment complete: ${successCount}/${results.length} sources succeeded`,
      data: { results },
    });
  }
});

// POST /api/acquisition/enrich-batch - Trigger batch enrichment
acquisitionRouter.post('/enrich-batch', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const leadIds = body.leadIds as string[] | undefined;
  const sources = body.sources as ('google_places' | 'yelp' | 'website' | 'linkedin')[] | undefined;
  const limit = body.limit ?? 50;

  // Queue background job
  const job = await addAcquisitionEnrichBatchJob({ leadIds, sources, limit });

  return c.json({
    success: true,
    message: 'Batch enrichment job queued',
    data: { jobId: job.id },
  });
});

// GET /api/acquisition/enrichment-status - Check if enrichment APIs are configured
acquisitionRouter.get('/enrichment-status', async (c) => {
  const { googlePlacesIntegration } = await import('../../integrations/google-places');
  const { yelpIntegration } = await import('../../integrations/yelp');

  return c.json({
    success: true,
    data: {
      google_places: googlePlacesIntegration.isConfigured(),
      yelp: yelpIntegration.isConfigured(),
      website: false, // Not implemented yet
      linkedin: false, // Not implemented yet
    },
  });
});

// ==========================================
// SCORING (AI)
// ==========================================

// POST /api/acquisition/leads/:id/score - Score a single lead with AI
acquisitionRouter.post('/leads/:id/score', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const async = body.async === true;

  // Check if lead exists
  const lead = await acquisitionService.getLead(id);
  if (!lead) throw new NotFoundError('Lead');

  if (!acquisitionScoringService.isConfigured()) {
    return c.json({
      success: false,
      error: 'Anthropic API key not configured',
    }, 503);
  }

  if (async) {
    // Queue background job
    const job = await addAcquisitionScoreJob({ leadId: id });
    return c.json({
      success: true,
      message: 'Scoring job queued',
      data: { jobId: job.id },
    });
  } else {
    // Run synchronously
    const result = await acquisitionScoringService.scoreLead(id);
    return c.json({
      success: true,
      message: `Lead scored: ${result.totalScore}/100`,
      data: result,
    });
  }
});

// POST /api/acquisition/score-batch - Queue batch scoring job
acquisitionRouter.post('/score-batch', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const leadIds = body.leadIds as string[] | undefined;
  const limit = body.limit ?? 50;

  if (!acquisitionScoringService.isConfigured()) {
    return c.json({
      success: false,
      error: 'Anthropic API key not configured',
    }, 503);
  }

  // Queue background job
  const job = await addAcquisitionScoreBatchJob({ leadIds, limit });

  return c.json({
    success: true,
    message: 'Batch scoring job queued',
    data: { jobId: job.id },
  });
});

// GET /api/acquisition/needs-scoring - Get leads that need AI scoring
acquisitionRouter.get('/needs-scoring', async (c) => {
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50;
  const leadIds = await acquisitionScoringService.getLeadsNeedingScoring(limit);

  // Get full lead data
  const leads = await Promise.all(
    leadIds.map((id) => acquisitionService.getLead(id))
  );

  return c.json({
    success: true,
    data: leads.filter(Boolean),
    count: leads.filter(Boolean).length,
  });
});

// GET /api/acquisition/scoring-status - Check if scoring is configured
acquisitionRouter.get('/scoring-status', async (c) => {
  return c.json({
    success: true,
    data: {
      configured: acquisitionScoringService.isConfigured(),
    },
  });
});

export { acquisitionRouter };
