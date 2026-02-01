-- Migration: Study Help Multi-Tenant Auth
-- Created: 2025-02-01
-- Description: Add tables for multi-user support in study-help app

-- ============================================
-- INSTITUTIONS (Universities with Canvas LMS)
-- ============================================
CREATE TABLE IF NOT EXISTS study_help_institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Institution info
    name TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    short_name TEXT,
    logo_url TEXT,
    
    -- Canvas LMS configuration
    canvas_base_url TEXT NOT NULL,
    canvas_client_id TEXT,
    canvas_client_secret_encrypted TEXT,
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_help_institutions_domain_idx ON study_help_institutions(domain);
CREATE INDEX IF NOT EXISTS study_help_institutions_enabled_idx ON study_help_institutions(enabled);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS study_help_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic info
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    
    -- Institution link
    institution_id UUID REFERENCES study_help_institutions(id),
    
    -- Canvas OAuth tokens (encrypted)
    canvas_access_token_encrypted TEXT,
    canvas_refresh_token_encrypted TEXT,
    canvas_token_expires_at TIMESTAMPTZ,
    canvas_user_id TEXT,
    
    -- Email verification
    email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verified_at TIMESTAMPTZ,
    email_verification_token TEXT,
    email_verification_expires_at TIMESTAMPTZ,
    
    -- Password reset
    password_reset_token TEXT,
    password_reset_expires_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_help_users_email_idx ON study_help_users(email);
CREATE INDEX IF NOT EXISTS study_help_users_institution_idx ON study_help_users(institution_id);
CREATE INDEX IF NOT EXISTS study_help_users_canvas_user_idx ON study_help_users(canvas_user_id);
CREATE INDEX IF NOT EXISTS study_help_users_active_idx ON study_help_users(is_active);

-- ============================================
-- SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS study_help_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES study_help_users(id) ON DELETE CASCADE,
    
    -- Session token (hashed)
    token_hash TEXT NOT NULL UNIQUE,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Session metadata
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_help_sessions_user_idx ON study_help_sessions(user_id);
CREATE INDEX IF NOT EXISTS study_help_sessions_token_idx ON study_help_sessions(token_hash);
CREATE INDEX IF NOT EXISTS study_help_sessions_expires_idx ON study_help_sessions(expires_at);

-- ============================================
-- USER COURSES (Per-user course enrollments)
-- ============================================
CREATE TABLE IF NOT EXISTS study_help_user_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES study_help_users(id) ON DELETE CASCADE,
    
    -- Canvas course info
    canvas_course_id TEXT NOT NULL,
    course_name TEXT NOT NULL,
    course_code TEXT,
    term TEXT,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    
    -- Sync tracking
    last_content_sync_at TIMESTAMPTZ,
    last_task_sync_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, canvas_course_id)
);

CREATE INDEX IF NOT EXISTS study_help_user_courses_user_idx ON study_help_user_courses(user_id);
CREATE INDEX IF NOT EXISTS study_help_user_courses_canvas_idx ON study_help_user_courses(canvas_course_id);
CREATE INDEX IF NOT EXISTS study_help_user_courses_active_idx ON study_help_user_courses(is_active);

-- ============================================
-- SEED DATA: BYU Institution
-- ============================================
INSERT INTO study_help_institutions (id, name, domain, short_name, canvas_base_url, enabled)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Brigham Young University',
    'byu.edu',
    'BYU',
    'https://byu.instructure.com',
    true
)
ON CONFLICT (domain) DO NOTHING;

-- ============================================
-- SEED DATA: Default User for JD (for migration)
-- ============================================
-- This creates a placeholder user for existing single-user data
-- The password is 'changeme' - should be changed immediately
INSERT INTO study_help_users (
    id, 
    email, 
    password_hash, 
    name, 
    institution_id,
    email_verified,
    is_active
)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'jd@byu.edu',
    '$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDER_HASH',
    'JD Davenport',
    'a0000000-0000-0000-0000-000000000001',
    true,
    true
)
ON CONFLICT (email) DO NOTHING;

-- Note: The password hash above is a placeholder. 
-- User should reset password or it will be set properly on first login attempt.

COMMENT ON TABLE study_help_institutions IS 'Universities/institutions with Canvas LMS integration';
COMMENT ON TABLE study_help_users IS 'Study Help app users with Canvas OAuth tokens';
COMMENT ON TABLE study_help_sessions IS 'User sessions for authentication';
COMMENT ON TABLE study_help_user_courses IS 'Per-user Canvas course enrollments';
