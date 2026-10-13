import { useState, useCallback } from 'react';
import { BaseNetwork, parseCIDR } from '../domain/ipv4';
import { AllocationRequest } from '../domain/vlsm';
import { MAX_EQUAL_SPLIT_BLOCKS } from '../lib/prefixOptions';
import { AutomationAction, AutomationPlan } from '../types/automation';

export type NetworkState = {
  base: BaseNetwork;
  mode: 'equal-split' | 'vlsm';
  equalSplitPrefix: number | null;
  vlsmRequests: AllocationRequest[];
  selectedBlockIdx: number;
};

/** Result returned after attempting to apply an automation plan locally. */
export type ApplyAutomationPlanResult = {
  ok: boolean;
  applied: number;
  message: string;
};

/** Result of applying an automation plan to a specific state snapshot. */
export type ApplyAutomationPlanToStateResult = ApplyAutomationPlanResult & {
  state: NetworkState;
};

function normalizeSegmentName(name: string): string {
  return name.trim().toLowerCase();
}

function equalSplitBlockCount(basePrefix: number, splitPrefix: number): number {
  return Math.pow(2, splitPrefix - basePrefix);
}

function normalizeEqualSplitPrefix(prefix: number | null, basePrefix: number): number | null {
  if (prefix === null) return null;
  if (!Number.isInteger(prefix) || prefix <= basePrefix || prefix > 32) return null;
  if (equalSplitBlockCount(basePrefix, prefix) > MAX_EQUAL_SPLIT_BLOCKS) return null;
  return prefix;
}

function validateEqualSplitPrefix(prefix: number | null, basePrefix: number): string | null {
  if (prefix === null) return null;
  if (!Number.isInteger(prefix) || prefix <= basePrefix || prefix > 32) {
    return `Split prefix /${prefix} is not valid for base /${basePrefix}.`;
  }

  const blockCount = equalSplitBlockCount(basePrefix, prefix);
  if (blockCount > MAX_EQUAL_SPLIT_BLOCKS) {
    return `Split prefix /${prefix} would generate ${blockCount.toLocaleString()} blocks, exceeding the limit of ${MAX_EQUAL_SPLIT_BLOCKS.toLocaleString()}.`;
  }

  return null;
}

function upsertVlsmRequest(
  requests: AllocationRequest[],
  name: string,
  hostsNeeded: number,
): AllocationRequest[] {
  const normalizedName = normalizeSegmentName(name);
  const existingIdx = requests.findIndex(req => normalizeSegmentName(req.name) === normalizedName);

  if (existingIdx >= 0) {
    return requests.map((req, idx) =>
      idx === existingIdx ? { ...req, name: name.trim(), hostsNeeded } : req,
    );
  }

  return [
    ...requests,
    {
      id: crypto.randomUUID(),
      name: name.trim(),
      hostsNeeded,
      order: requests.length,
    },
  ];
}

/** Applies one deterministic automation action to a given network state snapshot. */
export function applyAutomationActionToState(state: NetworkState, action: AutomationAction): {
  ok: boolean;
  state: NetworkState;
  message: string;
} {
  switch (action.intent) {
    case 'set-mode':
      return {
        ok: true,
        state: { ...state, mode: action.mode, selectedBlockIdx: 0 },
        message: `Mode set to ${action.mode}.`,
      };

    case 'set-base-cidr': {
      const parsed = parseCIDR(action.cidr);
      if (!parsed) {
        return {
          ok: false,
          state,
          message: `Invalid CIDR: ${action.cidr}`,
        };
      }

      return {
        ok: true,
        state: {
          ...state,
          base: parsed,
          equalSplitPrefix: normalizeEqualSplitPrefix(state.equalSplitPrefix, parsed.prefix),
          selectedBlockIdx: 0,
        },
        message: `Base network set to ${action.cidr}.`,
      };
    }

    case 'set-equal-split-prefix': {
      const validationError = validateEqualSplitPrefix(action.prefix, state.base.prefix);
      if (validationError) {
        return {
          ok: false,
          state,
          message: validationError,
        };
      }

      return {
        ok: true,
        state: {
          ...state,
          equalSplitPrefix: action.prefix,
          selectedBlockIdx: 0,
        },
        message:
          action.prefix === null
            ? 'Equal split cleared.'
            : `Equal split prefix set to /${action.prefix}.`,
      };
    }

    case 'upsert-vlsm-request': {
      const name = action.name.trim();
      const hostsNeeded = Math.floor(action.hostsNeeded);
      if (!name || hostsNeeded <= 0) {
        return {
          ok: false,
          state,
          message: 'VLSM requests require a non-empty name and a positive host count.',
        };
      }

      return {
        ok: true,
        state: {
          ...state,
          mode: 'vlsm',
          vlsmRequests: upsertVlsmRequest(state.vlsmRequests, name, hostsNeeded),
          selectedBlockIdx: 0,
        },
        message: `Updated VLSM requirement ${name} (${hostsNeeded} hosts).`,
      };
    }

    case 'batch-vlsm-requests': {
      if (action.requests.length === 0) {
        return {
          ok: false,
          state,
          message: 'Batch VLSM updates require at least one request.',
        };
      }

      let nextRequests = state.vlsmRequests;
      for (const request of action.requests) {
        const name = request.name.trim();
        const hostsNeeded = Math.floor(request.hostsNeeded);
        if (!name || hostsNeeded <= 0) {
          return {
            ok: false,
            state,
            message: 'Every VLSM request in a batch must have a non-empty name and positive host count.',
          };
        }
        nextRequests = upsertVlsmRequest(nextRequests, name, hostsNeeded);
      }

      return {
        ok: true,
        state: {
          ...state,
          mode: 'vlsm',
          vlsmRequests: nextRequests,
          selectedBlockIdx: 0,
        },
        message: `Updated ${action.requests.length} VLSM requirements.`,
      };
    }

    case 'unsupported':
      return {
        ok: false,
        state,
        message: action.reason,
      };
  }
}

