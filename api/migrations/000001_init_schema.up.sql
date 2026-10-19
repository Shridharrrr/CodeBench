-- PostgreSQL Migration: 000001_init_schema.up.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'participant',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    csrf_token VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent TEXT,
    ip_address VARCHAR(45)
);

-- Problems
CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Problem Versions (Immutable)
CREATE TABLE IF NOT EXISTS problem_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    version INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    statement_md TEXT NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    time_limit_ms INT NOT NULL DEFAULT 1000,
    memory_mb INT NOT NULL DEFAULT 256,
    checker_type VARCHAR(50) NOT NULL DEFAULT 'token',
    complexity_policy JSONB NOT NULL DEFAULT '{}',
    package_hash VARCHAR(64) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(problem_id, version)
);

-- Test Cases
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_version_id UUID NOT NULL REFERENCES problem_versions(id) ON DELETE CASCADE,
    group_name VARCHAR(100) NOT NULL DEFAULT 'default',
    ordinal INT NOT NULL,
    input_data TEXT NOT NULL,
    output_data TEXT NOT NULL,
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contests
CREATE TABLE IF NOT EXISTS contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    mode VARCHAR(50) NOT NULL DEFAULT 'fixed', -- 'fixed' or 'practice'
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    freeze_at TIMESTAMPTZ,
    scoring VARCHAR(50) NOT NULL DEFAULT 'icpc', -- 'icpc' or 'points'
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contest Problems
CREATE TABLE IF NOT EXISTS contest_problems (
    contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    problem_version_id UUID NOT NULL REFERENCES problem_versions(id) ON DELETE RESTRICT,
    label VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', ...
    points INT NOT NULL DEFAULT 100,
    PRIMARY KEY(contest_id, problem_version_id)
);

-- Participants
CREATE TABLE IF NOT EXISTS participants (
    contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(contest_id, user_id)
);

-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    problem_version_id UUID NOT NULL REFERENCES problem_versions(id) ON DELETE RESTRICT,
    contest_id UUID REFERENCES contests(id) ON DELETE SET NULL,
    language VARCHAR(50) NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    source TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    verdict VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    time_ms BIGINT NOT NULL DEFAULT 0,
    memory_kb BIGINT NOT NULL DEFAULT 0,
    instructions BIGINT NOT NULL DEFAULT 0,
    failed_test INT,
    failed_group VARCHAR(100),
    compile_output TEXT,
    complexity_report JSONB,
    judge_host VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    judged_at TIMESTAMPTZ
);

-- Submission Test Results
CREATE TABLE IF NOT EXISTS submission_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    test_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    ordinal INT NOT NULL,
    verdict VARCHAR(50) NOT NULL,
    time_ms BIGINT NOT NULL DEFAULT 0,
    memory_kb BIGINT NOT NULL DEFAULT 0,
    instructions BIGINT NOT NULL DEFAULT 0,
    diagnostic TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactional Outbox
CREATE TABLE IF NOT EXISTS outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- Rejudge Batches
CREATE TABLE IF NOT EXISTS rejudge_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope JSONB NOT NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    target VARCHAR(255) NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detail JSONB NOT NULL DEFAULT '{}'
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_contest_user ON submissions(contest_id, user_id, problem_version_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON submissions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published_at, created_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_test_cases_version ON test_cases(problem_version_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
