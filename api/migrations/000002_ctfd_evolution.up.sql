-- PostgreSQL Migration: 000002_ctfd_evolution.up.sql

-- 1. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    join_code VARCHAR(16) UNIQUE NOT NULL,
    captain_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(team_id, user_id)
);

-- 3. Contest Enhancements
ALTER TABLE contests 
    ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_team_contest BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS max_team_size INT NOT NULL DEFAULT 3;

-- 4. Score Adjustments Table (Manual Admin Point Awards & Penalties)
CREATE TABLE IF NOT EXISTS score_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points INT NOT NULL, -- positive for award, negative for penalty
    reason TEXT NOT NULL,
    adjusted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Dynamic Problem Scoring Fields
ALTER TABLE contest_problems 
    ADD COLUMN IF NOT EXISTS min_points INT NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS decay_rate INT NOT NULL DEFAULT 10;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_score_adjustments_contest ON score_adjustments(contest_id);
CREATE INDEX IF NOT EXISTS idx_score_adjustments_user ON score_adjustments(user_id);
