-- JOBLESS EMPIRE: CANONICAL TIMELINE DATABASE SCHEMA (PostgreSQL)

CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(64) PRIMARY KEY,
  jemp_id VARCHAR(32) UNIQUE NOT NULL,
  discord_user_id VARCHAR(32) UNIQUE NOT NULL,
  handle VARCHAR(100) NOT NULL,
  status VARCHAR(32) DEFAULT 'ACTIVE',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) UNIQUE NOT NULL,
  member_id VARCHAR(64) NOT NULL,
  jemp_id VARCHAR(32) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  authority VARCHAR(32) DEFAULT 'OFFICIAL',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  source_system VARCHAR(64) NOT NULL,
  source_event_id VARCHAR(128) NOT NULL,
  source_entity_type VARCHAR(64),
  source_entity_id VARCHAR(64),
  source_entity_name VARCHAR(255),
  project_id VARCHAR(64),
  project_name VARCHAR(255),
  brainstorm_id VARCHAR(64),
  brainstorm_name VARCHAR(255),
  opportunity_id VARCHAR(64),
  opportunity_name VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  visibility VARCHAR(32) DEFAULT 'MEMBER_VISIBLE',
  immutable BOOLEAN DEFAULT TRUE,
  corrected_by_event_id VARCHAR(64),
  correction_reason TEXT,
  created_by VARCHAR(64) DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_source_system_event UNIQUE (source_system, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_tle_member_id ON timeline_events(member_id);
CREATE INDEX IF NOT EXISTS idx_tle_jemp_id ON timeline_events(jemp_id);
CREATE INDEX IF NOT EXISTS idx_tle_occurred_at ON timeline_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tle_event_type ON timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tle_source_system ON timeline_events(source_system);
CREATE INDEX IF NOT EXISTS idx_tle_project_id ON timeline_events(project_id);
CREATE INDEX IF NOT EXISTS idx_tle_brainstorm_id ON timeline_events(brainstorm_id);
CREATE INDEX IF NOT EXISTS idx_tle_opportunity_id ON timeline_events(opportunity_id);

CREATE TABLE IF NOT EXISTS timeline_shares (
  id VARCHAR(64) PRIMARY KEY,
  share_id VARCHAR(64) UNIQUE NOT NULL,
  member_id VARCHAR(64) NOT NULL,
  jemp_id VARCHAR(32) NOT NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by VARCHAR(64) NOT NULL,
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shares_token_hash ON timeline_shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_shares_jemp_id ON timeline_shares(jemp_id);

CREATE TABLE IF NOT EXISTS timeline_exports (
  id VARCHAR(64) PRIMARY KEY,
  export_id VARCHAR(64) UNIQUE NOT NULL,
  member_id VARCHAR(64) NOT NULL,
  jemp_id VARCHAR(32) NOT NULL,
  format VARCHAR(32) NOT NULL,
  scope VARCHAR(32) NOT NULL,
  filter_val VARCHAR(128),
  event_count INT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_audit_log (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action VARCHAR(64) NOT NULL,
  actor VARCHAR(64) NOT NULL,
  source_system VARCHAR(64) NOT NULL,
  jemp_id VARCHAR(32),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON timeline_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_jemp_id ON timeline_audit_log(jemp_id);
