import type {
  AutomationAction,
  AutomationHealthResponse,
  AutomationIntent,
  AutomationInterpretRequest,
  AutomationInterpretResponse,
  AutomationMode,
  AutomationPlan,
} from '../src/types/automation';
import { getModel, getTypeSafeApiUrl, isDevelopment, isTypeSafeConfigured } from './config';
import { ChoiceAnswer, callTypeSafeSystemOne } from './typesafe';

const SUPPORTED_INTENTS: AutomationIntent[] = [
  'set-mode',
  'set-base-cidr',
  'set-equal-split-prefix',
  'upsert-vlsm-request',
  'batch-vlsm-requests',
  'unsupported',
];

const MAX_EQUAL_SPLIT_BLOCKS = 4096;
const CIDR_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}\b/g;
const PREFIX_REGEX = /\/(\d{1,2})(?:s)?\b/g;
const SUBNET_COUNT_PATTERNS = [
  /at least\s+([a-z-]+(?:\s+[a-z-]+){0,3}|\d{1,6})\s+subnets?\b/gi,
  /into\s+([a-z-]+(?:\s+[a-z-]+){0,3}|\d{1,6})\s+subnets?\b/gi,
  /([a-z-]+(?:\s+[a-z-]+){0,3}|\d{1,6})\s+subnets?\b/gi,
];

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};
const HOST_PAIR_PATTERNS = [
  /([A-Za-z][A-Za-z0-9 -]{0,30}?)\s*[:=]\s*(\d{1,6})\b/g,
  /([A-Za-z][A-Za-z0-9 -]{0,30}?)\s+(\d{1,6})\s+hosts?\b/gi,
];
const AUTOMATION_MODES: AutomationMode[] = ['equal-split', 'vlsm'];

type CandidateRequest = {
  name: string;
  hostsNeeded: number;
};

function normalizeCandidateName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^.*\b(?:and|with|for|add|include|need|needs)\b\s+/i, '');
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function extractCidrs(prompt: string): string[] {
  return unique(prompt.match(CIDR_REGEX) ?? []);
}

function parseNumberPhrase(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const direct = Number(trimmed);
  if (Number.isInteger(direct) && direct >= 0) return direct;

  const tokens = trimmed
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(token => token !== 'and');

  let total = 0;
  let current = 0;
  for (const token of tokens) {
    const value = NUMBER_WORDS[token];
    if (value === undefined) return null;

    if (value === 100) {
      current = Math.max(1, current) * 100;
    } else {
      current += value;
    }
  }

  total += current;
  return total > 0 ? total : null;
}

function extractExplicitSplitPrefixes(prompt: string, cidrCandidates: string[]): number[] {
  const promptWithoutCidrs = cidrCandidates.reduce(
    (text, candidate) => text.replaceAll(candidate, ' '),
    prompt,
  );
  const matches = Array.from(promptWithoutCidrs.matchAll(PREFIX_REGEX), match => Number(match[1]));
  return unique(matches.filter(prefix => Number.isInteger(prefix) && prefix >= 0 && prefix <= 32));
}

function extractSubnetCounts(prompt: string): number[] {
  const counts: number[] = [];
  for (const pattern of SUBNET_COUNT_PATTERNS) {
    for (const match of prompt.matchAll(pattern)) {
      const count = parseNumberPhrase(match[1] ?? '');
      if (count !== null && Number.isInteger(count) && count > 0) counts.push(count);
    }
  }
  return unique(counts);
}

function promptImpliesCurrentBase(prompt: string): boolean {
  return /\b(current|this)\b/i.test(prompt) && /\bnetwork\b/i.test(prompt);
}

function shouldKeepCurrentBase(prompt: string, workspaceBaseCidr: string, cidrChoice: string | undefined): boolean {
  if (!cidrChoice || cidrChoice === 'none') return true;
  return cidrChoice === workspaceBaseCidr || promptImpliesCurrentBase(prompt);
}

