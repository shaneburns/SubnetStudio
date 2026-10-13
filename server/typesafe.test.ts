import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callTypeSafeSystemOne } from './typesafe';

describe('TypeSafe requests', () => {
  const originalApiKey = process.env.TYPESAFE_API_KEY;
  const originalApiUrl = process.env.TYPESAFE_API_URL;

  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    process.env.TYPESAFE_API_URL = 'https://example.test/systemone';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answers: {} }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalApiKey;
    if (originalApiUrl === undefined) delete process.env.TYPESAFE_API_URL;
    else process.env.TYPESAFE_API_URL = originalApiUrl;
  });

  it('aborts provider requests after a bounded deadline', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    await callTypeSafeSystemOne({});

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.signal).not.toBeNull();
    expect(timeoutSpy).toHaveBeenCalledWith(15_000);
  });
});
