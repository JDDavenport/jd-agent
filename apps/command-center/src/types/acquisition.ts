/**
 * Acquisition Types
 *
 * TypeScript interfaces for the Boomer Business Finder / Acquisition module.
 */

// ============================================
// Pipeline Types
// ============================================

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

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  researching: 'Researching',
  qualified: 'Qualified',
  outreach: 'Outreach',
  conversation: 'Conversation',
  negotiating: 'Negotiating',
  closed_won: 'Won',
  closed_lost: 'Lost',
  passed: 'Passed',
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  new: 'bg-gray-100 text-gray-800',
  researching: 'bg-blue-100 text-blue-800',
  qualified: 'bg-purple-100 text-purple-800',
  outreach: 'bg-yellow-100 text-yellow-800',
  conversation: 'bg-orange-100 text-orange-800',
  negotiating: 'bg-pink-100 text-pink-800',
  closed_won: 'bg-green-100 text-green-800',
  closed_lost: 'bg-red-100 text-red-800',
  passed: 'bg-gray-100 text-gray-500',
};

// ============================================
// Lead Types
// ============================================

export interface AcquisitionLead {
  id: string;
  entityNumber: string;
  businessName: string;
  dbaName: string | null;
  entityType: string | null;
  subtype: string | null;
  filingDate: string | null;
  businessAge: number | null;
  status: string | null;
  statusDetails: string | null;
  registeredAgent: string | null;
  principalAddress: string | null;
  mailingAddress: string | null;
  ownerName: string | null;
  ownerLinkedIn: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  websiteUrl: string | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  yelpBusinessId: string | null;
  yelpRating: number | null;
  yelpReviewCount: number | null;
  industry: string | null;
  naicsCode: string | null;
  employeeCount: number | null;
  revenueEstimate: string | null;
  acquisitionScore: number | null;
  scoreBreakdown: Record<string, number> | null;
  automationPotential: 'high' | 'medium' | 'low' | null;
  scoreSummary: string | null;
  pipelineStage: PipelineStage;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  contactAttempts: number;
  isFavorite: boolean;
  isHot: boolean;
  doNotContact: boolean;
  passReason: string | null;
  notes: string | null;
  vaultEntryId: string | null;
  createdAt: string;
  updatedAt: string;
  enrichedAt: string | null;
  scoredAt: string | null;
}

export interface AcquisitionLeadWithInteractions extends AcquisitionLead {
  interactions: AcquisitionInteraction[];
}

// ============================================
// Interaction Types
// ============================================

export type InteractionType = 'call' | 'email' | 'meeting' | 'site_visit' | 'linkedin' | 'letter' | 'note';
export type InteractionDirection = 'inbound' | 'outbound';
export type InteractionOutcome = 'positive' | 'neutral' | 'negative' | 'no_response';

export interface AcquisitionInteraction {
  id: string;
  leadId: string;
  interactionType: string;
  interactionDate: string;
  direction: InteractionDirection | null;
  subject: string | null;
  summary: string | null;
  outcome: InteractionOutcome | null;
  followUpNeeded: boolean;
  followUpDate: string | null;
  followUpNotes: string | null;
  taskId: string | null;
  recordingId: string | null;
  emailMessageId: string | null;
  createdAt: string;
}

// ============================================
// Filter Types
// ============================================

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

// ============================================
// Stats Types
// ============================================

export interface PipelineStats {
  total: number;
  byStage: Record<PipelineStage, number>;
  favorites: number;
  hot: number;
  needsFollowUp: number;
  avgScore: number;
}

// ============================================
// Import Types
// ============================================

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface ScraperBusiness {
  entityNumber: string;
  name: string;
  otherName?: string;
  filingDateTime?: string;
  status?: string;
  statusDetails?: string;
  fileDate?: string;
  fileYear?: number;
  entityType?: string;
  subtype?: string;
}

// ============================================
// Input Types
// ============================================

export interface CreateLeadInput {
  entityNumber: string;
  businessName: string;
  dbaName?: string;
  entityType?: string;
  subtype?: string;
  filingDate?: string;
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
  industry?: string;
  naicsCode?: string;
  employeeCount?: number;
  revenueEstimate?: string;
  pipelineStage?: PipelineStage;
  nextFollowUpAt?: string;
  isFavorite?: boolean;
  isHot?: boolean;
  doNotContact?: boolean;
  passReason?: string;
  notes?: string;
}

export interface CreateInteractionInput {
  interactionType: InteractionType;
  interactionDate: string;
  direction?: InteractionDirection;
  subject?: string;
  summary?: string;
  outcome?: InteractionOutcome;
  followUpNeeded?: boolean;
  followUpDate?: string;
  followUpNotes?: string;
}

export interface StageChangeInput {
  stage: PipelineStage;
  reason?: string;
}

// ============================================
// Scoring Types
// ============================================

export interface ScoreFactors {
  ageFit: number; // 0-15
  entityType: number; // 0-10
  ownerAgeSignals: number; // 0-15
  onlinePresence: number; // 0-15
  reputation: number; // 0-15
  industryFit: number; // 0-15
  automationPotential: number; // 0-15
}

export const SCORE_FACTOR_INFO: Record<keyof ScoreFactors, { label: string; maxPoints: number; description: string }> = {
  ageFit: {
    label: 'Age Fit',
    maxPoints: 15,
    description: 'Is the owner likely approaching retirement?',
  },
  entityType: {
    label: 'Entity Type',
    maxPoints: 10,
    description: 'Ease of ownership transfer (LLC is best)',
  },
  ownerAgeSignals: {
    label: 'Owner Age Signals',
    maxPoints: 15,
    description: 'Digital presence indicates likely owner age',
  },
  onlinePresence: {
    label: 'Online Presence',
    maxPoints: 15,
    description: 'Modernization opportunity (no website = high)',
  },
  reputation: {
    label: 'Reputation',
    maxPoints: 15,
    description: 'Online reviews and ratings',
  },
  industryFit: {
    label: 'Industry Fit',
    maxPoints: 15,
    description: 'Services > Professional > Retail',
  },
  automationPotential: {
    label: 'Automation Potential',
    maxPoints: 15,
    description: 'Can AI agents run this business?',
  },
};