function promptLooksLikeEqualSplitRequest(prompt: string, prefixCandidates: number[], requestCandidates: CandidateRequest[]): boolean {
  return /\bsplit\b/i.test(prompt) && prefixCandidates.length > 0 && requestCandidates.length === 0;
}

function prefixForMinimumSubnetCount(basePrefix: number, subnetCount: number): number | null {
  if (!Number.isInteger(subnetCount) || subnetCount <= 0) return null;
  const borrowedBits = Math.ceil(Math.log2(Math.max(1, subnetCount)));
  const targetPrefix = basePrefix + borrowedBits;
  return targetPrefix <= 32 ? targetPrefix : null;
}

function extractCandidateRequests(prompt: string): CandidateRequest[] {
  const results: CandidateRequest[] = [];

  for (const pattern of HOST_PAIR_PATTERNS) {
    for (const match of prompt.matchAll(pattern)) {
      const name = normalizeCandidateName(match[1] ?? '');
      const hostsNeeded = Number(match[2]);
      if (!name || !Number.isInteger(hostsNeeded) || hostsNeeded <= 0) continue;
      results.push({ name, hostsNeeded });
    }
  }

  for (const segment of prompt.split(/[,;\n]+/)) {
    const cleaned = segment.trim();
    const match = cleaned.match(/([A-Za-z][A-Za-z0-9-]*(?: [A-Za-z0-9-]+){0,3})\s+(\d{1,6})(?:\s+hosts?)?$/i);
    if (!match) continue;

    const name = normalizeCandidateName(match[1] ?? '');
    const hostsNeeded = Number(match[2]);
    if (!name || !Number.isInteger(hostsNeeded) || hostsNeeded <= 0) continue;
    results.push({ name, hostsNeeded });
  }

  return unique(results.map(request => `${request.name}::${request.hostsNeeded}`)).map(entry => {
    const [name, hostsNeeded] = entry.split('::');
    return { name, hostsNeeded: Number(hostsNeeded) };
  });
}

function createIntentQuestion() {
  return {
    type: 'choice',
    instructions: {
      question: 'Which supported SubnetStudio automation action best matches `prompt`?',
      focus: 'Pick the single best next action the app can take safely without doing subnet math in the model.',
    },
    criteria: {
      'set-mode': {
        what: 'Switches between equal-split and VLSM modes.',
        examples: ['switch to vlsm', 'use equal split mode'],
      },
      'set-base-cidr': {
        what: 'Sets or changes the base network CIDR for the workspace.',
        examples: ['set the base network to 10.0.0.0/24'],
      },
      'set-equal-split-prefix': {
        what: 'Chooses the equal-split target prefix or the minimum equal-split needed to reach a requested subnet count.',
        examples: ['split this into /26s', 'use /27 subnets', 'split this current network into at least five subnets'],
      },
      'upsert-vlsm-request': {
        what: 'Adds or updates one named VLSM request with a host count.',
        examples: ['add guest 120 hosts'],
      },
      'batch-vlsm-requests': {
        what: 'Adds or updates several named VLSM requests in one command.',
        examples: ['guest 120, staff 60, printers 20'],
      },
      unsupported: {
        what: 'The prompt asks for something outside the supported automation slice or lacks enough data to act safely.',
      },
    },
  };
}

function createModeQuestion() {
  return {
    type: 'choice',
    instructions: 'If the prompt explicitly chooses a SubnetStudio mode, which mode is requested?',
    criteria: {
      'equal-split': 'Equal subnet splitting into same-size networks.',
      vlsm: 'Variable Length Subnet Masking using named host requirements.',
      none: 'The prompt does not clearly request a mode change.',
    },
  };
}

function createCidrQuestion(cidrCandidates: string[]) {
  const criteria = Object.fromEntries(
    cidrCandidates.map(candidate => [candidate, `Use ${candidate} as the base network CIDR.`]),
  ) as Record<string, string>;
  criteria.none = 'No candidate CIDR should be used as the base network.';

  return {
    type: 'choice',
    instructions: 'If the prompt sets a base network, which candidate CIDR is intended?',
    criteria,
  };
}

