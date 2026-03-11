CREATE TABLE IF NOT EXISTS cash_closures (
  id BIGSERIAL PRIMARY KEY,
  business_id INTEGER NULL,
  closed_by_user_id INTEGER NOT NULL REFERENCES users(id),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  orders_count INTEGER NOT NULL,
  total_sales NUMERIC(10,2) NOT NULL
);

ALTER TABLE cash_closures
  ADD COLUMN IF NOT EXISTS business_id INTEGER;

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

CREATE INDEX IF NOT EXISTS idx_cash_closures_business_id ON cash_closures(business_id);
