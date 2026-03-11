CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  owner_user_id INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(120),
  role VARCHAR(20) NOT NULL DEFAULT 'mozo',
  business_id INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS business_id INTEGER;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS username VARCHAR(40);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_name VARCHAR(120);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS address VARCHAR(220);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(25);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(25);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS pin_code VARCHAR(4);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS pin_code_hash TEXT;

UPDATE users
SET role = 'mozo'
WHERE role IS NULL;

ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'mozo';

ALTER TABLE users
ALTER COLUMN role SET NOT NULL;

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
DECLARE
  default_business_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE business_id IS NULL) THEN
    INSERT INTO businesses (slug, name)
    VALUES ('bar-principal', 'Bar Principal')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO default_business_id;

    IF default_business_id IS NULL THEN
      SELECT id INTO default_business_id
      FROM businesses
      WHERE slug = 'bar-principal'
      LIMIT 1;
    END IF;

    UPDATE users
    SET business_id = default_business_id
    WHERE business_id IS NULL;
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

ALTER TABLE users
ALTER COLUMN business_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_business_username_unique
  ON users (business_id, username)
  WHERE username IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_owner_user_id_fkey'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti UUID NOT NULL UNIQUE,
  family_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  revoke_reason VARCHAR(80) NULL,
  replaced_by_jti UUID NULL,
  created_by_ip VARCHAR(64) NULL,
  user_agent TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_jti ON refresh_tokens(token_jti);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 21 CHECK (tax_rate >= 0),
  rubro VARCHAR(80) NULL,
  subrubro VARCHAR(80) NULL,
  product_type VARCHAR(80) NULL,
  printer_targets TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  show_in_menu BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT NULL,
  image_data BYTEA NULL,
  image_mime_type VARCHAR(100) NULL
);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS business_id INTEGER;
ALTER TABLE products
ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);
ALTER TABLE products
ADD COLUMN IF NOT EXISTS rubro VARCHAR(80);
ALTER TABLE products
ADD COLUMN IF NOT EXISTS subrubro VARCHAR(80);
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_type VARCHAR(80);
ALTER TABLE products
ADD COLUMN IF NOT EXISTS printer_targets TEXT[];
ALTER TABLE products
ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN;
ALTER TABLE products
ADD COLUMN IF NOT EXISTS show_in_delivery BOOLEAN;
ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(100);

UPDATE products
SET tax_rate = 21
WHERE tax_rate IS NULL;

UPDATE products
SET printer_targets = ARRAY[]::TEXT[]
WHERE printer_targets IS NULL;
UPDATE products
SET show_in_menu = TRUE
WHERE show_in_menu IS NULL;
UPDATE products
SET show_in_delivery = TRUE
WHERE show_in_delivery IS NULL;

ALTER TABLE products
ALTER COLUMN tax_rate SET DEFAULT 21;
ALTER TABLE products
ALTER COLUMN tax_rate SET NOT NULL;
ALTER TABLE products
ALTER COLUMN printer_targets SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE products
ALTER COLUMN printer_targets SET NOT NULL;
ALTER TABLE products
ALTER COLUMN show_in_menu SET DEFAULT TRUE;
ALTER TABLE products
ALTER COLUMN show_in_menu SET NOT NULL;
ALTER TABLE products
ALTER COLUMN show_in_delivery SET DEFAULT TRUE;
ALTER TABLE products
ALTER COLUMN show_in_delivery SET NOT NULL;

DO $$
DECLARE
  default_business_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE business_id IS NULL) THEN
    SELECT id INTO default_business_id
    FROM businesses
    ORDER BY id ASC
    LIMIT 1;

    UPDATE products
    SET business_id = default_business_id
    WHERE business_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_business_id_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_image_storage_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_image_storage_check
      CHECK (
        (image_data IS NULL AND image_mime_type IS NULL)
        OR
        (image_data IS NOT NULL AND image_mime_type IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_image_size_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_image_size_check
      CHECK (image_data IS NULL OR octet_length(image_data) <= 3145728);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_image_mime_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_image_mime_check
      CHECK (
        image_mime_type IS NULL
        OR image_mime_type IN ('image/png', 'image/jpeg', 'image/webp')
      );
  END IF;
END $$;

ALTER TABLE products
ALTER COLUMN business_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_printer_targets_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_printer_targets_check
      CHECK (
        cardinality(printer_targets) <= 3
        AND printer_targets <@ ARRAY['comanda salon', 'comanda cocina', 'comanda barra']::TEXT[]
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS business_id INTEGER;

DO $$
DECLARE
  default_business_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE business_id IS NULL) THEN
    SELECT id INTO default_business_id
    FROM businesses
    ORDER BY id ASC
    LIMIT 1;

    UPDATE orders
    SET business_id = default_business_id
    WHERE business_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_business_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE orders
ALTER COLUMN business_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);

CREATE TABLE IF NOT EXISTS cash_closures (
  id BIGSERIAL PRIMARY KEY,
  business_id INTEGER NULL,
  closed_by_user_id INTEGER NOT NULL REFERENCES users(id),
  closed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  orders_count INTEGER NOT NULL,
  total_sales NUMERIC(10,2) NOT NULL
);

ALTER TABLE cash_closures
ADD COLUMN IF NOT EXISTS business_id INTEGER;

DO $$
DECLARE
  default_business_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM cash_closures WHERE business_id IS NULL) THEN
    SELECT id INTO default_business_id
    FROM businesses
    ORDER BY id ASC
    LIMIT 1;

    UPDATE cash_closures cc
    SET business_id = COALESCE(u.business_id, default_business_id)
    FROM users u
    WHERE cc.closed_by_user_id = u.id
      AND cc.business_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_closures_business_id_fkey'
  ) THEN
    ALTER TABLE cash_closures
      ADD CONSTRAINT cash_closures_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE cash_closures
ALTER COLUMN business_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cash_closures_business_id ON cash_closures(business_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  business_id INTEGER NULL,
  actor_user_id INTEGER REFERENCES users(id),
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS business_id INTEGER;

DO $$
DECLARE
  default_business_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE business_id IS NULL) THEN
    SELECT id INTO default_business_id
    FROM businesses
    ORDER BY id ASC
    LIMIT 1;

    UPDATE audit_logs al
    SET business_id = COALESCE(u.business_id, default_business_id)
    FROM users u
    WHERE al.actor_user_id = u.id
      AND al.business_id IS NULL;
  END IF;
END $$;

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

ALTER TABLE audit_logs
ALTER COLUMN business_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS user_clock_logs (
  id BIGSERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(10) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'dashboard',
  metadata JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
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
