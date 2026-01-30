-- Add image support to Read Help
-- Stores extracted charts, diagrams, and figures from PDFs

ALTER TABLE read_help_chapters
ADD COLUMN images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN read_help_chapters.images IS 'Array of {path: string, pageNumber: number, caption?: string, type: "chart"|"diagram"|"figure"}';
