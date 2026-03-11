-- Production-hardening migration (multi-tenant safe)
-- Compatible evolution for existing schema.
-- Run this on the same database used by backend/.env (DB_NAME).

BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Preconditions and helper extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) users: data quality, normalization, PIN hash readiness
-- -----------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pin_code_hash TEXT;

-- Normalize existing emails to lowercase + trimmed.
UPDATE users
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

-- Normalize existing optional text fields (avoid only-space values).
UPDATE users
SET
  username = NULLIF(btrim(username), ''),
  name = NULLIF(btrim(name), ''),
  last_name = NULLIF(btrim(last_name), ''),
  address = NULLIF(btrim(address), ''),
  phone = NULLIF(btrim(phone), ''),
  emergency_phone = NULLIF(btrim(emergency_phone), ''),
  pin_code = NULLIF(btrim(pin_code), '');

-- Backfill pin hash from existing plain pin (transition step).
-- NOTE: Transitional hash (sha256) to avoid storing new plain text going forward.
UPDATE users
SET pin_code_hash = encode(digest(pin_code, 'sha256'), 'hex')
WHERE pin_code IS NOT NULL
  AND pin_code_hash IS NULL;

-- Enforce email quality.
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

-- Optional fields cannot be blank strings if present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_not_blank_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_username_not_blank_check
      CHECK (username IS NULL OR btrim(username) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_name_not_blank_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_name_not_blank_check
      CHECK (name IS NULL OR btrim(name) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_last_name_not_blank_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_last_name_not_blank_check
      CHECK (last_name IS NULL OR btrim(last_name) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_address_not_blank_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_address_not_blank_check
      CHECK (address IS NULL OR btrim(address) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_not_blank_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_phone_not_blank_check
      CHECK (phone IS NULL OR btrim(phone) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_emergency_phone_not_blank_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_emergency_phone_not_blank_check
      CHECK (emergency_phone IS NULL OR btrim(emergency_phone) <> '');
  END IF;
END $$;

-- PIN constraints: keep backward compatibility, but harden format + hash format.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pin_code_format_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_pin_code_format_check
      CHECK (pin_code IS NULL OR pin_code ~ '^[0-9]{4}$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pin_code_hash_format_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_pin_code_hash_format_check
      CHECK (pin_code_hash IS NULL OR pin_code_hash ~ '^[0-9a-f]{64}$');
  END IF;
END $$;

-- Username format constraint when present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_format_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_username_format_check
      CHECK (
        username IS NULL
        OR username ~ '^[a-zA-Z0-9._-]{3,40}$'
      );
  END IF;
END $$;

-- Stronger uniqueness / lookup indexes.
CREATE INDEX IF NOT EXISTS idx_users_business_role ON users (business_id, role);
CREATE INDEX IF NOT EXISTS idx_users_business_created_at ON users (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_business_email_lower ON users (business_id, lower(email));

-- Enforce case-insensitive unique email only when safe.
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
      RAISE NOTICE 'Skipped users_email_lower_unique due to duplicated emails (case-insensitive).';
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) TIMESTAMPTZ hardening (keep NOW() defaults)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE businesses
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE users
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE products
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE orders
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refresh_tokens' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE refresh_tokens
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refresh_tokens' AND column_name = 'expires_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE refresh_tokens
      ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refresh_tokens' AND column_name = 'revoked_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE refresh_tokens
      ALTER COLUMN revoked_at TYPE TIMESTAMPTZ USING revoked_at AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_closures' AND column_name = 'closed_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE cash_closures
      ALTER COLUMN closed_at TYPE TIMESTAMPTZ USING closed_at AT TIME ZONE 'UTC',
      ALTER COLUMN closed_at SET DEFAULT NOW();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE audit_logs
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) products: stronger quality constraints + safer uniqueness
-- -----------------------------------------------------------------------------
UPDATE products
SET
  name = btrim(name),
  description = NULLIF(btrim(description), ''),
  rubro = NULLIF(btrim(rubro), ''),
  subrubro = NULLIF(btrim(subrubro), ''),
  product_type = NULLIF(btrim(product_type), '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_name_not_blank_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_name_not_blank_check
      CHECK (btrim(name) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_tax_rate_range_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_tax_rate_range_check
      CHECK (tax_rate >= 0 AND tax_rate <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_rubro_not_blank_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_rubro_not_blank_check
      CHECK (rubro IS NULL OR btrim(rubro) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_subrubro_not_blank_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_subrubro_not_blank_check
      CHECK (subrubro IS NULL OR btrim(subrubro) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_type_not_blank_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_type_not_blank_check
      CHECK (product_type IS NULL OR btrim(product_type) <> '');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_business_name_lower
  ON products (business_id, lower(name));

-- Create strict unique name-per-business only when current data allows it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'products_business_name_unique_nocase'
  ) THEN
    IF NOT EXISTS (
      SELECT business_id, lower(btrim(name))
      FROM products
      GROUP BY business_id, lower(btrim(name))
      HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX products_business_name_unique_nocase
        ON products (business_id, lower(btrim(name)));
    ELSE
      RAISE NOTICE 'Skipped products_business_name_unique_nocase due to existing duplicates.';
    END IF;
  END IF;
END $$;

-- Keep printer_targets array for compatibility, but add normalized table for future use.
CREATE TABLE IF NOT EXISTS product_printer_targets (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  target VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, target),
  CONSTRAINT product_printer_targets_target_check
    CHECK (target IN ('comanda salon', 'comanda cocina', 'comanda barra'))
);

CREATE INDEX IF NOT EXISTS idx_product_printer_targets_business_target
  ON product_printer_targets (business_id, target);

INSERT INTO product_printer_targets (product_id, business_id, target)
SELECT p.id, p.business_id, t.target
FROM products p
JOIN LATERAL unnest(p.printer_targets) AS t(target) ON TRUE
WHERE t.target IN ('comanda salon', 'comanda cocina', 'comanda barra')
ON CONFLICT (product_id, target) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4) orders: operational fields + constraints
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS waiter_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS table_number INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'salon',
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ NULL;

UPDATE orders
SET notes = NULLIF(btrim(notes), '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_table_number_positive_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_table_number_positive_check
      CHECK (table_number IS NULL OR table_number > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_notes_not_blank_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_notes_not_blank_check
      CHECK (notes IS NULL OR btrim(notes) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded', 'void'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_type_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_order_type_check
      CHECK (order_type IN ('salon', 'takeaway', 'delivery'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_not_blank_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_status_not_blank_check
      CHECK (btrim(status) <> '');
  END IF;
END $$;

-- Composite uniqueness to support tenant-safe FKs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_business_id_id_unique ON users (business_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_id_id_unique ON products (business_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_business_id_id_unique ON orders (business_id, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_created_by_user_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_created_by_user_fkey
      FOREIGN KEY (business_id, created_by_user_id)
      REFERENCES users (business_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_waiter_user_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_waiter_user_fkey
      FOREIGN KEY (business_id, waiter_user_id)
      REFERENCES users (business_id, id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_business_status_created_at
  ON orders (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_business_payment_status
  ON orders (business_id, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_business_order_type
  ON orders (business_id, order_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_business_waiter
  ON orders (business_id, waiter_user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 5) order_items: normalized line-items for real POS flow
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL,
  product_id INTEGER NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  product_name_snapshot VARCHAR(160) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_items_quantity_positive_check CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_non_negative_check CHECK (unit_price >= 0),
  CONSTRAINT order_items_subtotal_non_negative_check CHECK (subtotal >= 0),
  CONSTRAINT order_items_subtotal_math_check CHECK (subtotal = round(quantity * unit_price, 2)),
  CONSTRAINT order_items_product_name_not_blank_check CHECK (btrim(product_name_snapshot) <> ''),
  CONSTRAINT order_items_notes_not_blank_check CHECK (notes IS NULL OR btrim(notes) <> '')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_fkey'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_order_fkey
      FOREIGN KEY (business_id, order_id)
      REFERENCES orders (business_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_fkey'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_product_fkey
      FOREIGN KEY (business_id, product_id)
      REFERENCES products (business_id, id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_business_order
  ON order_items (business_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_business_product
  ON order_items (business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_business_created_at
  ON order_items (business_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6) audit_logs hardening (keep JSONB flexibility)
-- -----------------------------------------------------------------------------
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS severity VARCHAR(12) NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS source VARCHAR(80) NULL;

UPDATE audit_logs
SET source = NULLIF(btrim(source), '');

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_entity_created
  ON audit_logs (business_id, entity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_action_created
  ON audit_logs (business_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin
  ON audit_logs USING GIN (metadata);

-- -----------------------------------------------------------------------------
-- 7) businesses/users circular-reference hardening
-- -----------------------------------------------------------------------------
-- Keep owner_user_id nullable (bootstrap-friendly), and make FK deferrable
-- so both records can be created in one transaction in any order.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'businesses_owner_user_id_fkey'
      AND condeferrable = false
  ) THEN
    ALTER TABLE businesses
      ALTER CONSTRAINT businesses_owner_user_id_fkey
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

COMMIT;
