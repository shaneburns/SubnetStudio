# Discovery — SubnetStudio
> Completed: 2026-09-19T00:30:03Z
> Auditor: adlc-discover

## 1. Project Overview
SubnetStudio is a visual-first IPv4 subnetting tool for learning and planning address space. It is a React + TypeScript single-page PWA that runs entirely in the browser and currently supports equal-split subnetting, VLSM allocation, visual bit inspection, export of VLSM reports, theming, and offline installation. The product is positioned as both an educational subnetting aid and a practical planning utility.

The codebase is compact and understandable, with pure subnet/domain logic separated from React UI code. The requested TypeSafe-driven automation feature would fit best as an optional, bounded automation layer on top of the existing deterministic math engine rather than as a replacement for any current calculation logic.

## 2. Tech Stack
| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | React | 19.2.7 | Client-rendered SPA |
| Language | TypeScript | 6.0.3 | `strict: true` in `tsconfig.json`, but build does not enforce type-checking |
| Build Tool | Vite | 8.0.16 | Fast dev/build pipeline |
| PWA | `vite-plugin-pwa` | 1.3.0 | Generates service worker during build |
| Testing | Vitest | 4.1.9 | Only one current test file |
| Styling | Custom CSS tokens | n/a | Single large `src/index.css` |
| Optional UI pkg | Bulma | 1.0.4 | Installed but not actively used |
| Container build | Docker + nginx | nginx 1.27 alpine | Static asset serving for production |

## 3. Architecture Map
The app is a browser-only React SPA with a relatively clean split between pure domain logic and UI orchestration:

```text
User input / clicks
  -> React local state hooks (`useNetworkState`, `useTheme`, `usePagination`)
  -> Derived state in `App.tsx`
  -> Pure domain functions (`subnetInfo`, `allocateVLSM`, helpers)
  -> Visual components (`BitRuler`, `BlockMap`, `RangeReport`, etc.)
  -> Optional local persistence (`localStorage` for theme only)
```

### Data Flow
1. `CidrInput` and header mode controls update base network / mode through `useNetworkState`.
2. `App.tsx` derives current blocks using `subnetInfo()` for equal-split mode or `allocateVLSM()` for VLSM mode.
3. The derived block list is fed into `QuickFacts`, `BitRuler`, `BlockMap`, and `RangeReport`.
4. Theme selection flows through `useTheme`, which writes CSS custom properties to the document root.
5. Export is handled client-side in `RangeReport` by constructing a Blob and triggering download.

### Module Inventory
| Module / File | Purpose | Status |
|--------------|---------|--------|
| `src/main.tsx` | React entry point, mounts `App` | OK |
| `src/App.tsx` | Top-level orchestration, derives block data, coordinates major UI flows | NEEDS ATTENTION |
| `src/config/SubnetStudioConfig.ts` | Version metadata | OK |
| `src/domain/ipv4.ts` | IPv4 parsing, conversion, classification, subnet calculations | OK |
| `src/domain/vlsm.ts` | VLSM allocation and remainder calculation | NEEDS ATTENTION |
| `src/domain/ipv4.test.ts` | Domain tests for parsing, subnet math, and some VLSM cases | NEEDS ATTENTION |
| `src/state/useNetworkState.ts` | Base network, mode, VLSM request list, selection state | OK |
| `src/state/usePagination.ts` | Generic pagination hook | OK |
| `src/state/useTheme.ts` | Theme persistence + CSS variable application | PROBLEM |
| `src/themes/themes.ts` | Theme definitions + noise palette data | OK |
| `src/components/Input/CidrInput.tsx` | CIDR input, quick prefix buttons, address classification badge | OK |
| `src/components/Layout/Header.tsx` | Branding, mode toggle, settings button | OK |
| `src/components/Display/QuickFacts.tsx` | Selected subnet facts and equations | OK |
| `src/components/Display/BitRuler.tsx` | 32-bit subnet visualization with equal/VLSM modes | OK |
| `src/components/Display/BlockMap.tsx` | Visual block/tile map, tooltip, VLSM utilization view | NEEDS ATTENTION |
| `src/components/Display/RangeReport.tsx` | Searchable/paginated report and VLSM export | NEEDS ATTENTION |
| `src/components/Vlsm/VlsmRow.tsx` | Individual editable VLSM row | OK |
| `src/components/Background/BitNoise.tsx` | Animated canvas background | OK |
| `src/components/Settings/SettingsModal.tsx` | Theme chooser modal | OK |
| `src/components/Shared/CidrHighlight.tsx` | CIDR prefix highlighting helper | OK |
| `src/components/Shared/CopyValue.tsx` | Copy-to-clipboard UI helper | OK |
| `src/components/Shared/Paginator.tsx` | Shared paginator UI | OK |
| `src/index.css` | Entire visual design system and component styling | NEEDS ATTENTION |
| `README.md` | Product and local development overview | OK |
| `vite.config.ts` | Vite + PWA configuration | OK |
| `index.html` | HTML shell + favicon/manifest links | NEEDS ATTENTION |
| `public/favicons/site.webmanifest` | Static manifest linked from HTML | PROBLEM |
| `docker/dockerfile.prod` | Multi-stage production image | OK |
| `docker/nginx.conf` | Static hosting + SPA fallback config | OK |
| `.agents/plan/v1-plan.md` | Original product/architecture plan | OK |
| `.agents/plan/v2-cleanup.md` | Follow-up cleanup/refactor planning doc | OK |

