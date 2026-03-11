# SQL layout (backend)

This folder is organized in the same modular style as `db/`:

- `schema/`: base table definitions and core constraints
- `migrations/`: incremental/idempotent upgrades
- `seed/`: optional dev seed data
- `run_all.sql`: migration orchestrator (recommended entry point)

Notes:

- `init.sql` is kept as a legacy monolithic script for backwards compatibility.
- Prefer running `run_all.sql` for new environments and future updates.
