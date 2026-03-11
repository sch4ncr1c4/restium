\echo === Running migration 003_orders_upgrade.sql ===

BEGIN;

-- Orders operational upgrades (idempotent).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS waiter_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS table_number INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS order_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

UPDATE orders SET payment_status = 'pending' WHERE payment_status IS NULL;
UPDATE orders SET order_type = 'salon' WHERE order_type IS NULL;
UPDATE orders SET opened_at = COALESCE(opened_at, created_at, NOW()) WHERE opened_at IS NULL;

ALTER TABLE orders
  ALTER COLUMN payment_status SET DEFAULT 'pending',
  ALTER COLUMN payment_status SET NOT NULL,
  ALTER COLUMN order_type SET DEFAULT 'salon',
  ALTER COLUMN order_type SET NOT NULL,
  ALTER COLUMN opened_at SET DEFAULT NOW(),
  ALTER COLUMN opened_at SET NOT NULL;

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

-- Ensure order_items exists with expected business-aware FKs.
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep attendance table present.
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

COMMIT;