## 4. Critical Problems
### P001 — TypeScript safety is not part of the real build gate
- **Severity:** HIGH
- **Files:** `package.json`, `tsconfig.json`, `src/state/useTheme.ts`, `src/App.tsx`
- **Description:** `npm run build` succeeds because Vite transpiles and bundles, but `npx tsc --noEmit` fails. Current errors include a missing `ThemeDef` import in `useTheme.ts`, CSS side-effect import typing trouble in `App.tsx`, and a type mismatch around `Object.entries(theme.vars)` in `useTheme.ts`.
- **Impact:** The project advertises strict TypeScript, but the effective release path allows type errors into production. This should be corrected before layering in TypeSafe integration or additional state complexity.

### P002 — The checked-in web manifest references incorrect icon paths
- **Severity:** HIGH
- **Files:** `public/favicons/site.webmanifest`, `index.html`
- **Description:** The static manifest linked by `index.html` points to `/public/favicon/...` icon paths, but the actual files live under `/public/favicons/...`. This diverges from the Vite-generated manifest and is likely to produce broken icon lookups in the linked static manifest path.
- **Impact:** PWA installation metadata is inconsistent and may fail or degrade on platforms that consume the linked static manifest rather than the generated one.

### P003 — Unallocated remainder CIDR coverage is computed incorrectly for exact power-of-two ranges
- **Severity:** HIGH
- **Files:** `src/domain/vlsm.ts`, `src/App.tsx`, `src/components/Display/BlockMap.tsx`, `src/components/Display/RangeReport.tsx`
- **Description:** `coverPrefix` in `UnallocatedRange` uses `Math.ceil(Math.log2(total + 1))`, which is off by one for totals such as 1, 2, 4, 8, 16, etc. That means remainder ranges can display a covering prefix that is broader than necessary.
- **Impact:** The app can misrepresent leftover address space in an educational subnetting tool, which undermines trust in the visualization even though the raw first/last addresses remain correct.

### P004 — VLSM drag-to-reorder UX implies control that the allocator ignores
- **Severity:** MEDIUM
- **Files:** `src/state/useNetworkState.ts`, `src/domain/vlsm.ts`, `src/App.tsx`, `src/components/Vlsm/VlsmRow.tsx`
- **Description:** The UI says users can drag rows to reorder, and state does preserve list order. However, `allocateVLSM()` always sorts descending by `hostsNeeded`, so drag order does not affect actual allocation results.
- **Impact:** Users are taught the wrong mental model, and the UI makes a promise it does not fulfill. This matters for both educational clarity and eventual AI automation, because commands that imply ordering would appear to work while being ignored.

## 5. Technical Debt
### D001 — `App.tsx` remains the orchestration choke point
- **Files:** `src/App.tsx`
- **Description:** The top-level component still owns most derived-state composition, filtered VLSM request logic, selection logic, modal wiring, footer chrome, and VLSM editor rendering.
- **Recommendation:** Extract feature-focused hooks/components or create a view-model layer before introducing automation flows.

### D002 — Styling is centralized in a single very large CSS file
- **Files:** `src/index.css`
- **Description:** The app uses a coherent token system, but almost all styling lives in one large monolithic stylesheet.
- **Recommendation:** Keep tokens centralized, but consider splitting feature sections into component-scoped CSS modules or layered CSS files once new UI work begins.

