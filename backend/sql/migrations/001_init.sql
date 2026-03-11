\echo === Running migration 001_init.sql ===

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

\ir ../schema/businesses.sql
\ir ../schema/users.sql
\ir ../schema/products.sql
\ir ../schema/orders.sql
\ir ../schema/order_items.sql
\ir ../schema/refresh_tokens.sql
\ir ../schema/cash_closures.sql
\ir ../schema/audit_logs.sql
\ir ../schema/printer_targets.sql

COMMIT;
