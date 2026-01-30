/**
 * JD Agent - Acquisition Scoring Service
 *
 * Uses Claude AI to analyze and score acquisition leads based on multiple factors:
 * - Business age and likely owner retirement timing
 * - Entity type (ease of transfer)
 * - Online presence and modernization opportunity
 * - Reputation (reviews)
 * - Industry fit for automation
 */

import { db } from '../db/client';
import { acquisitionLeads } from '../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Types
// ============================================

export interface ScoreFactors {
  ageFit: number; // 0-15: Is owner likely retiring?
  entityType: number; // 0-10: Ease of transfer (LLC best)
  ownerAgeSignals: number; // 0-15: LinkedIn, digital presence indicators
  onlinePresence: number; // 0-15: Modernization opportunity
  reputation: number; // 0-15: Reviews, proven business
  industryFit: number; // 0-15: Services > retail > manufacturing
  automationPotential: number; // 0-15: Repetitive ops score high
}

export interface ScoreResult {
  leadId: string;
  totalScore: number;
  factors: ScoreFactors;
  automationPotential: 'high' | 'medium' | 'low';
  recommendation: string;
  summary: string;
}

export interface BatchScoreResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: ScoreResult[];
}

// ============================================
// Scoring Prompt
// ============================================

const SCORING_SYSTEM_PROMPT = `You are an AI assistant helping evaluate business acquisition targets.
You will analyze business data and score them on their potential for acquisition by someone looking to:
1. Find "boomer businesses" - companies owned by aging owners who may want to exit
2. Acquire businesses where operations can be automated with AI agents
3. Find seller-financed deals with owners unaware of their business's market value

Score each factor from 0 to its maximum points. Be analytical and consistent.`;

const SCORING_USER_PROMPT = (lead: any) => `Analyze this Utah business as an acquisition target:

BUSINESS DATA:
- Name: ${lead.businessName}
- DBA: ${lead.dbaName || 'None'}
- Entity Type: ${lead.entityType || 'Unknown'}
- Filing Date: ${lead.filingDate ? new Date(lead.filingDate).toLocaleDateString() : 'Unknown'}
- Business Age: ${lead.businessAge || 'Unknown'} years
- Status: ${lead.status} - ${lead.statusDetails}
- Registered Agent: ${lead.registeredAgent || 'Unknown'}
- Principal Address: ${lead.principalAddress || 'Unknown'}

ENRICHMENT DATA:
- Website: ${lead.websiteUrl || 'None found'}
- Google Rating: ${lead.googleRating ? `${lead.googleRating}/5 (${lead.googleReviewCount} reviews)` : 'Not found'}
- Yelp Rating: ${lead.yelpRating ? `${lead.yelpRating}/5 (${lead.yelpReviewCount} reviews)` : 'Not found'}
- Industry: ${lead.industry || 'Unknown'}
- Owner Name: ${lead.ownerName || 'Unknown'}
- Owner LinkedIn: ${lead.ownerLinkedIn || 'Not found'}

Score each factor:

1. AGE FIT (0-15 points)
   - 20-25 years: Owner likely 50-60, may want to exit soon (10-15 pts)
   - 25-30 years: Owner likely 55-65, prime exit window (12-15 pts)
   - 30+ years: Owner likely 65+, may be eager to exit (8-12 pts)
   - Under 20 years: Owner may still be building (0-8 pts)

2. ENTITY TYPE (0-10 points)
   - LLC: Easiest to transfer (8-10 pts)
   - Corporation: Standard transfer (5-7 pts)
   - Partnership: More complex (3-5 pts)
   - Sole Proprietorship: Most complex (0-3 pts)

3. OWNER AGE SIGNALS (0-15 points)
   - No LinkedIn/online presence: Likely older, less tech-savvy (10-15 pts)
   - Basic online presence: Moderate indicator (5-10 pts)
   - Active social media: Likely younger owner (0-5 pts)

4. ONLINE PRESENCE (0-15 points)
   - No website: High modernization opportunity (12-15 pts)
   - Basic/outdated website: Good opportunity (8-12 pts)
   - Modern website: Less opportunity but proven business (5-8 pts)

5. REPUTATION (0-15 points)
   - High ratings (4.5+): Proven business (12-15 pts)
   - Good ratings (4.0-4.4): Solid business (8-12 pts)
   - Average ratings (3.5-3.9): Some concerns (5-8 pts)
   - Low/no ratings: Risky or B2B (0-5 pts)

6. INDUSTRY FIT (0-15 points)
   - Service businesses (HVAC, plumbing, etc.): High value (12-15 pts)
   - Professional services (accounting, legal, etc.): Good value (10-13 pts)
   - Retail/restaurant: Moderate (5-10 pts)
   - Manufacturing/construction: Complex (3-8 pts)

7. AUTOMATION POTENTIAL (0-15 points)
   - High repetitive tasks (service calls, scheduling): 12-15 pts
   - Moderate automation opportunity: 8-12 pts
   - Low automation potential: 0-8 pts

Respond in this exact JSON format:
{
  "factors": {
    "ageFit": <number>,
    "entityType": <number>,
    "ownerAgeSignals": <number>,
    "onlinePresence": <number>,
    "reputation": <number>,
    "industryFit": <number>,
    "automationPotential": <number>
  },
  "automationPotential": "<high|medium|low>",
  "recommendation": "<1-2 sentence recommendation>",
  "summary": "<2-3 sentence analysis summary>"
}`;

