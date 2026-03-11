-- Tenant FK hardening: enforce same-business relations at DB level.
-- This prevents cross-business links even if application code has a bug.

BEGIN;

-- Preconditions for composite foreign keys.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_business_id_id_unique
  ON users (business_id, id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_business_closed_by
  ON cash_closures (business_id, closed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_actor_user
  ON audit_logs (business_id, actor_user_id);

-- ---------------------------------------------------------------------------
-- cash_closures -> users must match by (business_id, closed_by_user_id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cash_closures cc
    JOIN users u ON u.id = cc.closed_by_user_id
    WHERE u.business_id <> cc.business_id
  ) THEN
    RAISE EXCEPTION
      'cash_closures has rows linked to users from another business. Fix data before applying tenant FK hardening.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_closures_business_user_fkey'
  ) THEN
    ALTER TABLE cash_closures
      ADD CONSTRAINT cash_closures_business_user_fkey
      FOREIGN KEY (business_id, closed_by_user_id)
      REFERENCES users (business_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE cash_closures
  DROP CONSTRAINT IF EXISTS cash_closures_closed_by_user_id_fkey;

-- ---------------------------------------------------------------------------
-- audit_logs -> users must match by (business_id, actor_user_id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM audit_logs al
    JOIN users u ON u.id = al.actor_user_id
    WHERE al.actor_user_id IS NOT NULL
      AND u.business_id <> al.business_id
  ) THEN
    RAISE EXCEPTION
      'audit_logs has rows linked to users from another business. Fix data before applying tenant FK hardening.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_business_actor_user_fkey'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_business_actor_user_fkey
      FOREIGN KEY (business_id, actor_user_id)
      REFERENCES users (business_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;

-- ---------------------------------------------------------------------------
-- user_clock_logs -> users must match by (business_id, user_id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM user_clock_logs l
    JOIN users u ON u.id = l.user_id
    WHERE u.business_id <> l.business_id
  ) THEN
    RAISE EXCEPTION
      'user_clock_logs has rows linked to users from another business. Fix data before applying tenant FK hardening.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_clock_logs_business_user_fkey'
  ) THEN
    ALTER TABLE user_clock_logs
      ADD CONSTRAINT user_clock_logs_business_user_fkey
      FOREIGN KEY (business_id, user_id)
      REFERENCES users (business_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE user_clock_logs
  DROP CONSTRAINT IF EXISTS user_clock_logs_user_id_fkey;

COMMIT;
