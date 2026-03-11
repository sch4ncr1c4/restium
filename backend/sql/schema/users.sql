CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  username VARCHAR(40),
  name VARCHAR(120),
  last_name VARCHAR(120),
  address VARCHAR(220),
  phone VARCHAR(25),
  emergency_phone VARCHAR(25),
  pin_code VARCHAR(4),
  pin_code_hash TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'mozo',
  business_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(40),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS address VARCHAR(220),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(25),
  ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(25),
  ADD COLUMN IF NOT EXISTS pin_code VARCHAR(4),
  ADD COLUMN IF NOT EXISTS pin_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS role VARCHAR(20),
  ADD COLUMN IF NOT EXISTS business_id INTEGER;

UPDATE users SET role = 'mozo' WHERE role IS NULL;

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'mozo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'gerente', 'cajero', 'mozo', 'cocina'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pin_code_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_pin_code_check
      CHECK (pin_code IS NULL OR pin_code ~ '^[0-9]{4}$');
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_business_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_owner_user_id_fkey'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_business_username_unique
  ON users (business_id, username)
  WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_business_id_id_unique
  ON users (business_id, id);
