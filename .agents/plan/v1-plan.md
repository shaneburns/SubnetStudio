# Subnet Studio — Project Plan

Status: pre-build planning. This document is the source of truth for scope, architecture,
and data model before any framework code is written. Update it as decisions change —
it should always reflect what's actually being built, not just what was originally proposed.

---

## 1. Goals

A visual-first subnetting tool for learning and planning IPv4 networks. Standalone PWA,
installable, no backend, nothing leaves the browser. The bit ruler and address block map
are the product — the math is in service of the diagram, not the other way around.

## 2. Scope fence

Explicit, so feature creep has to be a conscious decision, not a drift.

### v1 — building now
- Single CIDR input → live-derived facts, bit ruler, range report
- Equal-split block map (`/N` divide, current mockup behavior)
- VLSM allocation list (named requirements → auto-packed subnets)
- Bit ruler: bit-value labels, "interesting octet" badge, network/host bit counts, real bit values
- Quick Facts: math equations shown alongside derived values
- Proportional (treemap) block map for unequal-size allocations
- PWA install (manifest + service worker, offline-capable)

### v2 / deferred — written down so they're not forgotten, not so they get built now
- IPv6 support (128-bit model, no broadcast/usable-host semantics — different domain module, not a toggle)
- Recursive VLSM (splitting an already-allocated block further)
- Manual drag/click-to-resize on individual VLSM allocations (vs. auto-derived only)
- Shareable/URL-encoded state
- Export (CSV/PDF of range report)
- Supernetting (combining adjacent blocks upward)

---

## 3. Architecture

### Stack
- **Vite + React + TypeScript**
- **vite-plugin-pwa** for manifest + service worker (offline-first; this app needs zero
  network at runtime, so cache-everything-on-install is the right strategy)
- No backend, no external API calls, no analytics by default

### Layering — domain logic is framework-free
```
src/
  domain/
    ipv4.ts        // pure functions: parseCIDR, subnetInfo, mask math, splitEqual
    vlsm.ts         // pure functions: allocate(requirements, baseBlock) -> Allocation[]
    ipv4.test.ts
    vlsm.test.ts
  state/
    useNetworkState.ts   // single source of truth, everything else derived
  components/
    InputPanel/
    QuickFacts/
    BitRuler/
    BlockMap/
    RangeReport/
    VlsmEditor/          // the requirement list: add/remove/reorder rows
  App.tsx
```

Rule: components never compute subnet math themselves. They consume derived state.
If a component needs `2^hostBits - 2`, that number was computed in `domain/`, not in JSX.
This is what makes the VLSM rework (and IPv6, later) additive rather than a rewrite —
the visual layer doesn't know how the numbers were derived, only how to draw them.

### State shape

```ts
type BaseNetwork = {
  ip: string;
  prefix: number; // the user's starting block, e.g. 10.0.0.0/22
};

type AllocationRequest = {
  id: string;
  name: string;            // "Sales LAN"
  hostsNeeded: number;
  order: number;            // manual ordering if not auto-sorted
};

type Allocation = {
  id: string;               // ties back to AllocationRequest
  name: string;
  requestedHosts: number;
  derivedPrefix: number;
  network: string;
  broadcast: string;
  first: string;
  last: string;
  usable: number;
  status: 'allocated' | 'conflict' | 'overflow';
};

type NetworkState = {
  base: BaseNetwork;
  mode: 'equal-split' | 'vlsm';
  equalSplitPrefix: number | null;      // existing dropdown behavior
  vlsmRequests: AllocationRequest[];     // editable list, user input
  selectedAllocationId: string | null;   // drives BitRuler + QuickFacts, like today
};
```

Everything else — allocations array, unallocated remainder, bit ruler highlight state,
quick-facts equations — is **derived from this**, recomputed on render, never stored
redundantly. This is the rule that kept the mockup's diagram and table from disagreeing,
and it matters more once VLSM adds a second computation path.

### `domain/vlsm.ts` — allocation algorithm
1. Sort `vlsmRequests` by `hostsNeeded` descending (largest-first-fit), unless the user
   has opted into manual ordering (open question, see §6).
2. For each request, compute minimal prefix: smallest block where usable hosts ≥
   requested. Special-case `/31` (2 addresses, 0 "usable" in the classic sense — used for
   point-to-point links) and `/32` (single host) explicitly; don't let the general
   `2^n - 2` formula silently mishandle them.
