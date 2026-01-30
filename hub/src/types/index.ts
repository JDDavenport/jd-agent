// ============================================
// TASKS
// ============================================

export type TaskStatus = 'inbox' | 'today' | 'upcoming' | 'waiting' | 'someday' | 'done' | 'archived';
export type TaskSource = 'email' | 'canvas' | 'meeting' | 'recording' | 'manual' | 'calendar' | 'remarkable' | 'chat' | 'agent' | 'acquisition';
export type EnergyLevel = 'high' | 'low' | 'admin';

export interface Task {
  id: string;
  linearId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  dueDate?: Date;
  dueDateIsHard: boolean;

  // Required metadata
  source: TaskSource;
  sourceRef?: string;
  context: string;

  // Optional metadata
  timeEstimateMinutes?: number;
  energyLevel?: EnergyLevel;
  blockedBy?: string;
  waitingFor?: string;

  // Hierarchy
  projectId?: string;
  parentTaskId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface Project {
  id: string;
  linearId?: string;
  name: string;
  description?: string;
  context: string;
  status: 'active' | 'completed' | 'on_hold' | 'someday';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// VAULT
// ============================================

export type VaultContentType =
  | 'note'
  | 'recording_summary'
  | 'lecture'
  | 'meeting'
  | 'article'
  | 'reference'
  | 'resume'
  | 'document'
  | 'journal'
  | 'class_notes'
  | 'meeting_notes'
  | 'task_archive'
  | 'snippet'
  | 'template'
  | 'person'      // Person info (contact details, birthday, etc.)
  | 'credential'  // Passwords, API keys, secrets
  | 'financial'   // SSN, account numbers, financial info
  | 'medical'     // Medical records, health info
  | 'legal'       // Contracts, legal documents
  | 'other';

export type VaultSource =
  | 'remarkable'
  | 'plaud'
  | 'email'
  | 'manual'
  | 'web'
  | 'canvas'
  | 'notion'
  | 'google_drive'
  | 'google_docs'
  | 'apple_notes'
  | 'tasks'
  | 'chat'
  | 'goal-export'
  | 'reflection-export';

export interface VaultEntry {
  id: string;
  title: string;
  content?: string;
  contentType: VaultContentType;

  // Organization
  context: string;
  tags: string[];
  category?: string; // AI-classified category (career, class, personal, etc.)

  // Source tracking (original system)
  source: VaultSource;
  sourceRef?: string;

  // Migration-specific source tracking
  sourceId?: string; // Original ID in source system
  sourceUrl?: string; // Link back to original
  sourcePath?: string; // Folder path in source system

  // Related items
  recordingId?: string;
  relatedEntries: string[];

  // Processing state
  isProcessed?: boolean; // Has been classified/tagged by AI
  needsReview?: boolean; // Flagged for human review
  isDuplicate?: boolean; // Detected as duplicate
  duplicateOf?: string; // Reference to canonical entry

  // Timestamps
  sourceDate?: Date; // Original creation date in source system
  createdAt: Date;
  updatedAt: Date;
  importedAt?: Date; // When we imported it during migration
  lastSyncedAt?: Date; // For ongoing sync
}

// ============================================
// VAULT ATTACHMENTS
// ============================================

export interface VaultAttachment {
  id: string;
  entryId: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string; // Path in R2/local storage
  extractedText?: string; // If we extracted text from it
  uploadedAt: Date;
}

// ============================================
// MIGRATION & SYNC
// ============================================

export type DataSource = 'notion' | 'google_drive' | 'google_docs' | 'apple_notes' | 'manual';
export type SyncStatus = 'idle' | 'running' | 'error';

export interface SyncState {
  id: string;
  source: DataSource;
  lastSyncAt: Date;
  lastCursor?: string; // For paginated APIs
  lastModifiedTime?: Date; // For incremental sync
  status: SyncStatus;
  errorMessage?: string;
  itemsProcessed: number;
  itemsAdded: number;
  itemsUpdated: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawEntry {
  // Core content
  title: string;
  content: string;

  // Source tracking
  source: DataSource;
  sourceId: string;
  sourceUrl?: string;
  sourcePath?: string;

  // Dates
  createdAt: Date;
  modifiedAt: Date;

  // Raw metadata from source
  rawMetadata?: Record<string, unknown>;

  // Attachments
  attachments?: {
    filename: string;
    url?: string;
    data?: Buffer;
    mimeType: string;
    size: number;
  }[];
}

export interface ClassificationResult {
  contentType: VaultContentType;
  category: string;
  tags: string[];
  summary: string;
  isUseful: boolean;
  suggestedAction: 'keep' | 'archive' | 'delete' | 'review';
  confidence: number;
}

// ============================================
// RECORDINGS
// ============================================

export type RecordingType = 'class' | 'meeting' | 'conversation' | 'other';
export type RecordingStatus = 'pending' | 'transcribing' | 'summarizing' | 'complete' | 'failed';

export interface Recording {
  id: string;
  filePath: string;
  originalFilename?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;

  recordingType: RecordingType;
  context?: string;

  status: RecordingStatus;

  recordedAt?: Date;
  uploadedAt: Date;
  processedAt?: Date;

  errorMessage?: string;
  retryCount: number;
}

export interface Transcript {
  id: string;
  recordingId: string;
  fullText: string;
  segments: TranscriptSegment[];
  wordCount: number;
  speakerCount: number;
  confidenceScore: number;
  createdAt: Date;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface RecordingSummary {
  id: string;
  recordingId: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  commitments: Commitment[];
  questions: string[];
  deadlinesMentioned: MentionedDeadline[];
  topicsCovered: string[];
  modelUsed: string;
  createdAt: Date;
}

export interface Commitment {
  person: string;
  commitment: string;
  dueDate?: Date;
}

export interface MentionedDeadline {
  description: string;
  date: Date;
}

// ============================================
// PEOPLE
// ============================================

export interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  howMet?: string;
  whereMet?: string;
  firstMetDate?: Date;
  relationshipType: 'professor' | 'classmate' | 'colleague' | 'friend' | 'family' | 'other';
  keyFacts: string[];
  notes?: string;
  lastInteractionDate?: Date;
  interactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// CALENDAR
// ============================================

export interface CalendarEvent {
  id: string;
  googleEventId?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  eventType?: 'class' | 'meeting' | 'deadline' | 'personal' | 'blocked_time';
  context?: string;
  alertSent: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// CLASSES
// ============================================

export interface Class {
  id: string;
  name: string;
  code?: string;
  professor?: string;
  canvasCourseId?: string;
  schedule: ClassSchedule[];
  agentSystemPrompt?: string;
  status: 'active' | 'completed' | 'dropped';
  semester: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassSchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string; // "09:00"
  endTime: string; // "10:30"
  location?: string;
}

// ============================================
// AGENT TYPES
// ============================================

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentContext {
  userId: string;
  currentTime: Date;
  todaysTasks: Task[];
  upcomingEvents: CalendarEvent[];
  recentRecordings: Recording[];
  activeClasses: Class[];
}

export interface AgentToolCall {
  tool: string;
  input: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  toolCalls?: AgentToolCall[];
  tasksCreated?: Task[];
  vaultEntriesCreated?: VaultEntry[];
}

// ============================================
// SYSTEM
// ============================================

export interface Ceremony {
  id: string;
  ceremonyType: 'morning' | 'evening' | 'weekly';
  scheduledAt: Date;
  completedAt?: Date;
  skipped: boolean;
  skipReason?: string;
  notes?: string;
  createdAt: Date;
}

export interface IntegrityCheck {
  id: string;
  checkType: string;
  passed: boolean;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface SystemLog {
  id: string;
  logType: 'error' | 'warning' | 'info' | 'audit';
  component: string;
  message: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================
// AD EXCHANGE (Gadz.io)
// ============================================

export interface AdSpace {
  id: string;
  creatorAddress: string;
  currentOwnerAddress: string;
  previousOwnerAddress?: string;
  weeklyImpressions: number;
  currentReservePrice: number;
  ownershipTransferPrice?: number;
  weeklyHoldingFee: number;
  creatorSaleSharePercent: number;
  creatorFeeSharePercent: number;
  customContractTerms?: Record<string, unknown>;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  createdAt: Date;
  ownershipAcquiredAt?: Date;
  lastPaymentAt?: Date;
  nextPaymentDue?: Date;
}

export interface AdvertiserAllocation {
  id: string;
  adSpaceId: string;
  currentOwnerAddress: string;
  previousOwnerAddress?: string;
  allocationUnits: number;
  impressionsPerWeek: number;
  acquisitionPrice?: number;
  weeklyFee: number;
  creativeAssetUrls?: string[];
  clickThroughUrl?: string;
  isActive: boolean;
  createdAt: Date;
  allocationAcquiredAt?: Date;
  lastPaymentAt?: Date;
  nextPaymentDue?: Date;
}

export type AdPaymentStatus = 'pending' | 'completed' | 'failed' | 'reverted';
export type AdPaymentType =
  | 'ad_space_ownership'
  | 'ad_space_weekly_fee'
  | 'allocation_acquisition'
  | 'allocation_weekly_fee';

export interface AdPayment {
  id: string;
  paymentType: AdPaymentType;
  adSpaceId?: string;
  allocationId?: string;
  payerAddress: string;
  amount: number;
  transactionHash?: string;
  revenueDistribution?: Record<string, number>;
  status: AdPaymentStatus;
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
}

export type OwnershipTransferReason = 'sale' | 'non_payment_reversion' | 'initial_creation';
export type OwnershipTransferType = 'ad_space' | 'allocation';

export interface OwnershipTransfer {
  id: string;
  transferType: OwnershipTransferType;
  adSpaceId?: string;
  allocationId?: string;
  fromAddress: string;
  toAddress: string;
  transferPrice?: number;
  reason: OwnershipTransferReason;
  transactionHash?: string;
  createdAt: Date;
}

export interface PerformanceMetric {
  id: string;
  adSpaceId?: string;
  allocationId?: string;
  periodStart: Date;
  periodEnd: Date;
  impressionsDelivered: number;
  clicks: number;
  ctr?: number;
  revenueGenerated?: number;
  createdAt: Date;
}

export type MarketListingStatus = 'active' | 'sold' | 'cancelled' | 'expired';
export type MarketListingType = 'ad_space' | 'allocation';

export interface MarketListing {
  id: string;
  listingType: MarketListingType;
  adSpaceId?: string;
  allocationId?: string;
  sellerAddress: string;
  askPrice: number;
  minPrice?: number;
  status: MarketListingStatus;
  listedAt: Date;
  expiresAt?: Date;
  soldAt?: Date;
}
