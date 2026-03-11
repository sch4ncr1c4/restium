CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  owner_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_slug_not_blank_check'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_slug_not_blank_check
      CHECK (btrim(slug) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_name_not_blank_check'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_name_not_blank_check
      CHECK (btrim(name) <> '');
  END IF;
END $$;
