# SubnetStudio

> **⚠️ Alpha Software — v0.0.2a**
>
> SubnetStudio is in early alpha. Bugs are likely. If you run into anything
> unexpected, please **[open an issue](https://github.com/shaneburns/SubnetStudio/issues)**
> — all feedback is welcome and appreciated.
>
> This project was developed with the assistance of AI — specifically
> **[Pi Coding Agent](https://github.com/earendil-works/pi)** — and reflects
> the kind of tooling that makes thoughtful, iterative AI-assisted development
> possible.

---

A visual-first IPv4 subnetting tool designed for learning and planning network
address spaces. Core subnet math and visualization remain deterministic and
browser-first.

Most of the app still runs fully client-side, but this branch also adds an
**optional automation backend** for TypeSafe-powered natural-language commands.
Nothing is sent off-device unless you explicitly use the automation feature.

**Live:** [subnetstudio.infispect.com](https://subnetstudio.infispect.com)
**Issues / Feedback:** [github.com/shaneburns/SubnetStudio/issues](https://github.com/shaneburns/SubnetStudio/issues)

---

## Features

- **Equal-Split mode** — divide any base network into equal-sized subnets with
  common-prefix shortcuts and a live block visualizer
- **VLSM mode** — auto-allocate the smallest fitting subnet per named segment;
  largest-first packing, overflow detection, single unallocated remainder block
- **Bit Ruler** — 32-bit visual breakdown with three-state VLSM colouring
  (base-fixed / borrowed / host) and click-to-set-prefix
- **Address Block Map** — proportional bar view (≤32 blocks) and compact tile
  grid (>32 blocks) with rich hover tooltips; paginated
- **Range Report** — searchable table with CIDR highlighting, CSV/JSON export
  with per-row selection; paginated at 25 rows
- **Themes** — Default (deep ocean blue), Light (slate & sun), Dark (void
  terminal); selection persisted to localStorage
- **BitNoise background** — Perlin-noise-driven animated bit grid that adapts
  to the active theme palette
- **PWA** — installable, works fully offline after first load
- **Automation command bar** — optional cloud-assisted natural-language command
  entry with confidence-scored previews before apply

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Custom CSS design tokens |
| PWA | `vite-plugin-pwa` |
| Tests | Vitest |
| Optional automation backend | Node.js + TypeScript companion service |
| Serving (prod) | nginx:alpine (via multi-stage Docker build) |
| Proxy / TLS | Caddy (automatic Let's Encrypt) |

---

## Local Development

### Prerequisites
- Node.js v18 or newer
- npm

### Install

```bash
git clone https://github.com/shaneburns/SubnetStudio.git
cd SubnetStudio
npm install
```

### Run the core app only

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Run the automation backend too

Copy the example env file and add your TypeSafe key:

```bash
cp .env.example .env.local
```

The backend automatically loads `.env` first and then `.env.local` (with `.env.local`
winning if both define the same variable).

Then either run both services together:

```bash
npm run dev:full
```

Or run them separately:

```bash
npm run backend:dev
npm run dev
```

The frontend uses `/api/automation/*` in development and Vite proxies that to the
local backend service.

### Production build

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built output locally
```

### Tests

```bash
npm test
npm run typecheck
```

---

## Automation Notes

- The automation feature is **optional**.
- Core subnetting continues to work without the backend.
- When you use the command bar, your prompt is sent to the local backend and,
  if configured, onward to the TypeSafe endpoint defined by `TYPESAFE_API_URL`.
- `TYPESAFE_API_KEY` is read **server-side only** and is never exposed to the
  React client.
- The current automation slice is intentionally narrow: mode changes, base CIDR
  updates, equal-split prefix changes (including requests such as “at least 5
  subnets”), and simple VLSM request upserts/batches.

## Project Structure

```
src/
├── config/           SubnetStudioConfig (version info, etc.)
├── components/
│   ├── Background/   BitNoise animated canvas
│   ├── Display/      BitRuler, BlockMap, QuickFacts, RangeReport
│   ├── Input/        CidrInput
│   ├── Layout/       Header
│   ├── Settings/     SettingsModal
│   ├── Shared/       CidrHighlight, CopyValue, Paginator
│   └── Vlsm/         VlsmRow
├── domain/           Pure TS — ipv4.ts, vlsm.ts (no React deps)
├── state/            useNetworkState, usePagination, useTheme
└── themes/           Theme definitions (CSS vars + BitNoise config)
```

---

