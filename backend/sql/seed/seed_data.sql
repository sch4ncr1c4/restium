\echo === Running seed_data.sql ===

-- Safe baseline seed (idempotent).
INSERT INTO businesses (slug, name)
VALUES ('bar-principal', 'Bar Principal')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;
