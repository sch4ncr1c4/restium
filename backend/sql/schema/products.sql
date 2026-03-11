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
  image_mime_type VARCHAR(100) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS business_id INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS rubro VARCHAR(80),
  ADD COLUMN IF NOT EXISTS subrubro VARCHAR(80),
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS printer_targets TEXT[],
  ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN,
  ADD COLUMN IF NOT EXISTS show_in_delivery BOOLEAN,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_data BYTEA,
  ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE products SET tax_rate = 21 WHERE tax_rate IS NULL;
UPDATE products SET printer_targets = ARRAY[]::TEXT[] WHERE printer_targets IS NULL;
UPDATE products SET show_in_menu = TRUE WHERE show_in_menu IS NULL;
UPDATE products SET show_in_delivery = TRUE WHERE show_in_delivery IS NULL;
UPDATE products SET created_at = NOW() WHERE created_at IS NULL;

ALTER TABLE products
  ALTER COLUMN tax_rate SET DEFAULT 21,
  ALTER COLUMN tax_rate SET NOT NULL,
  ALTER COLUMN printer_targets SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN printer_targets SET NOT NULL,
  ALTER COLUMN show_in_menu SET DEFAULT TRUE,
  ALTER COLUMN show_in_menu SET NOT NULL,
  ALTER COLUMN show_in_delivery SET DEFAULT TRUE,
  ALTER COLUMN show_in_delivery SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_id_id_unique ON products (business_id, id);