3. Walk the base block's address space, placing each sorted request at the next aligned
   boundary that fits. If it doesn't fit before the base block's range runs out, mark
   `status: 'overflow'` and continue (don't hard-block — see open questions).
4. Return the full `Allocation[]`, plus a separately-computed "unallocated remainder"
   block (or blocks) representing leftover space — this is a first-class value, not an
   implied gap in the UI.

---

## 4. Feature specs

### 4.1 Bit Ruler
- Each bit cell gets its positional value (128/64/32/16/8/4/2/1) printed beneath it,
  rotated, scoped per-octet (resets each octet, not a running 32-bit value).
- Octet labels get an "interesting octet" badge — the octet containing the network/host
  boundary, classic subnetting-cheat-sheet terminology.
- Bit values render from the actual parsed IP address (already correct) — but add a
  visual treatment for all-zero host bits so it doesn't read as a bug (see clarification
  above). Candidate: dim/placeholder style on host bits when the address's host portion
  is all zero, with a tooltip ("host bits — enter a non-network address to see real values").
- Legend gains live counts: "8 network bits · 24 host bits" next to the color key.
- **VLSM mode**: ruler binds to `selectedAllocationId` instead of the base prefix. Needs a
  third visual state — bits fixed by the base block (not editable, set by §3 `BaseNetwork`),
  bits borrowed for the selected allocation, remaining host bits for that allocation.
  Stays read-only in v1 (reflects the auto-derived prefix); manual per-row resize is v2.

### 4.2 Quick Facts
- Drop Network / Broadcast / First / Last (redundant with Range Report).
- Add the equations behind each remaining value, e.g.:
  - Usable Hosts = `2^(host bits) - 2`
  - Total Addresses = `2^(total bits)`
  - Total Networks (when split/VLSM active) = `2^(borrowed bits)`
  - Increment / Block Size = `2^(host bits)`
- These should read straight from the same derived numbers the ruler highlights —
  no separate calculation path.

### 4.3 VLSM Editor (new component)
- Editable list: name, hosts-needed per row. Add / remove / reorder.
- Visible "auto-sorted by size" indicator — the reordering from user input to packed
  order should be visible, not silent, since that's a teaching moment.
- Each row shows derived prefix and status inline (allocated / conflict / overflow).

### 4.4 Block Map
- Equal-split mode: keep existing equal-width behavior.
- VLSM mode: proportional (treemap-style) widths by address count — equal-width blocks
  would misrepresent unequal allocations.
- Block labels show requirement name first, CIDR second.
- Unallocated remainder renders as its own (visually distinct, e.g. hatched/muted) block.

### 4.5 Range Report
- Add a `Name` column when in VLSM mode.
- Add a `Status` column (allocated / conflict / overflow) with the same color cues as
  the block map, so the two views stay legible as one system rather than two designs.

---

## 5. Styling

- Keep the existing CSS custom-property token system as the foundation rather than
  adopting Bulma wholesale — a full framework's defaults (rounded corners, its own
  spacing/color scale) will erode the blueprint/mono identity unless heavily overridden,
  at which point the framework is providing little. If grid/column layout primitives are
  the actual draw, consider importing only Bulma's layout utilities, not its component
  styling.
- Replace the grid background with a lower-contrast topographic-line treatment, or drop
  to a flat panel color and use shadow/elevation for depth — current grid is too high
  contrast against content.
- Add a `status` color (conflict/overflow) to the token set now, since VLSM introduces
  the first error/warning states the UI has needed.

## 6. Open questions — decide before building, not during

1. **Sort enforcement**: should VLSM allocation always auto-sort largest-first, or can
   users manually order requests and see the fragmentation cost of a suboptimal order?
   (Latter is more work, better teaching tool.)
2. **Overflow handling**: allow requests that exceed remaining capacity and flag them
   (current lean), or hard-block adding a request that doesn't fit?
3. **Ruler editability in VLSM mode**: read-only (auto-derived) for v1, or build manual
   per-allocation resize now? Leaning v1 = read-only, v2 = editable with an explicit
   "manually overridden" marker.

## 7. PWA checklist
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`
- Manifest: icons (multiple sizes), `theme_color` matching `--bg`, `display: 'standalone'`
- Cache strategy: precache everything on install (app has no runtime network dependency)
- Manual test on iOS Safari "Add to Home Screen" early — historically the flakiest target

## 8. Testing
- Unit tests on `domain/ipv4.ts` and `domain/vlsm.ts` — this is where correctness lives.
  Cover `/31`, `/32`, `/0`, invalid input, overflow allocation, alignment edge cases.
- A small set of snapshot tests on known inputs (e.g. `192.168.1.0/24` → exact expected
  facts) to catch regressions as components change.

## 9. Suggested build order
1. `domain/ipv4.ts` + tests (port from mockup, already proven logic)
2. State shape + `useNetworkState` hook
3. Static component shells consuming mock derived data
4. Wire equal-split mode end to end (parity with current mockup)
5. `domain/vlsm.ts` + tests
6. VLSM Editor + proportional Block Map + Range Report status column
7. Bit Ruler enhancements (bit values, badge, counts, third visual state)
8. Quick Facts equations
9. Styling pass (tokens, topographic background, status colors)
10. PWA wiring + install testing
