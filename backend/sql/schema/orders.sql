CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  created_by_user_id INTEGER NULL,
  waiter_user_id INTEGER NULL,
  table_number INTEGER NULL,
  notes TEXT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  order_type VARCHAR(20) NOT NULL DEFAULT 'salon',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS business_id INTEGER,
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS waiter_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS table_number INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS order_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE orders SET payment_status = 'pending' WHERE payment_status IS NULL;
UPDATE orders SET order_type = 'salon' WHERE order_type IS NULL;
UPDATE orders SET opened_at = COALESCE(opened_at, created_at, NOW()) WHERE opened_at IS NULL;
UPDATE orders SET created_at = COALESCE(created_at, NOW()) WHERE created_at IS NULL;

ALTER TABLE orders
  ALTER COLUMN payment_status SET DEFAULT 'pending',
  ALTER COLUMN payment_status SET NOT NULL,
  ALTER COLUMN order_type SET DEFAULT 'salon',
  ALTER COLUMN order_type SET NOT NULL,
  ALTER COLUMN opened_at SET DEFAULT NOW(),
  ALTER COLUMN opened_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

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
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_table_number_positive_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_table_number_positive_check
      CHECK (table_number IS NULL OR table_number > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_business_id_id_unique ON orders (business_id, id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);

-- Attendance log (existing functional table kept as part of order operations context)
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
