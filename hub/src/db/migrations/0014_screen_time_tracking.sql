-- Screen Time Tracking for Command Center iOS
-- Stores daily productivity data synced from iOS Screen Time API

CREATE TABLE IF NOT EXISTS screen_time_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  device_id TEXT NOT NULL,

  -- Core metrics
  total_screen_time_minutes INTEGER NOT NULL DEFAULT 0,
  pickup_count INTEGER DEFAULT 0,
  notification_count INTEGER DEFAULT 0,

  -- Detailed breakdown (JSONB for flexibility)
  category_breakdown JSONB DEFAULT '{}',  -- { "social": 45, "entertainment": 30, "productivity": 60 }
  top_apps JSONB DEFAULT '[]',            -- [{ "name": "Twitter", "minutes": 30, "category": "social", "bundleId": "com.twitter" }]

  -- Hourly breakdown for detailed analysis
  hourly_breakdown JSONB DEFAULT '[]',    -- [{ "hour": 9, "minutes": 15 }, ...]

  -- Sync metadata
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  source_version TEXT,                    -- iOS version or app version

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Ensure one report per device per day
  UNIQUE(report_date, device_id)
);

-- Indexes for common queries
CREATE INDEX idx_screen_time_date ON screen_time_reports(report_date);
CREATE INDEX idx_screen_time_device ON screen_time_reports(device_id);
CREATE INDEX idx_screen_time_date_range ON screen_time_reports(report_date DESC);
