# Automation backend (scaffold)

This branch adds a minimal companion service for SubnetStudio automation routes.
It keeps TypeSafe credentials off the client and provides a stable `/api/automation/*`
endpoint surface that the Vite app can call during development.

## Local development

1. Copy `.env.example` to `.env.local` or export the variables in your shell.
   The backend loads `.env` first and then `.env.local`, so local overrides work
   without putting secrets in git. It binds to `127.0.0.1` by default and only
   allows direct browser origins from the local Vite dev server unless you set
   `AUTOMATION_SERVER_HOST` and `AUTOMATION_ALLOWED_ORIGINS`. Leave `NODE_ENV`
   unset (or set it to `development`) for verbose client-facing diagnostics; use
   `NODE_ENV=production` to redact provider/config details from responses.
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
- `AUTOMATION_SERVER_HOST` defaults to `127.0.0.1`.
- `AUTOMATION_ALLOWED_ORIGINS` defaults to `http://localhost:5173,http://127.0.0.1:5173`.
- In development, client responses include verbose error/config details; in production, those details are redacted and kept in server logs.
- Vite proxies `/api/automation/*` to the backend in dev.
- The current command slice is intentionally narrow: mode changes, base CIDR updates, equal-split prefix updates, and simple VLSM request upserts/batches.
