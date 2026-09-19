# Plan — SubnetStudio

> Living document. New initiatives are appended with timestamps.
> Tasks use checkboxes: [ ] pending, [~] in-progress, [x] complete, [!] blocked.
> Never delete or overwrite completed tasks.

---

## Initiative: TypeSafe Automation Command Bar — 2026-09-19 00:30 UTC

### Overview
This initiative adds a TypeSafe-driven natural-language automation experience to SubnetStudio without moving any subnet math into AI. The feature will introduce a bounded command bar, a backend automation route that keeps the API key off the client, and a confidence-aware confirmation flow that converts user intent into ordinary deterministic state updates.

The implementation will also repair the verification baseline and existing correctness issues that would make automation work unsafe or misleading. Per user direction, ADLC artifacts remain ignored by default but will be force-tracked on this branch for merge visibility.

### Summary
- Total tasks: 7
- Estimated total effort: ~7–9 focused sessions
- Planning assumption: “backend route in the React app” will be implemented as a small in-repo Node companion service exposed to the frontend as `/api/automation/*` and documented as a future internal-router integration point.

### Tasks

#### FIX.T01 — Restore typecheck and PWA verification baseline

- **Status:** [x] complete
- **Phase:** Foundation
- **Effort:** M
- **Depends On:** none
- **Files:**
  - `package.json` — add explicit verification scripts for typecheck/backend run as needed
  - `tsconfig.json` — ensure frontend and any shared/backend TS files typecheck cleanly
  - `src/state/useTheme.ts` — fix missing imports and current type errors
  - `src/App.tsx` — resolve CSS side-effect import typing issue if still present after TS config updates
  - `src/vite-env.d.ts` or equivalent — add CSS/Vite client typings if required
  - `public/favicons/site.webmanifest` — correct icon paths and manifest metadata alignment
  - `index.html` — verify linked manifest path and related metadata stay coherent
- **Risk:** Medium — TypeScript and manifest changes can expose additional hidden issues once verification is strict.

**Description:**
Before adding any automation workflow, the project needs a trustworthy verification baseline. This task fixes the currently failing `tsc --noEmit` path, formalizes it as a script, and resolves the manifest inconsistency so the app’s client/runtime contract is reliable before new moving parts are introduced.

**Acceptance Criteria:**
- [ ] `npm run typecheck` exists and passes with zero errors.
- [ ] `npm run build` still passes after the verification changes.
- [ ] `npm test -- --run` still passes after the verification changes.
- [ ] `public/favicons/site.webmanifest` references real icon paths under `public/favicons/` and no longer points at `/public/favicon/...`.

#### FIX.T02 — Correct VLSM remainder coverage math and lock it with tests

- **Status:** [x] complete
- **Phase:** Correctness
- **Effort:** S
- **Depends On:** FIX.T01
- **Files:**
  - `src/domain/vlsm.ts` — fix `coverPrefix` calculation for exact power-of-two remainder ranges
  - `src/domain/ipv4.test.ts` — add regression tests for remainder coverage and related VLSM edge cases
  - `src/App.tsx` — adjust any derived assumptions if required by the corrected remainder shape
- **Risk:** Low — isolated domain fix, but the displayed remainder CIDR may change in visible UI snapshots.

**Description:**
The current VLSM remainder display can overstate the size of the covering CIDR for exact power-of-two leftovers. This task fixes the math in the domain layer and protects it with explicit tests so the automation feature does not build on top of incorrect planning visuals.

**Acceptance Criteria:**
- [ ] A remainder of 1, 2, 4, 8, and 16 addresses yields the smallest valid covering prefix in automated tests.
- [ ] Existing VLSM allocation tests still pass.
- [ ] `npm test -- --run` passes with the new remainder regression coverage.
- [ ] No UI code computes workaround remainder prefixes outside `src/domain/vlsm.ts`.

#### FIX.T03 — Resolve misleading VLSM reorder behavior before automation can target it

- **Status:** [x] complete
- **Phase:** UX Integrity
- **Effort:** S
- **Depends On:** FIX.T01
- **Files:**
  - `src/domain/vlsm.ts` — preserve or expose the effective allocation ordering clearly
  - `src/App.tsx` — align rendered messaging and interactions with actual allocator behavior
  - `src/components/Vlsm/VlsmRow.tsx` — remove or refine drag affordance if it does not affect outcomes
  - `src/index.css` — adjust any styling tied to reorder affordances or explanatory copy
- **Risk:** Medium — changing this behavior affects an existing user interaction and teaching model.

**Description:**
Natural-language automation will eventually target VLSM creation and modification, so the UI cannot imply that drag order changes allocation if the allocator always sorts by size. This task either removes the misleading affordance or makes the relationship between user order and allocation order explicit so commands and UI stay honest.

