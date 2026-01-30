/**
 * JD Agent - Acquisition Enrichment Service
 *
 * Orchestrates data enrichment from multiple sources (Google Places, Yelp, etc.)
 * to populate lead data and track enrichment attempts.
 */

import { db } from '../db/client';
import { acquisitionLeads, acquisitionEnrichmentLog } from '../db/schema';
import { eq } from 'drizzle-orm';
import { googlePlacesIntegration } from '../integrations/google-places';
import { yelpIntegration } from '../integrations/yelp';

// ============================================
// Types
// ============================================

export type EnrichmentSource = 'google_places' | 'yelp' | 'website' | 'linkedin';
export type EnrichmentStatus = 'success' | 'not_found' | 'error' | 'rate_limited' | 'not_configured';

export interface EnrichmentResult {
  source: EnrichmentSource;
  status: EnrichmentStatus;
  dataFound?: Record<string, any>;
  error?: string;
}

export interface BatchEnrichmentResult {
  leadId: string;
  results: EnrichmentResult[];
}

// ============================================
// Acquisition Enrichment Service
// ============================================

class AcquisitionEnrichmentService {
  /**
   * Enrich a lead from Google Places
   */
  async enrichFromGoogle(leadId: string): Promise<EnrichmentResult> {
    const source: EnrichmentSource = 'google_places';

    // Check if configured
    if (!googlePlacesIntegration.isConfigured()) {
      await this.logEnrichment(leadId, source, 'not_configured', null, 'Google Places API key not configured');
      return { source, status: 'not_configured', error: 'Google Places API key not configured' };
    }

    try {
      // Get the lead
      const [lead] = await db.select().from(acquisitionLeads).where(eq(acquisitionLeads.id, leadId));
      if (!lead) {
        return { source, status: 'error', error: 'Lead not found' };
      }

      // Search for the business
      const enrichment = await googlePlacesIntegration.enrichBusiness(lead.businessName, 'Utah');

      if (!enrichment.found) {
        await this.logEnrichment(leadId, source, 'not_found', null, 'Business not found on Google Places');
        return { source, status: 'not_found' };
      }

      // Update the lead
      const updateData: Record<string, any> = {};
      const dataFound: Record<string, any> = {};

      if (enrichment.placeId) {
        updateData.googlePlaceId = enrichment.placeId;
        dataFound.googlePlaceId = enrichment.placeId;
      }
      if (enrichment.rating !== undefined) {
        updateData.googleRating = enrichment.rating;
        dataFound.googleRating = enrichment.rating;
      }
      if (enrichment.reviewCount !== undefined) {
        updateData.googleReviewCount = enrichment.reviewCount;
        dataFound.googleReviewCount = enrichment.reviewCount;
      }
      if (enrichment.website && !lead.websiteUrl) {
        updateData.websiteUrl = enrichment.website;
        dataFound.websiteUrl = enrichment.website;
      }
      if (enrichment.phone && !lead.ownerPhone) {
        updateData.ownerPhone = enrichment.phone;
        dataFound.ownerPhone = enrichment.phone;
      }

      // Update enrichedAt timestamp
      updateData.enrichedAt = new Date();
      updateData.updatedAt = new Date();

      await db.update(acquisitionLeads).set(updateData).where(eq(acquisitionLeads.id, leadId));
      await this.logEnrichment(leadId, source, 'success', dataFound, null);

      return { source, status: 'success', dataFound };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logEnrichment(leadId, source, 'error', null, errorMessage);
      return { source, status: 'error', error: errorMessage };
    }
  }

  /**
   * Enrich a lead from Yelp
   */
  async enrichFromYelp(leadId: string): Promise<EnrichmentResult> {
    const source: EnrichmentSource = 'yelp';

    // Check if configured
    if (!yelpIntegration.isConfigured()) {
      await this.logEnrichment(leadId, source, 'not_configured', null, 'Yelp API key not configured');
      return { source, status: 'not_configured', error: 'Yelp API key not configured' };
    }

    try {
      // Get the lead
      const [lead] = await db.select().from(acquisitionLeads).where(eq(acquisitionLeads.id, leadId));
      if (!lead) {
        return { source, status: 'error', error: 'Lead not found' };
      }

      // Search for the business
      const enrichment = await yelpIntegration.enrichBusiness(lead.businessName, 'Utah');

      if (!enrichment.found) {
        await this.logEnrichment(leadId, source, 'not_found', null, 'Business not found on Yelp');
        return { source, status: 'not_found' };
      }

      // Update the lead
      const updateData: Record<string, any> = {};
      const dataFound: Record<string, any> = {};

      if (enrichment.yelpId) {
        updateData.yelpBusinessId = enrichment.yelpId;
        dataFound.yelpBusinessId = enrichment.yelpId;
      }
      if (enrichment.rating !== undefined) {
        updateData.yelpRating = enrichment.rating;
        dataFound.yelpRating = enrichment.rating;
      }
      if (enrichment.reviewCount !== undefined) {
        updateData.yelpReviewCount = enrichment.reviewCount;
        dataFound.yelpReviewCount = enrichment.reviewCount;
      }
      if (enrichment.phone && !lead.ownerPhone) {
        updateData.ownerPhone = enrichment.phone;
        dataFound.ownerPhone = enrichment.phone;
      }
      // Store categories as industry if not set
      if (enrichment.categories && enrichment.categories.length > 0 && !lead.industry) {
        updateData.industry = enrichment.categories[0];
        dataFound.industry = enrichment.categories[0];
      }

      // Update timestamps
      updateData.enrichedAt = new Date();
      updateData.updatedAt = new Date();

      await db.update(acquisitionLeads).set(updateData).where(eq(acquisitionLeads.id, leadId));
      await this.logEnrichment(leadId, source, 'success', dataFound, null);

      return { source, status: 'success', dataFound };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logEnrichment(leadId, source, 'error', null, errorMessage);
      return { source, status: 'error', error: errorMessage };
    }
  }

