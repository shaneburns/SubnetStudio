/**
 * Build-time feature flags.
 *
 * Values come from `import.meta.env.VITE_*`, which Vite replaces with string
 * literals at build time. Keeping each flag as a plain `const` comparison lets
 * Rollup fold it to `true`/`false` and tree-shake the guarded code paths out of
 * the production bundle entirely.
 */

/**
 * AI Assist (TypeSafe automation panel + `/api/automation/*` calls).
 *
 * Off by default so production builds ship without the AI surface or any
 * backend requests. Set `VITE_ENABLE_AI_ASSIST=true` in `.env.local` (or the
 * build environment) to turn it on. Planned for general release in v0.0.3a.
 */
export const AI_ASSIST_ENABLED: boolean = import.meta.env.VITE_ENABLE_AI_ASSIST === 'true';