**Acceptance Criteria:**
- [ ] The VLSM UI no longer implies that manual row order changes packed allocation results unless the allocator actually uses that order.
- [ ] Any remaining reorder control has visible explanatory copy that matches `allocateVLSM()` behavior.
- [ ] `npm run build` passes after the UX adjustment.
- [ ] `npm test -- --run` passes after the UX adjustment.

#### ARCH.T04 — Introduce an in-repo backend automation boundary and shared command contract

- **Status:** [x] complete
- **Phase:** Architecture
- **Effort:** L
- **Depends On:** FIX.T01, FIX.T02, FIX.T03
- **Files:**
  - `package.json` — add scripts/dependencies for running the backend companion service
  - `vite.config.ts` — configure dev proxying for `/api/automation/*` if needed
  - `server/` or `backend/` entry files — create the Node automation service
  - `src/types/automation.ts` or equivalent shared module — define request/response contracts used by frontend and backend
  - `.env.example` — document required TypeSafe-related environment variables without exposing secrets
  - `docker/` config or new backend run docs as appropriate — clarify current serving boundary if local proxying is required
- **Risk:** High — this introduces the first backend runtime into a previously static app and changes local development assumptions.

**Description:**
The React app cannot safely hold a TypeSafe API key, so this task creates a dedicated backend boundary in the repo and gives the frontend a stable `/api/automation/*` contract to call. The goal is to keep this service minimal and shaped for future replacement by an internal model router, while remaining concrete enough for this branch to exercise a real TypeSafe-backed command flow.

**Acceptance Criteria:**
- [ ] A backend service exists in-repo and exposes a documented `/api/automation/*` endpoint surface for the frontend.
- [ ] TypeSafe credentials are read from server-side environment variables and are not referenced in frontend source files.
- [ ] Frontend development can call the backend route through a documented local workflow.
- [ ] `npm run typecheck`, `npm run build`, and `npm test -- --run` all pass with the backend boundary present.

> **Manual Verification Required:** Run `npm run dev:full`, open the app through Vite,
> and confirm `/api/automation/health` is reachable through the frontend dev proxy.

#### FEAT.T05 — Implement TypeSafe command interpretation and deterministic action mapping

- **Status:** [x] complete
- **Phase:** Feature
- **Effort:** L
- **Depends On:** ARCH.T04
- **Files:**
  - `server/` or `backend/` automation handler files — integrate TypeSafe request formatting and response mapping
  - `src/types/automation.ts` or equivalent — define typed intents, arguments, confidence, and confirmation needs
  - `src/state/useNetworkState.ts` — expose or add deterministic actions that automation can call safely
  - `src/domain/ipv4.ts` — add helpers only if deterministic normalization utilities are needed
  - `src/domain/vlsm.ts` — add helpers only if deterministic request application utilities are needed
- **Risk:** High — poor intent mapping or weak action boundaries could create incorrect state changes even if the AI call succeeds.

**Description:**
This task implements the core TypeSafe integration: transforming natural-language input into typed intents and then converting those intents into ordinary deterministic state changes. The backend should ask narrow, typed questions suitable for System One, and the frontend/state layer should apply only approved, validated actions such as mode switches, base CIDR updates, equal-split changes, and VLSM row creation/update.

**Acceptance Criteria:**
- [ ] The backend formats TypeSafe requests using bounded typed questions rather than freeform prompt-and-parse behavior.
- [ ] The interpreted action contract includes enough information for the frontend to distinguish direct execution from confirmation-required execution.
- [ ] Supported first-slice actions are explicitly limited and documented (for example: switch mode, set base CIDR, set split prefix, add/update VLSM requirements).
- [ ] No subnet math or address derivation is delegated to TypeSafe; all calculations remain in existing deterministic code paths.

> **Manual Verification Required:** With a real `TYPESAFE_API_KEY`, submit a command such as
> `split 10.0.0.0/24 into /26s` to the backend route and confirm a structured plan is returned.

#### FEAT.T06 — Add a natural-language command bar and confidence-gated confirmation UX

- **Status:** [x] complete
- **Phase:** Feature
- **Effort:** L
- **Depends On:** FEAT.T05
- **Files:**
  - `src/App.tsx` — integrate automation UI state, request lifecycle, and state-application flow or delegate to new feature components
  - `src/components/` new automation UI files — command bar, result preview, confirmation panel, and error states
  - `src/index.css` — style the automation surface using existing token conventions
  - `src/components/Layout/Header.tsx` or a new top-level feature mount point — expose entry to the automation experience
- **Risk:** High — the UX must make cloud-assisted behavior obvious and prevent silent incorrect changes.

