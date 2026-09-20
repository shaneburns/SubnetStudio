import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHealthResponse, interpretPrompt } from './automation';
import { callTypeSafeSystemOne } from './typesafe';

vi.mock('./typesafe', () => ({
  callTypeSafeSystemOne: vi.fn(),
}));

const mockedCallTypeSafeSystemOne = vi.mocked(callTypeSafeSystemOne);

describe('automation backend interpretation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns a verbose not-configured message in development', async () => {
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.NODE_ENV;

    const response = await interpretPrompt({
      prompt: 'set the base network to 10.0.0.0/24',
      workspace: {
        baseCidr: '192.168.1.0/24',
        basePrefix: 24,
        mode: 'equal-split',
        equalSplitPrefix: null,
      },
    });
    expect(response.status).toBe('not-configured');
    expect(response.message).toMatch(/TYPESAFE_API_KEY/i);
    expect(response.plan).toBeNull();
    expect(mockedCallTypeSafeSystemOne).not.toHaveBeenCalled();
  });

  it('returns a sanitized not-configured message in production', async () => {
    delete process.env.TYPESAFE_API_KEY;
    process.env.NODE_ENV = 'production';

    const response = await interpretPrompt({
      prompt: 'set the base network to 10.0.0.0/24',
      workspace: {
        baseCidr: '192.168.1.0/24',
        basePrefix: 24,
        mode: 'equal-split',
        equalSplitPrefix: null,
      },
    });
    expect(response.status).toBe('not-configured');
    expect(response.message).toBe('Automation backend is not configured.');
    expect(response.plan).toBeNull();
    expect(mockedCallTypeSafeSystemOne).not.toHaveBeenCalled();
  });

  it('omits model and apiUrl from health responses in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.TYPESAFE_API_KEY = 'dummy';

    const response = buildHealthResponse();
    expect(response.configured).toBe(true);
    expect(response.model).toBeUndefined();
    expect(response.apiUrl).toBeUndefined();
  });

  it('includes model and apiUrl in health responses during development', () => {
    delete process.env.NODE_ENV;
    process.env.TYPESAFE_API_KEY = 'dummy';

    const response = buildHealthResponse();
    expect(response.model).toBe('jev-latest');
    expect(response.apiUrl).toBe('https://api.typesafe.ai/v1/systemone');
  });

  it('maps a split command into a deterministic multi-step plan', async () => {
    process.env.TYPESAFE_API_KEY = 'dummy';
    mockedCallTypeSafeSystemOne.mockResolvedValue({
      answers: {
        intent: { type: 'choice', choice: 'set-equal-split-prefix', confidence: 0.97, probabilities: {} },
        mode_choice: { type: 'choice', choice: 'none', confidence: 0.99, probabilities: {} },
        cidr_choice: { type: 'choice', choice: '10.0.0.0/24', confidence: 0.98, probabilities: {} },
        prefix_choice: { type: 'choice', choice: '26', confidence: 0.96, probabilities: {} },
      },
    });

    const response = await interpretPrompt({
      prompt: 'split 10.0.0.0/24 into /26s',
      workspace: {
        baseCidr: '192.168.1.0/24',
        basePrefix: 24,
        mode: 'equal-split',
        equalSplitPrefix: null,
      },
    });
    expect(response.status).toBe('ready');
    expect(response.plan?.actions).toEqual([
      { intent: 'set-base-cidr', cidr: '10.0.0.0/24' },
      { intent: 'set-equal-split-prefix', prefix: 26 },
    ]);

    const requestBody = mockedCallTypeSafeSystemOne.mock.calls[0][0] as {
      state: { prefixCandidates: number[] };
      questions: Record<string, unknown>;
    };
    expect(requestBody.state.prefixCandidates).toContain(26);
    expect(Object.keys(requestBody.questions)).toContain('intent');
    expect(Object.keys(requestBody.questions)).toContain('prefix_choice');
  });

  it('rejects invalid provider prefix choices instead of building an applyable plan', async () => {
    process.env.TYPESAFE_API_KEY = 'dummy';
    mockedCallTypeSafeSystemOne.mockResolvedValue({
      answers: {
        intent: { type: 'choice', choice: 'set-equal-split-prefix', confidence: 0.97, probabilities: {} },
        mode_choice: { type: 'choice', choice: 'none', confidence: 0.99, probabilities: {} },
        cidr_choice: { type: 'choice', choice: '10.0.0.0/24', confidence: 0.98, probabilities: {} },
        prefix_choice: { type: 'choice', choice: 'wat', confidence: 0.96, probabilities: {} },
      },
    });

    const response = await interpretPrompt({
      prompt: 'split 10.0.0.0/24 into /26s',
      workspace: {
        baseCidr: '192.168.1.0/24',
        basePrefix: 24,
        mode: 'equal-split',
        equalSplitPrefix: null,
      },
    });

    expect(response.status).toBe('ready');
    expect(response.plan?.actions).toEqual([
      {
        intent: 'unsupported',
        reason: 'The provider returned an invalid equal-split prefix for the selected base network.',
      },
    ]);
  });

  it('rejects invalid provider mode choices instead of building an applyable plan', async () => {
    process.env.TYPESAFE_API_KEY = 'dummy';
    mockedCallTypeSafeSystemOne.mockResolvedValue({
      answers: {
        intent: { type: 'choice', choice: 'set-mode', confidence: 0.95, probabilities: {} },
        mode_choice: { type: 'choice', choice: 'wizard-mode', confidence: 0.94, probabilities: {} },
      },
    });

    const response = await interpretPrompt({
      prompt: 'switch modes',
      workspace: {
        baseCidr: '192.168.1.0/24',
        basePrefix: 24,
        mode: 'equal-split',
        equalSplitPrefix: null,
      },
    });

    expect(response.status).toBe('ready');
    expect(response.plan?.actions).toEqual([
      {
        intent: 'unsupported',
        reason: 'The provider returned an unsupported mode choice.',
      },
    ]);
  });

  it('maps a VLSM batch command into a plan with deterministic request data', async () => {
    process.env.TYPESAFE_API_KEY = 'dummy';
    mockedCallTypeSafeSystemOne.mockResolvedValue({
      answers: {
        intent: { type: 'choice', choice: 'batch-vlsm-requests', confidence: 0.93, probabilities: {} },
        mode_choice: { type: 'choice', choice: 'vlsm', confidence: 0.96, probabilities: {} },
        cidr_choice: { type: 'choice', choice: 'none', confidence: 1, probabilities: {} },
      },
    });

    const response = await interpretPrompt({
      prompt: 'switch to vlsm and guest: 120, staff: 60',
      workspace: {
        baseCidr: '192.168.1.0/24',
        basePrefix: 24,
        mode: 'equal-split',
        equalSplitPrefix: null,
      },
    });
    expect(response.status).toBe('ready');
    expect(response.plan?.actions).toEqual([
      { intent: 'set-mode', mode: 'vlsm' },
      {
        intent: 'batch-vlsm-requests',
        requests: [
          { name: 'guest', hostsNeeded: 120 },
          { name: 'staff', hostsNeeded: 60 },
        ],
      },
    ]);
  });

  it('derives an equal-split prefix from a requested minimum subnet count', async () => {
    process.env.TYPESAFE_API_KEY = 'dummy';
    mockedCallTypeSafeSystemOne.mockResolvedValue({
      answers: {
        intent: { type: 'choice', choice: 'set-equal-split-prefix', confidence: 0.94, probabilities: {} },
        mode_choice: { type: 'choice', choice: 'none', confidence: 0.99, probabilities: {} },
      },
    });

    const response = await interpretPrompt({
      prompt: 'split this into at least five subnets',
      workspace: {
        baseCidr: '192.168.1.0/24',
        basePrefix: 24,
        mode: 'equal-split',
        equalSplitPrefix: null,
      },
    });
    expect(response.status).toBe('ready');
    expect(response.plan?.actions).toEqual([
      { intent: 'set-equal-split-prefix', prefix: 27 },
    ]);

    const requestBody = mockedCallTypeSafeSystemOne.mock.calls[0][0] as {
      state: { prefixCandidates: number[]; subnetCountCandidates: number[]; workspace: { basePrefix: number } };
      questions: Record<string, unknown>;
    };
    expect(requestBody.state.subnetCountCandidates).toContain(5);
    expect(requestBody.state.prefixCandidates).toContain(27);
    expect(requestBody.state.workspace.basePrefix).toBe(24);
    expect(Object.keys(requestBody.questions)).not.toContain('prefix_choice');
  });

  it('keeps the current base network when a split request references the current CIDR', async () => {
    process.env.TYPESAFE_API_KEY = 'dummy';
    mockedCallTypeSafeSystemOne.mockResolvedValue({
      answers: {
        intent: { type: 'choice', choice: 'set-base-cidr', confidence: 0.95, probabilities: {} },
        mode_choice: { type: 'choice', choice: 'none', confidence: 0.99, probabilities: {} },
        cidr_choice: { type: 'choice', choice: '172.23.100.0/24', confidence: 0.98, probabilities: {} },
      },
    });

    const response = await interpretPrompt({
      prompt: 'split this current 172.23.100.0/24 network into 22 subnets',
      workspace: {
        baseCidr: '172.23.100.0/24',
        basePrefix: 24,
        mode: 'equal-split',
        equalSplitPrefix: null,
      },
    });
    expect(response.status).toBe('ready');
    expect(response.plan?.actions).toEqual([
      { intent: 'set-equal-split-prefix', prefix: 29 },
    ]);
    const requestBody = mockedCallTypeSafeSystemOne.mock.calls[0][0] as {
      state: { subnetCountCandidates: number[]; prefixCandidates: number[] };
      questions: Record<string, unknown>;
    };
    expect(requestBody.state.subnetCountCandidates).toContain(22);
    expect(requestBody.state.prefixCandidates).toContain(29);
    expect(Object.keys(requestBody.questions)).not.toContain('prefix_choice');
  });
});
