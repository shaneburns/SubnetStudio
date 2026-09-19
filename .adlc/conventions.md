# Coding Conventions — SubnetStudio
> Extracted from codebase by adlc-discover, 2026-09-19T00:30:03Z
> These conventions MUST be followed by all implementation work.
> If a rule is unclear, check the examples here before guessing.

## TypeScript / React

### Indentation
- **Current reality:** indentation is mixed across the codebase.
- **Pattern observed:** many older/newer files use **tabs**, while a number of hooks/components use **2 spaces**.
- **Implementation rule:** preserve the local style of the file you are editing; do not reformat unrelated lines.
- **Tab-oriented example** (`src/components/Input/CidrInput.tsx`):
  ```tsx
  export const CidrInput = ({ base, updateBase }: CidrInputProps) => {
  	const [val, setVal]       = useState(`${base.ip}/${base.prefix}`);
  	const [error, setError]   = useState<string | null>(null);
  ```
- **Space-oriented example** (`src/state/usePagination.ts`):
  ```ts
  export function usePagination<T>(items: T[], pageSize: number): PaginationResult<T> {
    const [page, setPageRaw] = useState(1);
  ```

### Naming
| Item Type | Convention | Example |
|-----------|-----------|---------|
| React components | PascalCase | `BlockMap`, `SettingsModal`, `QuickFacts` |
| Hooks | `useX` camelCase | `useTheme`, `useNetworkState`, `usePagination` |
| Utility/domain functions | camelCase | `subnetInfo`, `maskFromPrefix`, `allocateVLSM` |
| Types / interfaces | PascalCase | `SubnetInfo`, `AllocationRequest`, `ThemeDef` |
| Constants | UPPER_SNAKE_CASE when truly constant | `COMMON_PREFIXES`, `PAGE_SIZE`, `DEFAULT_THEME_ID` |
| CSS classes | kebab-case with feature prefixes | `rr-export-panel`, `bm-tooltip__row`, `vlsm-search-wrap` |

### File Organization
- Imports come first.
- File-local interfaces/types usually appear near the top of the file after imports.
- Helpers are typically defined before the exported component/hook when they are generic enough to be shared inside the file.
- Exported React component/hook comes last or near-last.
- Example (`src/components/Display/RangeReport.tsx`): imports → local types → helper functions → component.

### React State and Derived Data
- Prefer local hooks and `useMemo` over heavyweight state libraries.
- Compute display state from canonical inputs rather than storing redundant copies.
- Example (`src/App.tsx`):
  ```tsx
  const { allocations, unallocated } = React.useMemo(() => {
    if (state.mode === 'equal-split') return { allocations: [] as Allocation[], unallocated: null as UnallocatedRange | null };
    return allocateVLSM(state.base, state.vlsmRequests);
  }, [state.mode, state.base, state.vlsmRequests]);
  ```

### Error Handling
- Domain logic generally avoids throwing; it returns `null`, computed values, or sentinel display values.
- Examples:
  - `parseCIDR()` returns `null` for invalid input.
  - overflow VLSM entries use `'N/A'` strings and `status: 'overflow'`.
- For UI changes, follow the same pattern unless there is a compelling reason to introduce exceptions.

### Comments
- Section-divider comments are common and stylistically important.
- Pattern:
  ```ts
  // ── VLSM allocation (only in vlsm mode) ─────────────────────────────────
  ```
- Use short explanatory comments where intent is not obvious; avoid narrating trivial code.

### Module Structure
- Domain logic lives in `src/domain/` and is intentionally framework-free.
- UI state hooks live in `src/state/`.
- Presentational and interaction components live in `src/components/` grouped by feature area.
- Theme definitions live in `src/themes/` and config/version metadata in `src/config/`.

### Imports
- React import first when needed.
- Then internal imports, generally grouped by relative path.
- CSS imports tend to come last in UI entry/orchestration files.
- Example (`src/App.tsx`): local component/domain imports first, `import './index.css';` last.

### Exports
- Prefer named exports for components, hooks, and helpers.
- `App.tsx` is the notable exception using a default export:
  ```tsx
  export default App;
  ```

## Domain Logic Conventions

### Deterministic, Pure Functions
- The strongest convention in the project is that subnet math stays deterministic and side-effect free.
- Example (`src/domain/ipv4.ts`):
  ```ts
  export function subnetInfo(ip: string, prefix: number): SubnetInfo {
    const ipInt = ipToInt(ip);
    const mask = maskFromPrefix(prefix);
  ```
- New automation features should preserve this separation: AI may choose actions or arguments, but math stays here in plain code.

### Types are Explicit
- Exported domain structures are typed with aliases rather than inferred ad hoc objects.
- Example:
  ```ts
  export type Allocation = {
    id: string;
    name: string;
    requestedHosts: number;
  ```

## CSS / Design System

### Token-First Styling
- Visual styling is driven by CSS custom properties.
- Base tokens live in `:root` in `src/index.css`, with alternate theme values in `src/themes/themes.ts`.
- Example:
  ```css
  :root{
    --bg:#0B1E2D;
    --panel:#0F2740;
    --network:#E8954A;
  }
  ```

### Naming
- CSS uses feature-prefixed block/element style naming, often close to BEM.
- Examples:
  - `bm-tooltip__header`
  - `rr-export-item__tag`
  - `settings-modal__footer`

### Theme Application
- Themes are represented as JS objects containing CSS var maps plus BitNoise settings.
- Theme changes are applied by writing vars to `document.documentElement`.
- New visual features should plug into this token model rather than hard-coding colors.

## Testing Conventions

### Framework
- Vitest is the current test runner.
- Tests are colocated in `src/domain/` at present.

### Style
- `describe`/`it` style from Vitest.
- Expectations are direct and explicit.
- Example (`src/domain/ipv4.test.ts`):
  ```ts
  describe('IPv4 Domain Logic', () => {
  	it('correctly parses valid CIDR', () => {
  		expect(parseCIDR('192.168.1.0/24')).toEqual({ ip: '192.168.1.0', prefix: 24 });
  	});
  });
  ```

### Practical Rule
- Add tests near the logic they protect.
- Prefer domain/unit tests first for subnetting correctness, then higher-level UI/interaction tests for automation flows.

## Documentation / Planning Conventions

### README Tone
- Product docs are direct, feature-focused, and transparent about alpha status.
- Keep external docs concise and practical.

### Planning Docs
- Existing tracked planning docs in `.agents/plan/` are narrative and architecture-oriented.
- ADLC docs in `.adlc/` are structured operational artifacts.
- If planning is meant to be branch-tracked, settle the repo policy before implementation proceeds.

## Implementation Guardrails for the TypeSafe Initiative
- Do **not** move subnet calculations into AI calls.
- Keep TypeSafe usage bounded to intent routing, argument selection, confidence gating, and user-assistive judgments.
- Any API-backed feature must preserve the current deterministic UI flow and degrade gracefully when automation is unavailable.
- Keep credentials server-side; never embed API keys in the React app.