function createPrefixQuestion(prefixCandidates: number[]) {
  const criteria = Object.fromEntries(
    prefixCandidates.map(prefix => [String(prefix), `Use /${prefix} as the equal-split target prefix.`]),
  ) as Record<string, string>;
  criteria.none = 'No candidate prefix should be used as the equal-split target prefix.';

  return {
    type: 'choice',
    instructions: 'If the prompt specifies an explicit equal-split target prefix, which candidate prefix is intended?',
    criteria,
  };
}

function resolveDerivedPrefix(derivedPrefixCandidates: number[], explicitPrefixCandidates: number[]): number | null {
  if (explicitPrefixCandidates.length > 0) return null;
  const uniqueDerivedPrefixes = unique(derivedPrefixCandidates);
  return uniqueDerivedPrefixes.length === 1 ? uniqueDerivedPrefixes[0] : null;
}

function minConfidence(answers: ChoiceAnswer[]): number {
  return answers.reduce((min, answer) => Math.min(min, answer.confidence), 1);
}

function summarizeActions(actions: AutomationAction[]): string {
  return actions.map(action => {
    switch (action.intent) {
      case 'set-mode':
        return `set mode to ${action.mode}`;
      case 'set-base-cidr':
        return `set base network to ${action.cidr}`;
      case 'set-equal-split-prefix':
        return action.prefix === null ? 'clear equal split' : `set equal split to /${action.prefix}`;
      case 'upsert-vlsm-request':
        return `upsert VLSM request ${action.name} (${action.hostsNeeded} hosts)`;
      case 'batch-vlsm-requests':
        return `upsert ${action.requests.length} VLSM requests`;
      case 'unsupported':
        return action.reason;
    }
  }).join(' → ');
}

function requiresConfirmation(actions: AutomationAction[], confidence: number): boolean {
  if (confidence < 0.85) return true;
  if (actions.length !== 1) return true;

  switch (actions[0].intent) {
    case 'set-mode':
      return false;
    case 'set-equal-split-prefix':
      return confidence < 0.92;
    default:
      return true;
  }
}

function buildPlan(actions: AutomationAction[], confidence: number): AutomationPlan {
  return {
    summary: summarizeActions(actions),
    confidence,
    requiresConfirmation: requiresConfirmation(actions, confidence),
    actions,
  };
}

function unsupportedPlan(reason: string, confidence = 1): AutomationPlan {
  return buildPlan([{ intent: 'unsupported', reason }], confidence);
}

function buildReadyResponse(plan: AutomationPlan, message = plan.summary): AutomationInterpretResponse {
  return {
    ok: true,
    provider: 'typesafe',
    configured: isTypeSafeConfigured(),
    status: 'ready',
    message,
    supportedIntents: SUPPORTED_INTENTS,
    plan,
  };
}

function isAutomationMode(choice: string): choice is AutomationMode {
  return AUTOMATION_MODES.includes(choice as AutomationMode);
}

function resolveModeChoice(choice: string | undefined): AutomationMode | null | undefined {
  if (!choice || choice === 'none') return null;
  return isAutomationMode(choice) ? choice : undefined;
}

function parseCidrPrefix(cidr: string): number | null {
  const match = cidr.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!match) return null;

  const octets = match.slice(1, 5).map(Number);
  const prefix = Number(match[5]);
  if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  return prefix;
}

function resolveCidrChoice(choice: string | undefined, cidrCandidates: string[]): string | null | undefined {
  if (!choice || choice === 'none') return null;
  if (!cidrCandidates.includes(choice)) return undefined;
  return parseCidrPrefix(choice) === null ? undefined : choice;
}

function isValidEqualSplitPrefix(prefix: number, basePrefix: number): boolean {
  if (!Number.isInteger(prefix) || prefix <= basePrefix || prefix > 32) return false;
  return Math.pow(2, prefix - basePrefix) <= MAX_EQUAL_SPLIT_BLOCKS;
}

