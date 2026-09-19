/** Supported automation modes inside the SubnetStudio UI. */
export type AutomationMode = 'equal-split' | 'vlsm';

/** Supported first-slice intents for the TypeSafe automation backend. */
export type AutomationIntent =
  | 'set-mode'
  | 'set-base-cidr'
  | 'set-equal-split-prefix'
  | 'upsert-vlsm-request'
  | 'batch-vlsm-requests'
  | 'unsupported';

/** Lightweight workspace context sent alongside a natural-language command. */
export interface AutomationWorkspaceContext {
  baseCidr: string;
  basePrefix: number;
  mode: AutomationMode;
  equalSplitPrefix: number | null;
}

/** Prompt payload sent from the frontend to the automation backend. */
export interface AutomationInterpretRequest {
  prompt: string;
  workspace: AutomationWorkspaceContext;
}

/** Switches the app between equal-split and VLSM workflows. */
export interface SetModeAction {
  intent: 'set-mode';
  mode: AutomationMode;
}

/** Sets the base network CIDR used by all calculations. */
export interface SetBaseCidrAction {
  intent: 'set-base-cidr';
  cidr: string;
}

/** Sets or clears the equal-split target prefix. */
export interface SetEqualSplitPrefixAction {
  intent: 'set-equal-split-prefix';
  prefix: number | null;
}

/** Adds or updates a single VLSM requirement by segment name. */
export interface UpsertVlsmRequestAction {
  intent: 'upsert-vlsm-request';
  name: string;
  hostsNeeded: number;
}

/** Adds or updates several VLSM requirements in one deterministic batch. */
export interface BatchVlsmRequestsAction {
  intent: 'batch-vlsm-requests';
  requests: Array<{
    name: string;
    hostsNeeded: number;
  }>;
}

/** Represents a request the current automation slice cannot safely execute. */
export interface UnsupportedAction {
  intent: 'unsupported';
  reason: string;
}

/** One deterministic step that the frontend can apply without AI. */
export type AutomationAction =
  | SetModeAction
  | SetBaseCidrAction
  | SetEqualSplitPrefixAction
  | UpsertVlsmRequestAction
  | BatchVlsmRequestsAction
  | UnsupportedAction;

/** A confidence-scored execution plan produced by the automation backend. */
export interface AutomationPlan {
  summary: string;
  confidence: number;
  requiresConfirmation: boolean;
  actions: AutomationAction[];
}

/** Health payload returned by the automation backend readiness endpoint. */
export interface AutomationHealthResponse {
  ok: true;
  provider: 'typesafe';
  configured: boolean;
  model: string;
  apiUrl: string;
  supportedIntents: AutomationIntent[];
}

/** Interpretation response returned by the automation backend. */
export interface AutomationInterpretResponse {
  ok: boolean;
  provider: 'typesafe';
  configured: boolean;
  status: 'ready' | 'not-configured' | 'invalid-request' | 'error';
  message: string;
  supportedIntents: AutomationIntent[];
  plan: AutomationPlan | null;
}
