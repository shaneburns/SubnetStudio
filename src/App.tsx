import React, { useRef, useState, useEffect } from 'react';

function useClock() {
  const [time, setTime] = useState(() => new Date().toString().slice(0, 24));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toString().slice(0, 24)), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

import { useNetworkState } from './state/useNetworkState';
import { useTheme } from './state/useTheme';
import {
  subnetInfo,
  intToIp,
  ipToInt,
  maskFromPrefix,
  SubnetInfo,
} from './domain/ipv4';
import { allocateVLSM, Allocation, UnallocatedRange } from './domain/vlsm';
import { Header } from './components/Layout/Header';
import { CidrInput } from './components/Input/CidrInput';
import { QuickFacts } from './components/Display/QuickFacts';
import { BitRuler } from './components/Display/BitRuler';
import { BlockMap } from './components/Display/BlockMap';
import { RangeReport } from './components/Display/RangeReport';
import { VlsmRow } from './components/Vlsm/VlsmRow';
import { BitNoise } from './components/Background/BitNoise';
import { SettingsModal } from './components/Settings/SettingsModal';
import './index.css';

// ── Extended block shape used by visual components ──────────────────────────
interface ExtendedBlock extends SubnetInfo {
  name?: string;
  status?: 'allocated' | 'conflict' | 'overflow';
  isRemainder?: boolean;
}

