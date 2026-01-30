-- Canvas Complete Phase 2: Course Materials
-- This migration creates the canvas_materials table for storing downloaded course files

CREATE TABLE IF NOT EXISTS canvas_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canvas Identity
  canvas_item_id UUID REFERENCES canvas_items(id) ON DELETE SET NULL,
  canvas_file_id TEXT UNIQUE,
  course_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,

  -- File Details
  file_name TEXT NOT NULL,
  display_name TEXT,
  file_type TEXT NOT NULL, -- pdf, pptx, docx, xlsx, url
  mime_type TEXT,
  file_size_bytes BIGINT,
  local_path TEXT, -- hub/storage/canvas/...
  download_url TEXT,
  canvas_url TEXT,

  -- Organization
  module_name TEXT,
  module_position INTEGER,
  material_type TEXT, -- case, reading, lecture, syllabus, template, data

  -- Content Extraction
  page_count INTEGER,
  extracted_text TEXT, -- For full-text search
  ai_summary TEXT,

  -- Vault Integration
  vault_page_id UUID REFERENCES vault_pages(id) ON DELETE SET NULL,

  -- Reading Tracking
  read_status TEXT NOT NULL DEFAULT 'unread', -- unread, in_progress, completed
  read_progress INTEGER NOT NULL DEFAULT 0, -- 0-100%
  last_read_at TIMESTAMP WITH TIME ZONE,

  -- Relationships
  related_assignment_ids UUID[], -- Links to canvas_items

  -- Sync Tracking
  downloaded_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS canvas_materials_course_idx ON canvas_materials(course_id);
CREATE INDEX IF NOT EXISTS canvas_materials_canvas_item_idx ON canvas_materials(canvas_item_id);
CREATE INDEX IF NOT EXISTS canvas_materials_file_type_idx ON canvas_materials(file_type);
CREATE INDEX IF NOT EXISTS canvas_materials_material_type_idx ON canvas_materials(material_type);
CREATE INDEX IF NOT EXISTS canvas_materials_read_status_idx ON canvas_materials(read_status);
CREATE INDEX IF NOT EXISTS canvas_materials_vault_page_idx ON canvas_materials(vault_page_id);

-- Full-text search index on extracted text
CREATE INDEX IF NOT EXISTS canvas_materials_text_search_idx
  ON canvas_materials USING gin(to_tsvector('english', COALESCE(extracted_text, '')));
