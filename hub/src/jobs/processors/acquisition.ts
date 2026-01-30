/**
 * JD Agent - Acquisition Job Processor
 *
 * Processes background jobs for acquisition pipeline:
 * - acquisition-enrich: Enrich a single lead with external data
 * - acquisition-enrich-batch: Batch enrich multiple leads
 * - acquisition-score: Score a single lead with AI
 * - acquisition-score-batch: Batch score multiple leads
 */

import { Job } from 'bullmq';
import { acquisitionEnrichmentService } from '../../services/acquisition-enrichment-service';
import { acquisitionScoringService } from '../../services/acquisition-scoring-service';
import type {
  AcquisitionEnrichJobData,
  AcquisitionEnrichBatchJobData,
  AcquisitionScoreJobData,
  AcquisitionScoreBatchJobData,
} from '../queue';

// ============================================
// Job Processors
// ============================================

/**
 * Process acquisition-enrich job
 * Enriches a single lead from specified sources
 */
export async function processAcquisitionEnrichJob(
  job: Job<AcquisitionEnrichJobData>
): Promise<{ success: boolean; result: any }> {
  const { leadId, sources } = job.data;

  console.log(`[AcquisitionProcessor] Starting enrich job for lead ${leadId}`);

  try {
    const results = await acquisitionEnrichmentService.enrichLead(leadId, sources);

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'error').length;

    console.log(
      `[AcquisitionProcessor] Enrich complete for ${leadId}: ${successCount} success, ${failedCount} failed`
    );

    return {
      success: failedCount === 0,
      result: {
        leadId,
        results,
        successCount,
        failedCount,
      },
    };
  } catch (error) {
    console.error(`[AcquisitionProcessor] Enrich job failed for ${leadId}:`, error);
    throw error;
  }
}

/**
 * Process acquisition-enrich-batch job
 * Enriches multiple leads from specified sources
 */
export async function processAcquisitionEnrichBatchJob(
  job: Job<AcquisitionEnrichBatchJobData>
): Promise<{ success: boolean; result: any }> {
  const { leadIds, sources, limit = 50 } = job.data;

  console.log(`[AcquisitionProcessor] Starting batch enrich job`);

  try {
    // Get leads to process
    let targetLeadIds = leadIds;
    if (!targetLeadIds || targetLeadIds.length === 0) {
      targetLeadIds = await acquisitionEnrichmentService.getLeadsNeedingEnrichment(limit);
    }

    if (targetLeadIds.length === 0) {
      console.log(`[AcquisitionProcessor] No leads need enrichment`);
      return {
        success: true,
        result: {
          processed: 0,
          message: 'No leads need enrichment',
        },
      };
    }

    console.log(`[AcquisitionProcessor] Enriching ${targetLeadIds.length} leads`);

    // Update job progress
    await job.updateProgress(0);

    const batchResults = await acquisitionEnrichmentService.batchEnrich(targetLeadIds, sources);

    // Calculate statistics
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalNotFound = 0;

    for (const result of batchResults) {
      for (const r of result.results) {
        if (r.status === 'success') totalSuccess++;
        else if (r.status === 'error') totalFailed++;
        else if (r.status === 'not_found') totalNotFound++;
      }
    }

    await job.updateProgress(100);

    console.log(
      `[AcquisitionProcessor] Batch enrich complete: ${targetLeadIds.length} leads, ${totalSuccess} success, ${totalNotFound} not found, ${totalFailed} failed`
    );

    return {
      success: totalFailed === 0,
      result: {
        leadsProcessed: targetLeadIds.length,
        totalSuccess,
        totalNotFound,
        totalFailed,
        results: batchResults,
      },
    };
  } catch (error) {
    console.error(`[AcquisitionProcessor] Batch enrich job failed:`, error);
    throw error;
  }
}

/**
 * Process acquisition-score job
 * Scores a single lead using AI (Claude)
 */
export async function processAcquisitionScoreJob(
  job: Job<AcquisitionScoreJobData>
): Promise<{ success: boolean; result: any }> {
  const { leadId } = job.data;

  console.log(`[AcquisitionProcessor] Starting score job for lead ${leadId}`);

  try {
    if (!acquisitionScoringService.isConfigured()) {
      console.warn(`[AcquisitionProcessor] Anthropic API key not configured`);
      return {
        success: false,
        result: {
          leadId,
          error: 'Anthropic API key not configured',
        },
      };
    }

    const scoreResult = await acquisitionScoringService.scoreLead(leadId);

    console.log(
      `[AcquisitionProcessor] Score complete for ${leadId}: ${scoreResult.totalScore}/100`
    );

    return {
      success: true,
      result: scoreResult,
    };
  } catch (error) {
    console.error(`[AcquisitionProcessor] Score job failed for ${leadId}:`, error);
    throw error;
  }
}

/**
 * Process acquisition-score-batch job
 * Scores multiple leads using AI (Claude)
 */
export async function processAcquisitionScoreBatchJob(
  job: Job<AcquisitionScoreBatchJobData>
): Promise<{ success: boolean; result: any }> {
  const { leadIds, limit = 50 } = job.data;

  console.log(`[AcquisitionProcessor] Starting batch score job`);

  try {
    if (!acquisitionScoringService.isConfigured()) {
      console.warn(`[AcquisitionProcessor] Anthropic API key not configured`);
      return {
        success: false,
        result: {
          error: 'Anthropic API key not configured',
        },
      };
    }

    await job.updateProgress(0);

    const batchResult = await acquisitionScoringService.batchScore(leadIds, limit);

    await job.updateProgress(100);

    console.log(
      `[AcquisitionProcessor] Batch score complete: ${batchResult.succeeded}/${batchResult.processed} succeeded`
    );

    return {
      success: batchResult.failed === 0,
      result: batchResult,
    };
  } catch (error) {
    console.error(`[AcquisitionProcessor] Batch score job failed:`, error);
    throw error;
  }
}
