-- AI Agent Tree Strategic Roadmap Tables
-- Migration: 0011_roadmap_strategic_planning.sql

-- Roadmap Phases Table
CREATE TABLE IF NOT EXISTS roadmap_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Phase Identity
  phase_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  timeline TEXT NOT NULL,

  -- Status & Progress
  status TEXT NOT NULL DEFAULT 'not_started',
  progress INTEGER NOT NULL DEFAULT 0,

  -- Visual
  color TEXT NOT NULL,
  icon TEXT NOT NULL,

  -- Strategy Details
  goal TEXT NOT NULL,
  strategy TEXT NOT NULL,
  outcome TEXT NOT NULL,
  key_metrics JSONB NOT NULL DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Roadmap Milestones Table
CREATE TABLE IF NOT EXISTS roadmap_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent Phase
  phase_id UUID NOT NULL REFERENCES roadmap_phases(id) ON DELETE CASCADE,

  -- Milestone Details
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',

  -- Dates
  target_date DATE,
  completed_date DATE,

  -- Metrics
  metrics JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for roadmap_phases
CREATE INDEX IF NOT EXISTS roadmap_phases_status_idx ON roadmap_phases(status);
CREATE INDEX IF NOT EXISTS roadmap_phases_number_idx ON roadmap_phases(phase_number);

-- Indexes for roadmap_milestones
CREATE INDEX IF NOT EXISTS roadmap_milestones_phase_idx ON roadmap_milestones(phase_id);
CREATE INDEX IF NOT EXISTS roadmap_milestones_status_idx ON roadmap_milestones(status);
CREATE INDEX IF NOT EXISTS roadmap_milestones_sort_idx ON roadmap_milestones(phase_id, sort_order);