### D003 — Installed dependencies do not match actual usage
- **Files:** `package.json`, `src/main.tsx`
- **Description:** Bulma is installed and commented imports remain in `src/main.tsx`, but the current UI does not actively use Bulma.
- **Recommendation:** Either remove the dependency or intentionally adopt it. Avoid carrying styling frameworks without a concrete purpose.

### D004 — Test coverage is limited to a narrow slice of domain behavior
- **Files:** `src/domain/ipv4.test.ts`
- **Description:** Only one test file exists, focused on a few IPv4/VLSM cases. UI behaviors, theming, export logic, address classification, and edge cases around unallocated ranges are untested.
- **Recommendation:** Expand unit coverage for domain edge cases first, then add smoke/integration tests for the main automation UX.

### D005 — Planning/docs are split between repo docs and ignored ADLC state
- **Files:** `.agents/plan/v1-plan.md`, `.agents/plan/v2-cleanup.md`, `.gitignore`, `.adlc/*`
- **Description:** Historical planning docs are tracked in-repo, but the newly initialized ADLC control directory is ignored by git.
- **Recommendation:** Resolve how planning should be versioned before the TypeSafe initiative begins, because the user explicitly requested branch-tracked planning.

## 6. Missing Pieces
- No AI automation or natural-language command surface exists yet.
- No server-side or edge-side integration boundary exists for API-backed features.
- No privacy-mode UX exists to preserve the app's current “nothing is sent or stored” promise when optional cloud automation is introduced.
- No type-safe service contract exists for future automation results (intent, arguments, confidence, follow-up prompts).
- No UI smoke tests exist for critical user flows such as equal-split changes, VLSM edits, export, or theme selection.
- No lint/typecheck scripts are wired into `package.json`.

## 7. Strengths
- The deterministic subnet math is kept in framework-free domain modules.
- The UI is feature-rich already: equal split, VLSM, export, tooltips, pagination, search, theming, and PWA support all exist in a small codebase.
- The design system is consistent and distinctive, using CSS custom properties effectively.
- Components are generally focused and readable.
- The code avoids backend entanglement, which makes optional automation features easier to isolate behind a clear boundary.

## 8. Existing Tests
One test file exists: `src/domain/ipv4.test.ts`.

Coverage currently includes:
- valid/invalid CIDR parsing
- `/24`, `/31`, and `/32` subnet behavior
- basic VLSM descending-size allocation
- basic overflow detection

Coverage currently does **not** include:
- `classifyAddress()`
- unallocated remainder `coverPrefix` correctness
- theming hooks/components
- export behaviors
- RangeReport / BlockMap / BitRuler rendering behavior

## 9. Existing Documentation
- `README.md` is solid for product overview, local setup, and high-level feature list.
- `.agents/plan/v1-plan.md` documents the original architecture and scope rationale in detail.
- `.agents/plan/v2-cleanup.md` captures a later cleanup/refactor direction.
- Inline comments are used well for sectioning and explaining UI/domain intent, especially in `App.tsx`, `vlsm.ts`, and display components.

## 10. Dependencies of Note
- `react` / `react-dom` are the app foundation and appear current.
- `vite-plugin-pwa` is central to install/offline behavior.
- `vitest` is present but underused.
- `bulma` is installed but effectively dormant.
- A future TypeSafe integration will require additional server/runtime decisions because the JavaScript SDK expects a Node 20+ environment and API keys must stay server-side.

## 11. Security Observations
- Current app posture is strong for a client-side educational tool: no backend, no auth, no secrets, and no analytics observed.
- Theme choice is the only persisted data (`localStorage`).
- Clipboard writes are user-triggered from `CopyValue`, which is acceptable.
- Any TypeSafe or other AI integration must keep credentials off the client and clearly communicate when user-entered network planning data is sent off-device.
- The product's current privacy promise in `README.md` will need explicit qualification if optional cloud automation is added.

## 12. Recommended Focus Areas
1. Fix the type-safety and build-verification baseline first (`tsc --noEmit`, theme typing, CSS typing, manifest consistency) so the project has a trustworthy foundation before adding automation.
2. Design a minimal, bounded automation surface for TypeSafe (command bar / action dispatcher) that preserves deterministic subnet math and keeps user confirmation in code.
3. Introduce a secure integration boundary for TypeSafe calls and a privacy model for opt-in cloud-assisted features.
4. Expand domain tests around VLSM remainder handling and then add smoke tests for any new automation flow.
5. Refactor `App.tsx` just enough to keep new automation state and actions from turning the top-level component into a bottleneck.
