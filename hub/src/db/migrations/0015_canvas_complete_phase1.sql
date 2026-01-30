-- Canvas Complete Phase 1: Rich Assignment Details
-- Adds enhanced fields for full assignment context

-- Add new fields to canvas_items for rich assignment details
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS instructions_html TEXT;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS rubric JSONB;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS allowed_extensions TEXT[];
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS word_count_min INTEGER;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS word_count_max INTEGER;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS is_group_assignment BOOLEAN DEFAULT FALSE;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS has_peer_review BOOLEAN DEFAULT FALSE;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS attached_file_ids TEXT[];
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS vault_page_id UUID REFERENCES vault_pages(id);
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS lock_info JSONB;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS grading_type TEXT;

-- Create table for auto-generated assignment subtasks
CREATE TABLE IF NOT EXISTS canvas_assignment_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_item_id UUID REFERENCES canvas_items(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  subtask_type TEXT, -- reading, research, writing, review, submission
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- AI generation tracking
  generated_by TEXT DEFAULT 'manual', -- 'ai' or 'manual'
  generation_prompt TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for subtasks
CREATE INDEX IF NOT EXISTS canvas_subtasks_item_idx ON canvas_assignment_subtasks(canvas_item_id);
CREATE INDEX IF NOT EXISTS canvas_subtasks_task_idx ON canvas_assignment_subtasks(task_id);

-- Create table for assignment vault page links
CREATE TABLE IF NOT EXISTS canvas_assignment_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_item_id UUID REFERENCES canvas_items(id) ON DELETE CASCADE UNIQUE NOT NULL,
  vault_page_id UUID REFERENCES vault_pages(id) ON DELETE CASCADE NOT NULL,

  -- Embedded content snapshots
  instructions_snapshot TEXT,
  rubric_snapshot JSONB,

  -- User additions
  user_notes TEXT,
  submission_draft_path TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for assignment pages
CREATE INDEX IF NOT EXISTS canvas_assignment_pages_vault_idx ON canvas_assignment_pages(vault_page_id);

-- Add index for vault_page_id on canvas_items
CREATE INDEX IF NOT EXISTS canvas_items_vault_page_idx ON canvas_items(vault_page_id);
