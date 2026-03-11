\echo === Running backend/sql migrations (modular) ===

\ir migrations/001_init.sql
\ir migrations/002_security.sql
\ir migrations/003_orders_upgrade.sql
\ir migrations/004_indexes.sql
\ir migrations/20260310_user_clock_logs.sql
\ir migrations/20260310_product_images_in_db.sql
\ir migrations/20260310_schema_hardening.sql
\ir migrations/20260310_tenant_fk_hardening.sql

-- Optional local/dev data:
-- \ir seed/seed_data.sql

\echo === backend/sql migrations completed ===
