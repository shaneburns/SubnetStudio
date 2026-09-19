# Automation backend (scaffold)

This branch adds a minimal companion service for SubnetStudio automation routes.
It keeps TypeSafe credentials off the client and provides a stable `/api/automation/*`
endpoint surface that the Vite app can call during development.

## Local development

1. Copy `.env.example` to `.env.local` or export the variables in your shell.
   The backend loads `.env` first and then `.env.local`, so local overrides work
   without putting secrets in git.
2. Start the backend:

   ```bash
   npm run backend:dev
   ```

3. In a second terminal, start the frontend:

   ```bash
   npm run dev
   ```

   Or run both together:

   ```bash
   npm run dev:full
   ```

## Routes

- `GET /api/automation/health` — returns backend/provider readiness
- `POST /api/automation/interpret` — validates the request, calls TypeSafe when configured, and returns a deterministic execution plan

## Notes

- `TYPESAFE_API_KEY` is read only on the backend.
- `TYPESAFE_API_URL` defaults to the public TypeSafe endpoint and can later point at an internal router.
- Vite proxies `/api/automation/*` to the backend in dev.
- The current command slice is intentionally narrow: mode changes, base CIDR updates, equal-split prefix updates, and simple VLSM request upserts/batches.
