# SubnetStudio

> **⚠️ Alpha Software — v0.0.1a**
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
address spaces. Built as a fully client-side PWA — nothing is sent or stored,
everything runs in the browser.

**Live:** [subnetstudio.infispect.com](https://subnetstudio.infispect.com)
**Issues / Feedback:** [github.com/shaneburns/SubnetStudio/issues](https://github.com/shaneburns/SubnetStudio/issues)

---

## Features

- **Equal-Split mode** — divide any base network into equal-sized subnets with
  common-prefix shortcuts and a live block visualizer
- **VLSM mode** — auto-allocate the smallest fitting subnet per named segment;
  drag-to-reorder, overflow detection, single unallocated remainder block
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

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Custom CSS design tokens |
| PWA | `vite-plugin-pwa` |
| Tests | Vitest |
| Serving (prod) | nginx:alpine (via multi-stage Docker build) |
| Proxy / TLS | Caddy (automatic Let's Encrypt) |

---

## Local Development

### Prerequisites
- Node.js v18 or newer
- npm

### Install & run

```bash
git clone https://github.com/shaneburns/SubnetStudio.git
cd SubnetStudio
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Production build

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built output locally
```

### Tests

```bash
npm test
```

---

## Project Structure

```
src/
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

## Deployment

SubnetStudio is deployed as part of the
[internal-ops-deploy](https://github.com/shaneburns/internal-ops-deploy) stack.
The production Docker image is a two-stage build: Node 22 compiles the Vite
project, then nginx:alpine serves the static output.

To deploy an update once the droplet is configured:

```bash
cd ~/sites/internal-ops-deploy
./scripts/deploy.sh subnetstudio
```

---

## Version History

| Version | Notes |
|---|---|
| `v0.0.1a` | Initial alpha release |