// ============================================
// Acquisition Scoring Service
// ============================================

class AcquisitionScoringService {
  private anthropic: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  isConfigured(): boolean {
    return !!this.anthropic;
  }

  /**
   * Score a single lead using Claude
   */
  async scoreLead(leadId: string): Promise<ScoreResult> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    // Get the lead
    const [lead] = await db.select().from(acquisitionLeads).where(eq(acquisitionLeads.id, leadId));
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    try {
      // Call Claude for scoring
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: SCORING_USER_PROMPT(lead),
          },
        ],
        system: SCORING_SYSTEM_PROMPT,
      });

      // Extract the text content
      const textContent = message.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      // Parse the JSON response
      const responseText = textContent.text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const factors = parsed.factors as ScoreFactors;

      // Calculate total score
      const totalScore =
        factors.ageFit +
        factors.entityType +
        factors.ownerAgeSignals +
        factors.onlinePresence +
        factors.reputation +
        factors.industryFit +
        factors.automationPotential;

      // Update the lead in database
      await db
        .update(acquisitionLeads)
        .set({
          acquisitionScore: totalScore,
          scoreBreakdown: factors,
          automationPotential: parsed.automationPotential,
          scoreSummary: parsed.summary,
          scoredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(acquisitionLeads.id, leadId));

      return {
        leadId,
        totalScore,
        factors,
        automationPotential: parsed.automationPotential,
        recommendation: parsed.recommendation,
        summary: parsed.summary,
      };
    } catch (error) {
      console.error(`[AcquisitionScoring] Error scoring lead ${leadId}:`, error);
      throw error;
    }
  }

  /**
   * Score multiple leads
   */
  async batchScore(leadIds?: string[], limit: number = 50): Promise<BatchScoreResult> {
    // Get leads to score
    let targetLeadIds = leadIds;
    if (!targetLeadIds || targetLeadIds.length === 0) {
      targetLeadIds = await this.getLeadsNeedingScoring(limit);
    }

    const result: BatchScoreResult = {
      processed: targetLeadIds.length,
      succeeded: 0,
      failed: 0,
      results: [],
    };

    for (const leadId of targetLeadIds) {
      try {
        const scoreResult = await this.scoreLead(leadId);
        result.results.push(scoreResult);
        result.succeeded++;

        // Add delay to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        console.error(`[AcquisitionScoring] Failed to score ${leadId}:`, error);
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Get leads that need scoring (have enrichment data but no score)
   */
  async getLeadsNeedingScoring(limit: number = 50): Promise<string[]> {
    // Get leads that have been enriched but not scored
    const leads = await db
      .select({ id: acquisitionLeads.id })
      .from(acquisitionLeads)
      .where(
        and(
          isNull(acquisitionLeads.scoredAt),
          // Prefer leads with some enrichment data
        )
      )
      .limit(limit);

    return leads.map((l) => l.id);
  }

  /**
   * Recalculate score for a lead (useful after enrichment updates)
   */
  async rescoreLead(leadId: string): Promise<ScoreResult> {
    // Just call scoreLead - it will overwrite existing scores
    return this.scoreLead(leadId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const acquisitionScoringService = new AcquisitionScoringService();
