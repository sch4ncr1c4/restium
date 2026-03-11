BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pin_code_hash TEXT;

UPDATE users
SET pin_code_hash = encode(digest(pin_code, 'sha256'), 'hex')
WHERE pin_code IS NOT NULL
  AND pin_code_hash IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pin_code_hash_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_pin_code_hash_check
      CHECK (pin_code_hash IS NULL OR pin_code_hash ~ '^[0-9a-f]{64}$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_clock_logs (
  id BIGSERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(10) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'dashboard',
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_clock_logs_event_type_check'
  ) THEN
    ALTER TABLE user_clock_logs
      ADD CONSTRAINT user_clock_logs_event_type_check
      CHECK (event_type IN ('in', 'out'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_clock_logs_business_user_created
  ON user_clock_logs (business_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_clock_logs_business_created
  ON user_clock_logs (business_id, created_at DESC);

COMMIT;
