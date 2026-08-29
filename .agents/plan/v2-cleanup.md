# Subnet Studio — Phase 2: Refinement & Cleanup

Status: Planning. This phase focuses on architectural cleanup, DX (Developer Experience), and styling integration to move from "working prototype" to "production-ready PWA".

---

## 1. Component Decomposition
The current `App.tsx` is a "mega-file". We will move logic into dedicated components in `src/components/` to improve maintainability and testability.

### New Component Map
- `src/components/Layout/`
    - `Header.tsx`: Mode toggles and branding.
    - `AppLayout.tsx`: Main grid structure (Rail + Main Col).
- `src/components/Input/`
    - `CidrInput.tsx`: The network address input with validation logic.
    - `PrefixQuickSelect.tsx`: The buttons for common prefixes (8, 16, 24, etc).
- `src/components/Display/`
    - `QuickFacts.tsx`: The "cheat sheet" derived values and their equations.
    - `BitRuler.tsx`: The interactive 32-bit visualizer.
    - `BlockMap.tsx`: The proportional treemap of allocations.
    - `RangeReport.tsx`: The detailed tabular view of all subnets.
- `src/components/Vlsm/`
    - `VlsmEditor.tsx`: The requirement list (Add/Remove/Edit hosts).
    - `VlsmRow.tsx`: Individual requirement line.

---

## 2. Styling Integration (Bulma)
The design system currently relies on custom CSS variables. We will introduce Bulma for layout primitives while preserving the "blueprint" aesthetic.

- **Integration Strategy**: 
    - Install Bulma via npm.
    - Import Bulma in `src/main.tsx`.
    - Use Bulma's `.columns`, `.column`, and `.container` for the high-level layout.
    - Retain the custom `:root` token system for colors and borders to prevent the app from looking like a generic Bootstrap/Bulma site.
    - Map Bulma's helper classes (e.g., `is-family-monospace`) to our custom IBM Plex Mono fonts.

---

## 3. Code Standard & Format
To align with the project's updated style guide:
- **Indentation**: Convert all files from spaces to **Tabs**.
- **Tab Width**: Set to 4 spaces for visual consistency.
- **Consistency**: Ensure all `src/` files follow this pattern.

---

## 4. Project Documentation
Create a `README.md` at the root to enable other developers (or the user) to boot the project.

### README Contents:
- **Project Description**: Visual-first IPv4 subnetting tool.
- **Tech Stack**: Vite, React, TypeScript, Bulma, `vite-plugin-pwa`.
- **Local Setup**:
    1. `npm install`
    2. `npm run dev` (for development)
    3. `npm run build` (for production build)
- **PWA Notes**: How to test the installable manifest.

---

## 5. Implementation Order
1. **Styling**: Install Bulma and update `src/index.css` to complement it.
2. **Refactor**: Move components from `App.tsx` $\rightarrow$ `src/components/`.
3. **Formatting**: Global find-and-replace for spaces $\rightarrow$ tabs.
4. **Docs**: Write the `README.md`.
5. **Verification**: Run `npm run build` to ensure PWA manifest and types are healthy.
