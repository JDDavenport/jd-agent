// Job status workflow
export type JobStatus =
  | 'discovered' // Found by agent or saved from job board
  | 'saved' // Saved for later review
  | 'applying' // Currently filling out application
  | 'applied' // Application submitted
  | 'phone_screen' // Phone screen scheduled/completed
  | 'interviewing' // In interview process
  | 'offered' // Received offer
  | 'rejected' // Application rejected
  | 'withdrawn' // User withdrew application
  | 'accepted'; // Accepted offer

export type JobPlatform =
  | 'linkedin'
  | 'indeed'
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'glassdoor'
  | 'angellist'
  | 'manual'
  | 'other';

export type LocationType = 'remote' | 'hybrid' | 'onsite';

export type RemotePreference = 'remote_only' | 'hybrid_ok' | 'onsite_ok';

export type ScreeningCategory =
  | 'work_auth'
  | 'salary'
  | 'availability'
  | 'experience'
  | 'relocation'
  | 'other';

// Contact at a company
export interface JobContact {
  name: string;
  title?: string;
  email?: string;
  linkedin?: string;
  notes?: string;
}

// Interview record
export interface Interview {
  date: string;
  type: string; // phone, technical, behavioral, onsite, panel
  with?: string; // interviewer name(s)
  notes?: string;
  outcome?: string; // passed, failed, pending
}

// Experience entry from resume
export interface ResumeExperience {
  company: string;
  title: string;
  dates: string;
  highlights?: string[];
}

// Main job entity
export interface Job {
  id: string;
  company: string;
  title: string;
  location?: string;
  locationType?: LocationType;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: string;
  description?: string;
  requirements?: string[];
  benefits?: string[];
  url?: string;
  platform?: JobPlatform;
  platformJobId?: string;
  status: JobStatus;
  matchScore?: number;
  matchReason?: string;
  appliedAt?: string;
  appliedVia?: 'agent' | 'manual';
  resumeUsedId?: string;
  coverLetter?: string;
  notes?: string;
  nextFollowUp?: string;
  contacts?: JobContact[];
  interviews?: Interview[];
  vaultEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

// Resume metadata
export interface ResumeMetadata {
  id: string;
  name: string;
  variant?: string;
  filePath: string;
  fileType?: string;
  isDefault: boolean;
  extractedSkills?: string[];
  extractedExperience?: ResumeExperience[];
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

// Job profile (user preferences)
export interface JobProfile {
  id: string;
  targetTitles?: string[];
  targetCompanies?: string[];
  excludeCompanies?: string[];
  minSalary?: number;
  maxSalary?: number;
  preferredLocations?: string[];
  remotePreference?: RemotePreference;
  willingToRelocate: boolean;
  yearsExperience?: number;
  skills?: string[];
  industries?: string[];
  autoApplyEnabled: boolean;
  autoApplyThreshold?: number;
  dailyApplicationLimit?: number;
  createdAt: string;
  updatedAt: string;
}

// Screening answer
export interface ScreeningAnswer {
  id: string;
  questionPattern: string;
  answer: string;
  category?: ScreeningCategory;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Application history entry
export interface ApplicationHistoryEntry {
  id: string;
  jobId: string;
  action: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Input types for creating/updating

export interface CreateJobInput {
  company: string;
  title: string;
  location?: string;
  locationType?: LocationType;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: string;
  description?: string;
  requirements?: string[];
  benefits?: string[];
  url?: string;
  platform?: JobPlatform;
  platformJobId?: string;
  status?: JobStatus;
  matchScore?: number;
  matchReason?: string;
  appliedAt?: string;
  appliedVia?: 'agent' | 'manual';
  resumeUsedId?: string;
  coverLetter?: string;
  notes?: string;
  nextFollowUp?: string;
  contacts?: JobContact[];
}

export interface UpdateJobInput {
  company?: string;
  title?: string;
  location?: string;
  locationType?: LocationType;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: string;
  description?: string;
  requirements?: string[];
  benefits?: string[];
  url?: string;
  status?: JobStatus;
  matchScore?: number;
  matchReason?: string;
  appliedAt?: string;
  appliedVia?: 'agent' | 'manual';
  resumeUsedId?: string;
  coverLetter?: string;
  notes?: string;
  nextFollowUp?: string;
  contacts?: JobContact[];
  interviews?: Interview[];
}

export interface ManualJobInput {
  company: string;
  title: string;
  location?: string;
  locationType?: LocationType;
  salaryMin?: number;
  salaryMax?: number;
  url?: string;
  appliedAt?: string;
  status?: JobStatus;
  notes?: string;
  resumeUsedId?: string;
  coverLetter?: string;
}

export interface JobFilters {
  status?: JobStatus;
  statuses?: JobStatus[];
  platform?: JobPlatform;
  company?: string;
  minMatchScore?: number;
  appliedAfter?: string;
  appliedBefore?: string;
  hasFollowUp?: boolean;
}

export interface CreateResumeInput {
  name: string;
  variant?: string;
  filePath: string;
  fileType?: string;
  isDefault?: boolean;
  extractedSkills?: string[];
  extractedExperience?: ResumeExperience[];
}

export interface UpdateResumeInput {
  name?: string;
  variant?: string;
  isDefault?: boolean;
  extractedSkills?: string[];
  extractedExperience?: ResumeExperience[];
}

export interface UpdateJobProfileInput {
  targetTitles?: string[];
  targetCompanies?: string[];
  excludeCompanies?: string[];
  minSalary?: number;
  maxSalary?: number;
  preferredLocations?: string[];
  remotePreference?: RemotePreference;
  willingToRelocate?: boolean;
  yearsExperience?: number;
  skills?: string[];
  industries?: string[];
  autoApplyEnabled?: boolean;
  autoApplyThreshold?: number;
  dailyApplicationLimit?: number;
}

export interface CreateScreeningAnswerInput {
  questionPattern: string;
  answer: string;
  category?: ScreeningCategory;
  isDefault?: boolean;
}

// Dashboard statistics
export interface JobStats {
  total: number;
  byStatus: Record<JobStatus, number>;
  byPlatform: Record<string, number>;
  thisWeek: {
    applied: number;
    interviews: number;
    offers: number;
    rejections: number;
  };
  thisMonth: {
    applied: number;
    interviews: number;
    offers: number;
    rejections: number;
  };
  responseRate: number; // % of applications that got a response
  interviewRate: number; // % of applications that got an interview
  averageMatchScore: number;
}
