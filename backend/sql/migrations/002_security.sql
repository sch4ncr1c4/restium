\echo === Running migration 002_security.sql ===

BEGIN;

-- Normalize user emails and text fields.
UPDATE users
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

UPDATE users
SET
  username = NULLIF(btrim(username), ''),
  name = NULLIF(btrim(name), ''),
  last_name = NULLIF(btrim(last_name), ''),
  address = NULLIF(btrim(address), ''),
  phone = NULLIF(btrim(phone), ''),
  emergency_phone = NULLIF(btrim(emergency_phone), ''),
  pin_code = NULLIF(btrim(pin_code), '');

-- Backfill hash from existing plain PIN.
UPDATE users
SET pin_code_hash = encode(digest(pin_code, 'sha256'), 'hex')
WHERE pin_code IS NOT NULL
  AND pin_code_hash IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_not_blank_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_not_blank_check
      CHECK (btrim(email) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_lowercase_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_lowercase_check
      CHECK (email = lower(email));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_format_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_username_format_check
      CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9._-]{3,40}$');
  END IF;
END $$;

-- Create unique case-insensitive email index only when safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_email_lower_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT lower(email)
      FROM users
      GROUP BY lower(email)
      HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
    ELSE
      RAISE NOTICE 'Skipped users_email_lower_unique due to duplicates.';
    END IF;
  END IF;
END $$;

COMMIT;
