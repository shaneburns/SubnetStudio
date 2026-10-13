/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `'true'` enables the AI Assist panel and automation backend calls. Off by default. */
  readonly VITE_ENABLE_AI_ASSIST?: string;
  /** Dev-only: override the Vite proxy target for `/api/automation/*`. */
  readonly VITE_AUTOMATION_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