function resolveSelectedPrefix(
  prefixAnswer: ChoiceAnswer | undefined,
  explicitPrefixCandidates: number[],
  derivedPrefix: number | null,
  basePrefix: number,
): number | null | undefined {
  if (prefixAnswer && prefixAnswer.choice !== 'none') {
    const selectedPrefix = Number(prefixAnswer.choice);
    if (!Number.isInteger(selectedPrefix) || !explicitPrefixCandidates.includes(selectedPrefix)) {
      return undefined;
    }
    return isValidEqualSplitPrefix(selectedPrefix, basePrefix) ? selectedPrefix : undefined;
  }

  if (derivedPrefix === null) return null;
  return isValidEqualSplitPrefix(derivedPrefix, basePrefix) ? derivedPrefix : undefined;
}

/** Builds the backend readiness payload consumed by the frontend. */
export function buildHealthResponse(): AutomationHealthResponse {
  return {
    ok: true,
    provider: 'typesafe',
    configured: isTypeSafeConfigured(),
    ...(isDevelopment()
      ? {
          model: getModel(),
          apiUrl: getTypeSafeApiUrl(),
        }
      : {}),
    supportedIntents: SUPPORTED_INTENTS,
  };
}

/** Interprets a natural-language prompt into a deterministic SubnetStudio action plan. */
export async function interpretPrompt(request: AutomationInterpretRequest): Promise<AutomationInterpretResponse> {
  if (!isTypeSafeConfigured()) {
    return {
      ok: false,
      provider: 'typesafe',
      configured: false,
      status: 'not-configured',
      message: isDevelopment()
        ? 'Automation backend is running, but TYPESAFE_API_KEY is not configured on the server.'
        : 'Automation backend is not configured.',
      supportedIntents: SUPPORTED_INTENTS,
      plan: null,
    };
  }

  const { prompt, workspace } = request;
  const cidrCandidates = extractCidrs(prompt);
  const explicitPrefixCandidates = extractExplicitSplitPrefixes(prompt, cidrCandidates);
  const subnetCountCandidates = extractSubnetCounts(prompt);
  const derivedPrefixCandidates = subnetCountCandidates
    .map(count => prefixForMinimumSubnetCount(workspace.basePrefix, count))
    .filter((prefix): prefix is number => prefix !== null);
  const prefixCandidates = unique([...explicitPrefixCandidates, ...derivedPrefixCandidates]);
  const derivedPrefix = resolveDerivedPrefix(derivedPrefixCandidates, explicitPrefixCandidates);
  const requestCandidates = extractCandidateRequests(prompt);

  const questions: Record<string, unknown> = {
    intent: createIntentQuestion(),
    mode_choice: createModeQuestion(),
  };

  if (cidrCandidates.length > 0) {
    questions.cidr_choice = createCidrQuestion(cidrCandidates);
  }

  if (explicitPrefixCandidates.length > 0) {
    questions.prefix_choice = createPrefixQuestion(explicitPrefixCandidates);
  }

  const response = await callTypeSafeSystemOne({
    state: {
      prompt,
      cidrCandidates,
      prefixCandidates,
      subnetCountCandidates,
      workspace,
      vlsmRequestCandidates: requestCandidates,
      supportedIntents: SUPPORTED_INTENTS,
    },
    model: getModel(),
    questions,
  });

  const forceEqualSplitIntent = promptLooksLikeEqualSplitRequest(prompt, prefixCandidates, requestCandidates);
  const intentChoice =
    forceEqualSplitIntent && (response.answers.intent.choice === 'unsupported' || response.answers.intent.choice === 'set-base-cidr')
      ? 'set-equal-split-prefix'
      : response.answers.intent.choice;

  const intentAnswer = response.answers.intent;
  const modeAnswer = response.answers.mode_choice;
  const cidrAnswer = response.answers.cidr_choice;
  const prefixAnswer = response.answers.prefix_choice;
  const resolvedModeChoice = resolveModeChoice(modeAnswer?.choice);
  const resolvedCidrChoice = resolveCidrChoice(cidrAnswer?.choice, cidrCandidates);
  const resolvedCidrPrefix = resolvedCidrChoice ? parseCidrPrefix(resolvedCidrChoice) : null;

  switch (intentChoice as AutomationIntent) {
    case 'set-mode': {
      if (!modeAnswer || modeAnswer.choice === 'none') {
        return buildReadyResponse(
          unsupportedPlan('The prompt asked for a mode change, but no supported mode was identified.', intentAnswer.confidence),
        );
      }

      if (!resolvedModeChoice) {
        return buildReadyResponse(
          unsupportedPlan('The provider returned an unsupported mode choice.', minConfidence([intentAnswer, modeAnswer])),
        );
      }

      return buildReadyResponse(
        buildPlan([{ intent: 'set-mode', mode: resolvedModeChoice }], minConfidence([intentAnswer, modeAnswer])),
      );
    }

    case 'set-base-cidr': {
      if (!cidrAnswer || cidrAnswer.choice === 'none') {
        return buildReadyResponse(
          unsupportedPlan('The prompt asked to change the base CIDR, but no CIDR candidate was identified.', intentAnswer.confidence),
        );
      }

      if (!resolvedCidrChoice || resolvedCidrPrefix === null) {
        return buildReadyResponse(
          unsupportedPlan('The provider returned an unsupported base CIDR choice.', minConfidence([intentAnswer, cidrAnswer])),
        );
      }

      if (modeAnswer && modeAnswer.choice !== 'none' && !resolvedModeChoice) {
        return buildReadyResponse(
          unsupportedPlan('The provider returned an unsupported mode choice.', minConfidence([intentAnswer, modeAnswer, cidrAnswer])),
        );
      }

      const selectedPrefix = resolveSelectedPrefix(
        prefixAnswer,
        explicitPrefixCandidates,
        derivedPrefix,
        resolvedCidrPrefix,
      );
      if (selectedPrefix === undefined) {
        return buildReadyResponse(
          unsupportedPlan('The provider returned an invalid equal-split prefix for the selected base network.', minConfidence([intentAnswer, cidrAnswer, ...(prefixAnswer ? [prefixAnswer] : [])])),
        );
      }

      const actions: AutomationAction[] = [{ intent: 'set-base-cidr', cidr: resolvedCidrChoice }];
      if (resolvedModeChoice) {
        actions.unshift({ intent: 'set-mode', mode: resolvedModeChoice });
      }
      if (selectedPrefix !== null) {
        actions.push({ intent: 'set-equal-split-prefix', prefix: selectedPrefix });
      }

      return buildReadyResponse(buildPlan(actions, minConfidence([
        intentAnswer,
        cidrAnswer,
        ...(modeAnswer && modeAnswer.choice !== 'none' ? [modeAnswer] : []),
        ...(prefixAnswer && prefixAnswer.choice !== 'none' ? [prefixAnswer] : []),
      ])));
    }

    case 'set-equal-split-prefix': {
      if (cidrAnswer && cidrAnswer.choice !== 'none' && (!resolvedCidrChoice || resolvedCidrPrefix === null)) {
        return buildReadyResponse(
          unsupportedPlan('The provider returned an unsupported base CIDR choice.', minConfidence([intentAnswer, cidrAnswer])),
        );
      }

      const effectiveBasePrefix =
        resolvedCidrChoice && resolvedCidrPrefix !== null && !shouldKeepCurrentBase(prompt, workspace.baseCidr, resolvedCidrChoice)
          ? resolvedCidrPrefix
          : workspace.basePrefix;
      const selectedPrefix = resolveSelectedPrefix(
        prefixAnswer,
        explicitPrefixCandidates,
        derivedPrefix,
        effectiveBasePrefix,
      );

      if (selectedPrefix === undefined) {
        return buildReadyResponse(
          unsupportedPlan('The provider returned an invalid equal-split prefix for the selected base network.', minConfidence([intentAnswer, ...(prefixAnswer ? [prefixAnswer] : [])])),
        );
      }

      if (selectedPrefix === null) {
        return buildReadyResponse(
          unsupportedPlan('The prompt asked for an equal-split prefix, but no target prefix was identified.', intentAnswer.confidence),
        );
      }

      const actions: AutomationAction[] = [];
      if (resolvedCidrChoice && !shouldKeepCurrentBase(prompt, workspace.baseCidr, resolvedCidrChoice)) {
        actions.push({ intent: 'set-base-cidr', cidr: resolvedCidrChoice });
      }
      actions.push({ intent: 'set-equal-split-prefix', prefix: selectedPrefix });

      return buildReadyResponse(buildPlan(actions, minConfidence([
        intentAnswer,
        ...(prefixAnswer && prefixAnswer.choice !== 'none' ? [prefixAnswer] : []),
        ...(resolvedCidrChoice && !shouldKeepCurrentBase(prompt, workspace.baseCidr, resolvedCidrChoice) && cidrAnswer ? [cidrAnswer] : []),
      ])));
    }

    case 'upsert-vlsm-request': {
      const request = requestCandidates[0];
      if (!request) {
        return buildReadyResponse(
          unsupportedPlan('The prompt asked for a VLSM request, but no name/host pair could be extracted safely.', intentAnswer.confidence),
        );
      }

      if (cidrAnswer && cidrAnswer.choice !== 'none' && !resolvedCidrChoice) {
        return buildReadyResponse(
          unsupportedPlan('The provider returned an unsupported base CIDR choice.', minConfidence([intentAnswer, cidrAnswer])),
        );
      }

      const actions: AutomationAction[] = [];
      if (resolvedModeChoice === 'vlsm') {
        actions.push({ intent: 'set-mode', mode: 'vlsm' });
      }
      if (resolvedCidrChoice) {
        actions.push({ intent: 'set-base-cidr', cidr: resolvedCidrChoice });
      }
      actions.push({
        intent: 'upsert-vlsm-request',
        name: request.name,
        hostsNeeded: request.hostsNeeded,
      });

      return buildReadyResponse(buildPlan(actions, minConfidence([
        intentAnswer,
        ...(resolvedModeChoice === 'vlsm' && modeAnswer ? [modeAnswer] : []),
        ...(resolvedCidrChoice && cidrAnswer ? [cidrAnswer] : []),
      ])));
    }

    case 'batch-vlsm-requests': {
      if (requestCandidates.length === 0) {
        return buildReadyResponse(
          unsupportedPlan('The prompt asked for multiple VLSM requests, but no safe name/host pairs could be extracted.', intentAnswer.confidence),
        );
      }

      if (cidrAnswer && cidrAnswer.choice !== 'none' && !resolvedCidrChoice) {
        return buildReadyResponse(
          unsupportedPlan('The provider returned an unsupported base CIDR choice.', minConfidence([intentAnswer, cidrAnswer])),
        );
      }

      const actions: AutomationAction[] = [];
      if (resolvedModeChoice === 'vlsm') {
        actions.push({ intent: 'set-mode', mode: 'vlsm' });
      }
      if (resolvedCidrChoice) {
        actions.push({ intent: 'set-base-cidr', cidr: resolvedCidrChoice });
      }
      actions.push({
        intent: 'batch-vlsm-requests',
        requests: requestCandidates,
      });

      return buildReadyResponse(buildPlan(actions, minConfidence([
        intentAnswer,
        ...(resolvedModeChoice === 'vlsm' && modeAnswer ? [modeAnswer] : []),
        ...(resolvedCidrChoice && cidrAnswer ? [cidrAnswer] : []),
      ])));
    }

    case 'unsupported':
    default:
      return buildReadyResponse(
        unsupportedPlan('This request falls outside the supported automation slice for the current branch.', intentAnswer.confidence),
      );
  }
}
