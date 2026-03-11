\echo === Running migration 20260310_product_images_in_db.sql ===

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_data BYTEA,
  ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(100);

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

COMMIT;
