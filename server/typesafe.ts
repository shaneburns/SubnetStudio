import { getTypeSafeApiKey, getTypeSafeApiUrl } from './config';

function truncateForLog(value: string, maxLength = 1000): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}… [truncated]`
    : normalized;
}

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

interface TypeSafeSystemOneResponse {
  answers: Record<string, ChoiceAnswer>;
}

/** Sends one System One evaluation request to the configured TypeSafe endpoint. */
export async function callTypeSafeSystemOne(requestBody: unknown): Promise<TypeSafeSystemOneResponse> {
  const apiKey = getTypeSafeApiKey();
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY is not configured.');
  }

  const response = await fetch(getTypeSafeApiUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = truncateForLog(await response.text());
    throw new Error(`TypeSafe request failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<TypeSafeSystemOneResponse>;
}
