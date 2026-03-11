\echo === Running migration 004_indexes.sql ===

BEGIN;

CREATE INDEX IF NOT EXISTS idx_users_business_role ON users (business_id, role);
CREATE INDEX IF NOT EXISTS idx_users_business_created_at ON users (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_business_email_lower ON users (business_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_products_business_name_lower ON products (business_id, lower(name));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'products_business_name_unique_nocase'
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
      RAISE NOTICE 'Skipped products_business_name_unique_nocase due to duplicates.';
    END IF;
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

CREATE INDEX IF NOT EXISTS idx_order_items_business_created_at
  ON order_items (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_printer_targets_business_target
  ON product_printer_targets (business_id, target);

CREATE INDEX IF NOT EXISTS idx_user_clock_logs_business_user_created
  ON user_clock_logs (business_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_clock_logs_business_created
  ON user_clock_logs (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_entity_created
  ON audit_logs (business_id, entity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_action_created
  ON audit_logs (business_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin
  ON audit_logs USING GIN (metadata);

COMMIT;