/** Applies a multi-step automation plan to a given network state snapshot. */
export function applyAutomationPlanToState(state: NetworkState, plan: AutomationPlan): ApplyAutomationPlanToStateResult {
  let nextState = state;
  let applied = 0;
  let message = plan.summary;

  for (const action of plan.actions) {
    const result = applyAutomationActionToState(nextState, action);
    if (!result.ok) {
      return {
        ok: false,
        applied,
        message: result.message,
        state,
      };
    }

    nextState = result.state;
    applied += 1;
    message = result.message;
  }

  return {
    ok: true,
    applied,
    message,
    state: nextState,
  };
}

export function useNetworkState() {
  const [state, setState] = useState<NetworkState>({
    base: { ip: '192.168.1.0', prefix: 24 },
    mode: 'equal-split',
    equalSplitPrefix: null,
    vlsmRequests: [],
    selectedBlockIdx: 0,
  });

  const updateBase = useCallback((ip: string, prefix: number) => {
    setState(prev => ({
      ...prev,
      base: { ip, prefix },
      equalSplitPrefix: normalizeEqualSplitPrefix(prev.equalSplitPrefix, prefix),
      selectedBlockIdx: 0,
    }));
  }, []);

  const updateMode = useCallback((mode: 'equal-split' | 'vlsm') => {
    setState(prev => ({ ...prev, mode, selectedBlockIdx: 0 }));
  }, []);

  const updateEqualSplit = useCallback((prefix: number | null) => {
    setState(prev => {
      const nextPrefix = normalizeEqualSplitPrefix(prefix, prev.base.prefix);
      return prefix !== null && nextPrefix === null
        ? prev
        : { ...prev, equalSplitPrefix: nextPrefix, selectedBlockIdx: 0 };
    });
  }, []);

  const addVlsmRequest = useCallback((name: string, hosts: number) => {
    const id = crypto.randomUUID();
    setState(prev => ({
      ...prev,
      vlsmRequests: [
        ...prev.vlsmRequests,
        { id, name, hostsNeeded: hosts, order: prev.vlsmRequests.length },
      ],
    }));
  }, []);

  const removeVlsmRequest = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      vlsmRequests: prev.vlsmRequests.filter(r => r.id !== id),
      selectedBlockIdx: 0,
    }));
  }, []);

  const reorderVlsmRequests = useCallback((dragId: string, dropId: string) => {
    if (dragId === dropId) return;
    setState(prev => {
      const requests = [...prev.vlsmRequests];
      const dragIndex = requests.findIndex(r => r.id === dragId);
      const dropIndex = requests.findIndex(r => r.id === dropId);
      if (dragIndex === -1 || dropIndex === -1) return prev;
      const [dragged] = requests.splice(dragIndex, 1);
      requests.splice(dropIndex, 0, dragged);
      return { ...prev, vlsmRequests: requests };
    });
  }, []);

  const updateVlsmRequest = useCallback((id: string, updates: Partial<AllocationRequest>) => {
    setState(prev => ({
      ...prev,
      vlsmRequests: prev.vlsmRequests.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
  }, []);

  const setSelectedBlockIdx = useCallback((idx: number) => {
    setState(prev => ({ ...prev, selectedBlockIdx: idx }));
  }, []);

  const applyAutomationPlan = useCallback((plan: AutomationPlan): ApplyAutomationPlanResult => {
    const result = applyAutomationPlanToState(state, plan);
    if (result.ok) {
      setState(result.state);
    }

    return {
      ok: result.ok,
      applied: result.applied,
      message: result.message,
    };
  }, [state]);

  return {
    state,
    updateBase,
    updateMode,
    updateEqualSplit,
    addVlsmRequest,
    removeVlsmRequest,
    reorderVlsmRequests,
    updateVlsmRequest,
    setSelectedBlockIdx,
    applyAutomationPlan,
  };
}
