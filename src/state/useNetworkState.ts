import { useState, useCallback } from 'react';
import { BaseNetwork } from '../domain/ipv4';
import { AllocationRequest } from '../domain/vlsm';

export type NetworkState = {
  base: BaseNetwork;
  mode: 'equal-split' | 'vlsm';
  equalSplitPrefix: number | null;
  vlsmRequests: AllocationRequest[];
  selectedBlockIdx: number;
};

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
      // If the current split prefix is no longer valid for the new base prefix, clear it
      equalSplitPrefix:
        prev.equalSplitPrefix !== null && prev.equalSplitPrefix <= prefix
          ? null
          : prev.equalSplitPrefix,
      selectedBlockIdx: 0,
    }));
  }, []);

  const updateMode = useCallback((mode: 'equal-split' | 'vlsm') => {
    setState(prev => ({ ...prev, mode, selectedBlockIdx: 0 }));
  }, []);

  const updateEqualSplit = useCallback((prefix: number | null) => {
    setState(prev => ({ ...prev, equalSplitPrefix: prefix, selectedBlockIdx: 0 }));
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

  // dragId = item being dragged, dropId = item it was dropped onto
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
  };
}
