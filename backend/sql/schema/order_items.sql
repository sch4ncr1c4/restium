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
