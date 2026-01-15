-- JD Agent - PostgreSQL Initialization Script
-- This runs automatically when the PostgreSQL container first starts

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For faster GIN indexes

-- Create schema for organization (optional)
-- CREATE SCHEMA IF NOT EXISTS jd_agent;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE jd_agent TO jdagent;

-- Output confirmation
DO $$
BEGIN
    RAISE NOTICE 'JD Agent database initialized successfully!';
END $$;
