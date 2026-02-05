-- Class GPT: Per-course RAG chat messages
-- Stores conversation history for each user per course

CREATE TABLE IF NOT EXISTS study_help_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES study_help_users(id) ON DELETE CASCADE,
  canvas_course_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  citations JSONB, -- [{name, url, type, snippet}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_help_chat_user_course_idx 
  ON study_help_chat_messages(user_id, canvas_course_id);
CREATE INDEX IF NOT EXISTS study_help_chat_created_idx 
  ON study_help_chat_messages(created_at);
