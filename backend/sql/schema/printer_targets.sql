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
