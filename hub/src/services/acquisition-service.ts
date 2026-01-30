/**
 * Acquisition Service - Boomer Business Finder
 *
 * Manages acquisition leads, pipeline stages, and CRM interactions
 * for business acquisition lead generation.
 */

import { eq, desc, asc, and, or, gte, lte, ilike, sql, inArray, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import {
  acquisitionLeads,
  acquisitionInteractions,
  acquisitionEnrichmentLog,
  tasks,
} from '../db/schema';
import type { UtahBusiness } from './utah-business-scraper';

// Pipeline stages
export const PIPELINE_STAGES = [
  'new',
  'researching',
  'qualified',
  'outreach',
  'conversation',
  'negotiating',
  'closed_won',
  'closed_lost',
  'passed',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Types
export interface CreateLeadInput {
  entityNumber: string;
  businessName: string;
  dbaName?: string;
  entityType?: string;
  subtype?: string;
  filingDate?: Date;
  businessAge?: number;
  status?: string;
  statusDetails?: string;
  registeredAgent?: string;
  principalAddress?: string;
  mailingAddress?: string;
  notes?: string;
}

export interface UpdateLeadInput {
  businessName?: string;
  dbaName?: string;
  entityType?: string;
  subtype?: string;
  status?: string;
  statusDetails?: string;
  registeredAgent?: string;
  principalAddress?: string;
  mailingAddress?: string;
  ownerName?: string;
  ownerLinkedIn?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  websiteUrl?: string;
  googlePlaceId?: string;
  googleRating?: number;
  googleReviewCount?: number;
  yelpBusinessId?: string;
  yelpRating?: number;
  yelpReviewCount?: number;
  industry?: string;
  naicsCode?: string;
  employeeCount?: number;
  revenueEstimate?: string;
  acquisitionScore?: number;
  scoreBreakdown?: Record<string, number>;
  automationPotential?: string;
  scoreSummary?: string;
  pipelineStage?: PipelineStage;
  nextFollowUpAt?: Date;
  isFavorite?: boolean;
  isHot?: boolean;
  doNotContact?: boolean;
  passReason?: string;
  notes?: string;
  vaultEntryId?: string;
}

export interface LeadFilters {
  search?: string;
  stages?: PipelineStage[];
  minScore?: number;
  maxScore?: number;
  minAge?: number;
  maxAge?: number;
  entityTypes?: string[];
  isFavorite?: boolean;
  isHot?: boolean;
  hasFollowUp?: boolean;
  needsEnrichment?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'score' | 'age' | 'name' | 'created' | 'followUp';
  sortDir?: 'asc' | 'desc';
}

export interface CreateInteractionInput {
  leadId: string;
  interactionType: string;
  interactionDate: Date;
  direction?: string;
  subject?: string;
  summary?: string;
  outcome?: string;
  followUpNeeded?: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  taskId?: string;
  recordingId?: string;
  emailMessageId?: string;
}

export interface PipelineStats {
  total: number;
  byStage: Record<PipelineStage, number>;
  favorites: number;
  hot: number;
  needsFollowUp: number;
  avgScore: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

class AcquisitionService {
  /**
   * Get leads with filters
   */
  async getLeads(filters: LeadFilters = {}) {
    const conditions: any[] = [];

    // Search
    if (filters.search) {
      conditions.push(
        or(
          ilike(acquisitionLeads.businessName, `%${filters.search}%`),
          ilike(acquisitionLeads.dbaName, `%${filters.search}%`),
          ilike(acquisitionLeads.ownerName, `%${filters.search}%`),
          ilike(acquisitionLeads.entityNumber, `%${filters.search}%`)
        )
      );
    }

    // Stage filter
    if (filters.stages && filters.stages.length > 0) {
      conditions.push(inArray(acquisitionLeads.pipelineStage, filters.stages));
    }

    // Score range
    if (filters.minScore !== undefined) {
      conditions.push(gte(acquisitionLeads.acquisitionScore, filters.minScore));
    }
    if (filters.maxScore !== undefined) {
      conditions.push(lte(acquisitionLeads.acquisitionScore, filters.maxScore));
    }

    // Age range
    if (filters.minAge !== undefined) {
      conditions.push(gte(acquisitionLeads.businessAge, filters.minAge));
    }
    if (filters.maxAge !== undefined) {
      conditions.push(lte(acquisitionLeads.businessAge, filters.maxAge));
    }

    // Entity types
    if (filters.entityTypes && filters.entityTypes.length > 0) {
      conditions.push(inArray(acquisitionLeads.entityType, filters.entityTypes));
    }

    // Flags
    if (filters.isFavorite !== undefined) {
      conditions.push(eq(acquisitionLeads.isFavorite, filters.isFavorite));
    }
    if (filters.isHot !== undefined) {
      conditions.push(eq(acquisitionLeads.isHot, filters.isHot));
    }

    // Follow-up needed
    if (filters.hasFollowUp) {
      conditions.push(
        and(
          isNotNull(acquisitionLeads.nextFollowUpAt),
          lte(acquisitionLeads.nextFollowUpAt, new Date())
        )
      );
    }

    // Needs enrichment (no score yet)
    if (filters.needsEnrichment) {
      conditions.push(isNull(acquisitionLeads.acquisitionScore));
    }

    // Build query
    let query = db.select().from(acquisitionLeads);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Sorting
    const sortDir = filters.sortDir === 'asc' ? asc : desc;
    switch (filters.sortBy) {
      case 'score':
        query = query.orderBy(sortDir(acquisitionLeads.acquisitionScore)) as any;
        break;
      case 'age':
        query = query.orderBy(sortDir(acquisitionLeads.businessAge)) as any;
        break;
      case 'name':
        query = query.orderBy(sortDir(acquisitionLeads.businessName)) as any;
        break;
      case 'followUp':
        query = query.orderBy(sortDir(acquisitionLeads.nextFollowUpAt)) as any;
        break;
      default:
        query = query.orderBy(desc(acquisitionLeads.createdAt)) as any;
    }

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters.offset) {
      query = query.offset(filters.offset) as any;
    }

    return query;
  }

  /**
   * Get a single lead by ID
   */
  async getLead(id: string) {
    const result = await db
      .select()
      .from(acquisitionLeads)
      .where(eq(acquisitionLeads.id, id))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get lead by entity number
   */
  async getLeadByEntityNumber(entityNumber: string) {
    const result = await db
      .select()
      .from(acquisitionLeads)
      .where(eq(acquisitionLeads.entityNumber, entityNumber))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get lead with interactions
   */
  async getLeadWithInteractions(id: string) {
    const lead = await this.getLead(id);
    if (!lead) return null;

    const interactions = await db
      .select()
      .from(acquisitionInteractions)
      .where(eq(acquisitionInteractions.leadId, id))
      .orderBy(desc(acquisitionInteractions.interactionDate));

    return { ...lead, interactions };
  }

  /**
   * Create a new lead
   */
  async createLead(input: CreateLeadInput) {
    const [lead] = await db
      .insert(acquisitionLeads)
      .values({
        entityNumber: input.entityNumber,
        businessName: input.businessName,
        dbaName: input.dbaName,
        entityType: input.entityType,
        subtype: input.subtype,
        filingDate: input.filingDate,
        businessAge: input.businessAge,
        status: input.status,
        statusDetails: input.statusDetails,
        registeredAgent: input.registeredAgent,
        principalAddress: input.principalAddress,
        mailingAddress: input.mailingAddress,
        notes: input.notes,
        pipelineStage: 'new',
      })
      .returning();
    return lead;
  }

  /**
   * Update a lead
   */
  async updateLead(id: string, input: UpdateLeadInput) {
    const updateData: any = {
      ...input,
      updatedAt: new Date(),
    };

    // Handle scoring timestamp
    if (input.acquisitionScore !== undefined) {
      updateData.scoredAt = new Date();
    }

    // Handle enrichment timestamp
    if (
      input.googlePlaceId !== undefined ||
      input.yelpBusinessId !== undefined ||
      input.ownerLinkedIn !== undefined
    ) {
      updateData.enrichedAt = new Date();
    }

    const [updated] = await db
      .update(acquisitionLeads)
      .set(updateData)
      .where(eq(acquisitionLeads.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete a lead
   */
  async deleteLead(id: string) {
    const [deleted] = await db
      .delete(acquisitionLeads)
      .where(eq(acquisitionLeads.id, id))
      .returning();
    return deleted;
  }

  /**
   * Change pipeline stage
   */
  async changeStage(id: string, stage: PipelineStage, reason?: string) {
    const updateData: any = {
      pipelineStage: stage,
      updatedAt: new Date(),
    };

    if (stage === 'passed' && reason) {
      updateData.passReason = reason;
    }

    const [updated] = await db
      .update(acquisitionLeads)
      .set(updateData)
      .where(eq(acquisitionLeads.id, id))
      .returning();
    return updated;
  }

  /**
   * Toggle favorite
   */
  async toggleFavorite(id: string) {
    const lead = await this.getLead(id);
    if (!lead) return null;

    const [updated] = await db
      .update(acquisitionLeads)
      .set({
        isFavorite: !lead.isFavorite,
        updatedAt: new Date(),
      })
      .where(eq(acquisitionLeads.id, id))
      .returning();
    return updated;
  }

  /**
   * Toggle hot lead
   */
  async toggleHot(id: string) {
    const lead = await this.getLead(id);
    if (!lead) return null;

    const [updated] = await db
      .update(acquisitionLeads)
      .set({
        isHot: !lead.isHot,
        updatedAt: new Date(),
      })
      .where(eq(acquisitionLeads.id, id))
      .returning();
    return updated;
  }

  /**
   * Pass on a lead
   */
  async passOnLead(id: string, reason: string) {
    return this.changeStage(id, 'passed', reason);
  }

  /**
   * Set follow-up date
   */
  async setFollowUp(id: string, followUpDate: Date, notes?: string) {
    // Get the lead first for task creation
    const [lead] = await db.select().from(acquisitionLeads).where(eq(acquisitionLeads.id, id));
    if (!lead) return null;

    // Update the lead's follow-up date
    const [updated] = await db
      .update(acquisitionLeads)
      .set({
        nextFollowUpAt: followUpDate,
        updatedAt: new Date(),
      })
      .where(eq(acquisitionLeads.id, id))
      .returning();

    // Create a task for the follow-up
    const taskTitle = `Follow up: ${lead.businessName}`;
    const taskDescription = notes
      ? `Acquisition follow-up for ${lead.businessName}\n\nNotes: ${notes}`
      : `Acquisition follow-up for ${lead.businessName}`;

    await db.insert(tasks).values({
      title: taskTitle,
      description: taskDescription,
      status: 'upcoming',
      priority: 2, // Medium priority
      dueDate: followUpDate,
      dueDateIsHard: false,
      source: 'acquisition',
      sourceRef: id, // Link back to the lead
      context: 'work',
    });

    return updated;
  }

  /**
   * Mark as contacted
   */
  async markContacted(id: string) {
    const [updated] = await db
      .update(acquisitionLeads)
      .set({
        lastContactedAt: new Date(),
        contactAttempts: sql`${acquisitionLeads.contactAttempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(acquisitionLeads.id, id))
      .returning();
    return updated;
  }

  /**
   * Import leads from Utah scraper results
   */
  async importFromScraper(businesses: UtahBusiness[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    const currentYear = new Date().getFullYear();

    for (const biz of businesses) {
      try {
        // Check if already exists
        const existing = await this.getLeadByEntityNumber(biz.entityNumber);
        if (existing) {
          result.skipped++;
          continue;
        }

        // Parse filing date
        let filingDate: Date | undefined;
        if (biz.filingDateTime) {
          const parts = biz.filingDateTime.split(' ')[0].split('/');
          if (parts.length === 3) {
            filingDate = new Date(
              parseInt(parts[2]),
              parseInt(parts[0]) - 1,
              parseInt(parts[1])
            );
          }
        }

        // Calculate business age
        const businessAge = biz.fileYear ? currentYear - biz.fileYear : undefined;

        await this.createLead({
          entityNumber: biz.entityNumber,
          businessName: biz.name,
          dbaName: biz.otherName || undefined,
          entityType: biz.entityType,
          subtype: biz.subtype,
          filingDate,
          businessAge,
          status: biz.status,
          statusDetails: biz.statusDetails,
        });

        result.imported++;
      } catch (e) {
        result.errors.push(`${biz.entityNumber}: ${e}`);
      }
    }

    return result;
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStats(): Promise<PipelineStats> {
    const leads = await db.select().from(acquisitionLeads);

    const stats: PipelineStats = {
      total: leads.length,
      byStage: {
        new: 0,
        researching: 0,
        qualified: 0,
        outreach: 0,
        conversation: 0,
        negotiating: 0,
        closed_won: 0,
        closed_lost: 0,
        passed: 0,
      },
      favorites: 0,
      hot: 0,
      needsFollowUp: 0,
      avgScore: 0,
    };

    let scoreSum = 0;
    let scoreCount = 0;
    const now = new Date();

    for (const lead of leads) {
      // Count by stage
      if (lead.pipelineStage && lead.pipelineStage in stats.byStage) {
        stats.byStage[lead.pipelineStage as PipelineStage]++;
      }

      // Count favorites
      if (lead.isFavorite) stats.favorites++;

      // Count hot leads
      if (lead.isHot) stats.hot++;

      // Count needs follow-up
      if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= now) {
        stats.needsFollowUp++;
      }

      // Sum scores
      if (lead.acquisitionScore) {
        scoreSum += lead.acquisitionScore;
        scoreCount++;
      }
    }

    stats.avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;

    return stats;
  }

  /**
   * Get leads needing follow-up
   */
  async getFollowUps(limit: number = 20) {
    return db
      .select()
      .from(acquisitionLeads)
      .where(
        and(
          isNotNull(acquisitionLeads.nextFollowUpAt),
          lte(acquisitionLeads.nextFollowUpAt, new Date()),
          eq(acquisitionLeads.doNotContact, false)
        )
      )
      .orderBy(asc(acquisitionLeads.nextFollowUpAt))
      .limit(limit);
  }

  /**
   * Get hot leads
   */
  async getHotLeads(limit: number = 10) {
    return db
      .select()
      .from(acquisitionLeads)
      .where(eq(acquisitionLeads.isHot, true))
      .orderBy(desc(acquisitionLeads.acquisitionScore))
      .limit(limit);
  }

  /**
   * Get top scoring leads
   */
  async getTopLeads(limit: number = 10, minScore: number = 50) {
    return db
      .select()
      .from(acquisitionLeads)
      .where(
        and(
          gte(acquisitionLeads.acquisitionScore, minScore),
          inArray(acquisitionLeads.pipelineStage, ['new', 'researching', 'qualified'])
        )
      )
      .orderBy(desc(acquisitionLeads.acquisitionScore))
      .limit(limit);
  }

  // ==========================================
  // INTERACTIONS
  // ==========================================

  /**
   * Log an interaction with a lead
   */
  async logInteraction(input: CreateInteractionInput) {
    const [interaction] = await db
      .insert(acquisitionInteractions)
      .values({
        leadId: input.leadId,
        interactionType: input.interactionType,
        interactionDate: input.interactionDate,
        direction: input.direction,
        subject: input.subject,
        summary: input.summary,
        outcome: input.outcome,
        followUpNeeded: input.followUpNeeded || false,
        followUpDate: input.followUpDate,
        followUpNotes: input.followUpNotes,
        taskId: input.taskId,
        recordingId: input.recordingId,
        emailMessageId: input.emailMessageId,
      })
      .returning();

    // Update lead's last contacted and contact attempts
    await this.markContacted(input.leadId);

    // If follow-up is needed, update the lead's next follow-up date
    if (input.followUpNeeded && input.followUpDate) {
      await this.setFollowUp(input.leadId, input.followUpDate);
    }

    return interaction;
  }

  /**
   * Get interactions for a lead
   */
  async getInteractions(leadId: string) {
    return db
      .select()
      .from(acquisitionInteractions)
      .where(eq(acquisitionInteractions.leadId, leadId))
      .orderBy(desc(acquisitionInteractions.interactionDate));
  }

  // ==========================================
  // ENRICHMENT LOG
  // ==========================================

  /**
   * Log an enrichment attempt
   */
  async logEnrichment(
    leadId: string,
    source: string,
    status: string,
    dataFound?: Record<string, any>,
    errorMessage?: string
  ) {
    const [log] = await db
      .insert(acquisitionEnrichmentLog)
      .values({
        leadId,
        source,
        status,
        dataFound,
        errorMessage,
      })
      .returning();
    return log;
  }

  /**
   * Get enrichment history for a lead
   */
  async getEnrichmentHistory(leadId: string) {
    return db
      .select()
      .from(acquisitionEnrichmentLog)
      .where(eq(acquisitionEnrichmentLog.leadId, leadId))
      .orderBy(desc(acquisitionEnrichmentLog.attemptedAt));
  }

  /**
   * Get leads that need enrichment from a specific source
   */
  async getLeadsNeedingEnrichment(source: string, limit: number = 50) {
    // Get leads that don't have a successful enrichment for this source
    const enrichedLeadIds = await db
      .select({ leadId: acquisitionEnrichmentLog.leadId })
      .from(acquisitionEnrichmentLog)
      .where(
        and(
          eq(acquisitionEnrichmentLog.source, source),
          eq(acquisitionEnrichmentLog.status, 'success')
        )
      );

    const enrichedIds = enrichedLeadIds.map((r) => r.leadId);

    if (enrichedIds.length === 0) {
      return db
        .select()
        .from(acquisitionLeads)
        .where(eq(acquisitionLeads.doNotContact, false))
        .limit(limit);
    }

    return db
      .select()
      .from(acquisitionLeads)
      .where(
        and(
          sql`${acquisitionLeads.id} NOT IN (${sql.raw(enrichedIds.map((id) => `'${id}'`).join(','))})`,
          eq(acquisitionLeads.doNotContact, false)
        )
      )
      .limit(limit);
  }
}

export const acquisitionService = new AcquisitionService();