**Description:**
This task adds the user-facing automation experience: a command bar where users can describe what they want, plus a confidence-aware execution/confirmation flow. High-confidence low-risk actions may apply immediately if appropriate, while ambiguous or higher-risk changes should present a preview and require explicit user confirmation before state updates occur.

**Acceptance Criteria:**
- [ ] The UI includes a visible natural-language command entry point in the main app.
- [ ] Successful interpretations produce a human-reviewable preview of the action to be applied.
- [ ] Ambiguous, low-confidence, or unsupported requests are surfaced without mutating subnet state silently.
- [ ] The automation UI clearly indicates that requests are cloud-assisted and not part of the fully offline core workflow.

> **Manual Verification Required:** In a browser with the backend running, submit a supported
> command and confirm the preview renders before apply, then submit an unsupported command and
> confirm the UI blocks apply.

#### TEST.T07 — Add automation regression coverage and update user-facing docs

- **Status:** [x] complete
- **Phase:** Test & Docs
- **Effort:** M
- **Depends On:** FEAT.T06
- **Files:**
  - `src/domain/ipv4.test.ts` and/or new test files — cover any new deterministic helpers and automation action application logic
  - backend test files or lightweight handler tests — verify request validation and response shaping
  - `README.md` — document the automation feature, local backend setup, environment variables, and privacy implications
  - `.env.example` — finalize documented environment variables
  - `.adlc/*` — force-track final planning artifacts on this branch per user instruction
- **Risk:** Medium — documentation can drift from the actual local run path if not validated against the implemented scripts.

**Description:**
The final task closes the loop by adding regression protection around the deterministic parts of automation and updating docs so the feature is reproducible by others. It also records the initiative artifacts on the branch as requested, while leaving `.adlc/` ignored by default for ordinary working-copy behavior.

**Acceptance Criteria:**
- [ ] Automated tests cover deterministic automation action application and backend response validation for the supported first-slice commands.
- [ ] `README.md` documents how to run the frontend, backend route, and required environment variables for TypeSafe.
- [ ] `README.md` explicitly states that automation is optional and sends user input to a server-side AI integration when used.
- [ ] The branch contains the relevant `.adlc/` planning artifacts via force-add without removing `.adlc/` from `.gitignore`.

---

## Initiative: Review Follow-ups — 2026-09-19 01:15 UTC

### Overview
These follow-up tasks were created during final review. They are not blocking for the TypeSafe automation command bar initiative, but they should be handled before significant additional automation work lands on top of this branch.

### Summary
- Total tasks: 2
- Estimated total effort: ~1–2 focused sessions

### Tasks

#### REV.T01 — Remove unused VLSM reorder helper

- **Status:** [ ] pending
- **Phase:** Cleanup
- **Effort:** XS
- **Depends On:** none
- **Files:**
  - `src/state/useNetworkState.ts` — remove `reorderVlsmRequests` and its stale drag/drop comment now that the UI no longer exposes reorder
- **Risk:** Low

**Description:**
The drag affordance was removed from the VLSM editor, but the state hook still exports the old reorder helper and comment block. Removing the dead helper will keep the state API aligned with the UI and reduce confusion for future automation work.

**Acceptance Criteria:**
- [ ] `reorderVlsmRequests` is removed from `useNetworkState.ts` if no code path uses it.
- [ ] The stale drag/drop comment is removed with it.
- [ ] `npm run typecheck` passes after the cleanup.
- [ ] `npm test -- --run` passes after the cleanup.

#### REV.T02 — Sanitize backend error responses and finish automation docs

- **Status:** [ ] pending
- **Phase:** Hardening
- **Effort:** S
- **Depends On:** none
- **Files:**
  - `server/typesafe.ts` — avoid returning raw upstream error bodies directly to the client
  - `server/index.ts` — map backend failures to user-safe messages while keeping detailed server logs
  - `src/components/Automation/AutomationPanel.tsx` — add component/props documentation comments if retained as an exported public component
  - `server/README.md` — remove the stale “scaffold” label and align wording with the implemented behavior
- **Risk:** Low

**Description:**
The current backend forwards detailed upstream TypeSafe error text to the client, which is convenient during development but looser than ideal for a long-lived integration boundary. This follow-up tightens user-visible error handling and completes a small amount of public-facing documentation cleanup.

**Acceptance Criteria:**
- [ ] Client-visible automation backend errors no longer echo raw upstream response bodies verbatim.
- [ ] Detailed failure context remains available in server-side logs for debugging.
- [ ] Exported automation UI/component surfaces added by this initiative have documentation comments consistent with conventions.
- [ ] `server/README.md` accurately describes the implemented backend rather than calling it a scaffold.

