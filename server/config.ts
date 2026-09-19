import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

const DEFAULT_PORT = 8787;
const DEFAULT_MODEL = 'jev-latest';
const DEFAULT_TYPESAFE_API_URL = 'https://api.typesafe.ai/v1/systemone';

/** Returns the local port used by the automation companion service. */
export function getPort(): number {
  const raw = process.env.AUTOMATION_SERVER_PORT;
  const parsed = raw ? Number(raw) : DEFAULT_PORT;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

/** Returns the TypeSafe model name requested by the backend. */
export function getModel(): string {
  return process.env.TYPESAFE_MODEL?.trim() || DEFAULT_MODEL;
}

/** Returns the TypeSafe API URL or an internal router override. */
export function getTypeSafeApiUrl(): string {
  return process.env.TYPESAFE_API_URL?.trim() || DEFAULT_TYPESAFE_API_URL;
}

/** Returns the server-side TypeSafe API key if configured. */
export function getTypeSafeApiKey(): string {
  return process.env.TYPESAFE_API_KEY?.trim() || '';
}

/** Reports whether the backend has enough config to contact TypeSafe. */
export function isTypeSafeConfigured(): boolean {
  return Boolean(getTypeSafeApiKey());
}