const App = () => {
  const {
    state,
    updateBase,
    updateMode,
    updateEqualSplit,
    addVlsmRequest,
    removeVlsmRequest,
    reorderVlsmRequests,
    updateVlsmRequest,
    setSelectedBlockIdx,
  } = useNetworkState();

  const clock = useClock();

  // ── Theme ──────────────────────────────────────────────────────────────────
  const { themeId, theme, setTheme } = useTheme();

  // ── Settings modal ─────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Tracks which VLSM row is being dragged so the drop handler knows both IDs
  const dragSourceId = useRef<string | null>(null);

  // ── VLSM search ─────────────────────────────────────────────────────────
  const [vlsmSearch, setVlsmSearch] = useState('');

  // ── VLSM allocation (only in vlsm mode) ─────────────────────────────────
  const { allocations, unallocated } = React.useMemo(() => {
    if (state.mode === 'equal-split') return { allocations: [] as Allocation[], unallocated: null as UnallocatedRange | null };
    return allocateVLSM(state.base, state.vlsmRequests);
  }, [state.mode, state.base, state.vlsmRequests]);

  // id → Allocation map so VlsmRows look up by id, not array position
  const allocationById = React.useMemo(() => {
    const map = new Map<string, Allocation>();
    for (const a of allocations) map.set(a.id, a);
    return map;
  }, [allocations]);

  // Filtered VLSM requests for display (search doesn't affect allocation computation)
  const filteredVlsmRequests = React.useMemo(() => {
    if (!vlsmSearch.trim()) return state.vlsmRequests;
    const q = vlsmSearch.trim().toLowerCase();
    return state.vlsmRequests.filter(req => {
      if (req.name.toLowerCase().includes(q)) return true;
      const alloc = allocationById.get(req.id);
      if (alloc && alloc.network !== 'N/A' && alloc.network.includes(q)) return true;
      if (alloc && `/${alloc.derivedPrefix}`.includes(q)) return true;
      return false;
    });
  }, [state.vlsmRequests, vlsmSearch, allocationById]);

  // ── Unified block list for visual components ─────────────────────────────
  const currentBlocks: ExtendedBlock[] = React.useMemo(() => {
    if (state.mode === 'equal-split') {
      if (!state.equalSplitPrefix) {
        return [subnetInfo(state.base.ip, state.base.prefix)];
      }
      const count = Math.pow(2, state.equalSplitPrefix - state.base.prefix);
      const step  = Math.pow(2, 32 - state.equalSplitPrefix);
      const base  = subnetInfo(state.base.ip, state.base.prefix);
      const blocks: ExtendedBlock[] = [];
      for (let i = 0; i < count; i++) {
        blocks.push(subnetInfo(intToIp(base.networkInt + i * step), state.equalSplitPrefix));
      }
      return blocks;
    }

    // VLSM mode — allocations are sorted by size; remainders follow
    const allocBlocks: ExtendedBlock[] = allocations.map(a => {
      if (a.network === 'N/A') {
        return {
          network: 'N/A', networkInt: 0,
          broadcast: 'N/A', broadcastInt: 0,
          mask: 'N/A', wildcard: 'N/A',
          first: 'N/A', last: 'N/A',
          usable: 0, total: 0, prefix: a.derivedPrefix,
          name: a.name, status: a.status, isRemainder: false,
        };
      }
      const netInt = ipToInt(a.network);
      const mask   = maskFromPrefix(a.derivedPrefix);
      return {
        network: a.network, networkInt: netInt,
        broadcast: a.broadcast, broadcastInt: ipToInt(a.broadcast),
        mask: a.mask ?? intToIp(mask),
        wildcard: a.wildcard ?? intToIp(~mask >>> 0),
        first: a.first, last: a.last,
        usable: a.usable,
        total: Math.pow(2, 32 - a.derivedPrefix),
        prefix: a.derivedPrefix,
        name: a.name, status: a.status, isRemainder: false,
      };
    });

    // Single unallocated remainder block
    const remBlocks: ExtendedBlock[] = [];
    if (unallocated) {
      remBlocks.push({
        network:      unallocated.firstAddr,
        networkInt:   unallocated.firstInt,
        broadcast:    unallocated.lastAddr,
        broadcastInt: unallocated.lastInt,
        mask:         '—',
        wildcard:     '—',
        first:        unallocated.firstAddr,
        last:         unallocated.lastAddr,
        usable:       unallocated.total,
        total:        unallocated.total,
        prefix:       unallocated.coverPrefix,
        name:         'Unallocated',
        status:       'allocated' as const,
        isRemainder:  true,
      });
    }

    return [...allocBlocks, ...remBlocks];
  }, [state.mode, state.base, state.equalSplitPrefix, allocations, unallocated]);

  // ── Selected block/subnet ────────────────────────────────────────────────
  const selectedIdx   = Math.min(state.selectedBlockIdx, Math.max(0, currentBlocks.length - 1));
  const selectedBlock = currentBlocks[selectedIdx] ?? currentBlocks[0] ?? null;

  const selectedAllocationForRuler =
    state.mode === 'vlsm' && selectedBlock && !selectedBlock.isRemainder
      ? (selectedBlock as SubnetInfo)
      : null;

  return (
    <>
      {/* ── Animated background (receives live theme noise config) ── */}
      <BitNoise config={theme.noise} />

      {/* ── Portal roots ── */}
      <div id="blockmap-tooltip-root"  style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }} />
      <div id="settings-modal-root"    style={{ position: 'fixed', inset: 0, pointerEvents: settingsOpen ? 'auto' : 'none', zIndex: 10000 }} />

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <SettingsModal
          currentThemeId={themeId}
          onThemeChange={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* ── App content (above the canvas) ── */}
      <div className="app-content">
        <Header
          mode={state.mode}
          setMode={updateMode}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="layout">
          {/* ── LEFT RAIL ── */}
          <div className="rail">
            <CidrInput
              base={state.base}
              updateBase={updateBase}
            />
            <QuickFacts
              selectedSubnet={selectedBlock}
              basePrefix={state.base.prefix}
            />
          </div>

          {/* ── MAIN COLUMN ── */}
          <div className="main-col">
            <BitRuler
              base={state.base}
              prefix={state.base.prefix}
              onPrefixChange={(p) => updateBase(state.base.ip, p)}
              selectedAllocation={selectedAllocationForRuler}
              mode={state.mode}
            />

            {/* ── VLSM ALLOCATOR ── */}
            {state.mode === 'vlsm' && (
              <div className="panel">
                <div className="vlsm-panel-head">
                  <p className="label" style={{ margin: 0 }}>VLSM Allocator</p>
                  <div className="vlsm-search-wrap">
                    <span className="vlsm-search-icon">⌕</span>
                    <input
                      className="vlsm-search"
                      type="text"
                      placeholder="search segments…"
                      value={vlsmSearch}
                      onChange={e => setVlsmSearch(e.target.value)}
                    />
                    {vlsmSearch && (
                      <button
                        className="vlsm-search-clear"
                        onClick={() => setVlsmSearch('')}
                        title="Clear search"
                      >×</button>
                    )}
                  </div>
                </div>

                <div className="vlsm-editor">
                  <div className="vlsm-sorted-indicator">
                    Auto-sorted by size (largest first) — drag rows to reorder
                    {vlsmSearch && (
                      <span style={{ color: 'var(--network)', marginLeft: '8px' }}>
                        · {filteredVlsmRequests.length} of {state.vlsmRequests.length} shown
                      </span>
                    )}
                  </div>

                  {state.vlsmRequests.length === 0 && (
                    <div className="vlsm-empty">
                      <div className="vlsm-empty__icon">⊕</div>
                      <div>Add a requirement below, enter the number of hosts needed,</div>
                      <div>and SubnetStudio will allocate the smallest fitting subnet.</div>
                    </div>
                  )}

                  {state.vlsmRequests.length > 0 && filteredVlsmRequests.length === 0 && (
                    <div className="vlsm-empty">
                      <div style={{ color: 'var(--muted-2)' }}>
                        No segments match "{vlsmSearch}"
                      </div>
                    </div>
                  )}

                  {filteredVlsmRequests.map(req => (
                    <VlsmRow
                      key={req.id}
                      req={req}
                      allocation={allocationById.get(req.id)}
                      updateRequest={updateVlsmRequest}
                      removeRequest={removeVlsmRequest}
                      onDragStart={(id) => { dragSourceId.current = id; }}
                      onDrop={(targetId) => {
                        if (dragSourceId.current && dragSourceId.current !== targetId) {
                          reorderVlsmRequests(dragSourceId.current, targetId);
                        }
                        dragSourceId.current = null;
                      }}
                    />
                  ))}

                  <button
                    className="btn"
                    onClick={() => addVlsmRequest('New segment', 0)}
                  >+ Add requirement</button>
                </div>
              </div>
            )}

            <BlockMap
              blocks={currentBlocks}
              selectedIdx={selectedIdx}
              onSelect={setSelectedBlockIdx}
              mode={state.mode}
              allocations={allocations}
              equalSplitPrefix={state.equalSplitPrefix}
              basePrefix={state.base.prefix}
              onSplitChange={updateEqualSplit}
            />

            <RangeReport
              blocks={currentBlocks}
              selectedIdx={selectedIdx}
              onSelect={setSelectedBlockIdx}
              mode={state.mode}
              allocations={allocations}
            />
          </div>
        </div>

        <footer>
          <span>Runs entirely in your browser — nothing is sent or stored</span>
          <span id="clock">{clock}</span>
        </footer>
      </div>
    </>
  );
};

export default App;
