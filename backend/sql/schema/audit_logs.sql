CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  business_id INTEGER NULL,
  actor_user_id INTEGER REFERENCES users(id),
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  metadata JSONB NULL,
  severity VARCHAR(12) NOT NULL DEFAULT 'info',
  source VARCHAR(80) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS business_id INTEGER,
  ADD COLUMN IF NOT EXISTS severity VARCHAR(12),
  ADD COLUMN IF NOT EXISTS source VARCHAR(80);

UPDATE audit_logs SET severity = 'info' WHERE severity IS NULL;

ALTER TABLE audit_logs
  ALTER COLUMN severity SET DEFAULT 'info',
  ALTER COLUMN severity SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_business_id_fkey'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_action_not_blank_check'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_action_not_blank_check
      CHECK (btrim(action) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_entity_not_blank_check'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_entity_not_blank_check
      CHECK (btrim(entity) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_severity_check'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_severity_check
      CHECK (severity IN ('debug', 'info', 'warn', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