  /**
   * Enrich a lead from its website (placeholder for future implementation)
   */
  async enrichFromWebsite(leadId: string): Promise<EnrichmentResult> {
    const source: EnrichmentSource = 'website';

    try {
      // Get the lead
      const [lead] = await db.select().from(acquisitionLeads).where(eq(acquisitionLeads.id, leadId));
      if (!lead) {
        return { source, status: 'error', error: 'Lead not found' };
      }

      if (!lead.websiteUrl) {
        await this.logEnrichment(leadId, source, 'not_found', null, 'No website URL to scrape');
        return { source, status: 'not_found', error: 'No website URL' };
      }

      // TODO: Implement website scraping for contact info
      // This would extract:
      // - Contact email
      // - Phone numbers
      // - Owner/team names
      // - About page info

      await this.logEnrichment(leadId, source, 'not_found', null, 'Website scraping not yet implemented');
      return { source, status: 'not_found', error: 'Website scraping not yet implemented' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logEnrichment(leadId, source, 'error', null, errorMessage);
      return { source, status: 'error', error: errorMessage };
    }
  }

  /**
   * Enrich a lead from LinkedIn (placeholder for future implementation)
   */
  async enrichFromLinkedIn(leadId: string): Promise<EnrichmentResult> {
    const source: EnrichmentSource = 'linkedin';

    try {
      // Get the lead
      const [lead] = await db.select().from(acquisitionLeads).where(eq(acquisitionLeads.id, leadId));
      if (!lead) {
        return { source, status: 'error', error: 'Lead not found' };
      }

      // TODO: Implement LinkedIn search
      // This would find:
      // - Business owner profile
      // - Owner's age/experience
      // - Company page
      // - Employee count

      await this.logEnrichment(leadId, source, 'not_found', null, 'LinkedIn search not yet implemented');
      return { source, status: 'not_found', error: 'LinkedIn search not yet implemented' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logEnrichment(leadId, source, 'error', null, errorMessage);
      return { source, status: 'error', error: errorMessage };
    }
  }

  /**
   * Enrich a single lead from all configured sources
   */
  async enrichLead(leadId: string, sources?: EnrichmentSource[]): Promise<EnrichmentResult[]> {
    const sourcesToUse = sources || ['google_places', 'yelp'] as EnrichmentSource[];
    const results: EnrichmentResult[] = [];

    for (const source of sourcesToUse) {
      switch (source) {
        case 'google_places':
          results.push(await this.enrichFromGoogle(leadId));
          break;
        case 'yelp':
          results.push(await this.enrichFromYelp(leadId));
          break;
        case 'website':
          results.push(await this.enrichFromWebsite(leadId));
          break;
        case 'linkedin':
          results.push(await this.enrichFromLinkedIn(leadId));
          break;
      }
    }

    return results;
  }

  /**
   * Batch enrich multiple leads
   */
  async batchEnrich(
    leadIds: string[],
    sources?: EnrichmentSource[]
  ): Promise<BatchEnrichmentResult[]> {
    const results: BatchEnrichmentResult[] = [];

    for (const leadId of leadIds) {
      const leadResults = await this.enrichLead(leadId, sources);
      results.push({ leadId, results: leadResults });

      // Add a small delay between leads to avoid rate limiting
      await this.delay(500);
    }

    return results;
  }

  /**
   * Get all leads that need enrichment
   */
  async getLeadsNeedingEnrichment(limit: number = 50): Promise<string[]> {
    const leads = await db
      .select({ id: acquisitionLeads.id })
      .from(acquisitionLeads)
      .where(eq(acquisitionLeads.enrichedAt, null as any))
      .limit(limit);

    return leads.map((l) => l.id);
  }

  /**
   * Get enrichment history for a lead
   */
  async getEnrichmentHistory(leadId: string) {
    return db
      .select()
      .from(acquisitionEnrichmentLog)
      .where(eq(acquisitionEnrichmentLog.leadId, leadId))
      .orderBy(acquisitionEnrichmentLog.attemptedAt);
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async logEnrichment(
    leadId: string,
    source: EnrichmentSource,
    status: EnrichmentStatus,
    dataFound: Record<string, any> | null,
    errorMessage: string | null
  ): Promise<void> {
    await db.insert(acquisitionEnrichmentLog).values({
      leadId,
      source,
      status,
      dataFound,
      errorMessage,
      attemptedAt: new Date(),
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const acquisitionEnrichmentService = new AcquisitionEnrichmentService();
