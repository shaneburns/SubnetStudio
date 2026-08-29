import React, { useMemo, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { SubnetInfo } from '../../domain/ipv4';
import { Allocation } from '../../domain/vlsm';
import { CidrHighlight } from '../Shared/CidrHighlight';
import { Paginator } from '../Shared/Paginator';
import { usePagination } from '../../state/usePagination';

interface ExtendedBlock extends SubnetInfo {
  name?: string;
  status?: 'allocated' | 'conflict' | 'overflow';
  isRemainder?: boolean;
}

interface BlockMapProps {
  blocks: ExtendedBlock[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  mode: 'equal-split' | 'vlsm';
  allocations?: Allocation[];
  equalSplitPrefix?: number | null;
  basePrefix?: number;
  onSplitChange?: (prefix: number | null) => void;
}

const COMMON_PREFIXES   = [8, 16, 20, 24, 25, 26, 27, 28, 30];
const COMPACT_THRESHOLD = 32;
const PAGE_SIZE_BAR     = 32;   // blocks per page in bar view
const PAGE_SIZE_TILE    = 128;  // tiles per page in compact view

// ── Tooltip ───────────────────────────────────────────────────────────────────
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  block: ExtendedBlock | null;
  idx: number;
}

function BlockTooltip({ state }: { state: TooltipState }) {
  if (!state.visible || !state.block) return null;
  const blk = state.block;
  const isNA = blk.network === 'N/A';

  const statusLabel =
    blk.isRemainder          ? 'Unallocated'
    : blk.status === 'overflow'  ? 'Overflow'
    : blk.status === 'conflict'  ? 'Conflict'
    : 'Allocated';

  const statusColor =
    blk.isRemainder              ? 'var(--muted-2)'
    : blk.status === 'overflow'  ? 'var(--error)'
    : blk.status === 'conflict'  ? 'var(--status-conflict)'
    : 'var(--host)';

  const TW  = 248;
  const PAD = 14;
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  let tx = state.x + 14;
  let ty = state.y + 14;
  if (tx + TW + PAD > vw) tx = state.x - TW - 10;
  if (ty + 230     > vh)  ty = state.y - 230;

  const el = document.getElementById('blockmap-tooltip-root');
  if (!el) return null;

  return ReactDOM.createPortal(
    <div className="bm-tooltip" style={{ left: tx, top: ty, width: TW }}>
      <div className="bm-tooltip__header">
        <span className="bm-tooltip__idx">#{state.idx + 1}</span>
        {blk.name && <span className="bm-tooltip__name">{blk.name}</span>}
        <span className="bm-tooltip__status" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      {!isNA ? (
        <>
          <div className="bm-tooltip__cidr">
            <CidrHighlight value={`${blk.network}/${blk.prefix}`} />
          </div>
          <div className="bm-tooltip__rows">
            <div className="bm-tooltip__row"><span>Netmask</span><span className="mono">{blk.mask}</span></div>
            <div className="bm-tooltip__row"><span>Network</span><span className="mono">{blk.network}</span></div>
            <div className="bm-tooltip__row"><span>Broadcast</span><span className="mono">{blk.broadcast}</span></div>
            <div className="bm-tooltip__row"><span>First host</span><span className="mono">{blk.first}</span></div>
            <div className="bm-tooltip__row"><span>Last host</span><span className="mono">{blk.last}</span></div>
            <div className="bm-tooltip__row bm-tooltip__row--accent">
              <span>Usable hosts</span><span className="mono">{blk.usable.toLocaleString()}</span>
            </div>
            <div className="bm-tooltip__row">
              <span>Total addrs</span><span className="mono">{blk.total.toLocaleString()}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="bm-tooltip__cidr bm-tooltip__cidr--na">overflow — base too small</div>
      )}
    </div>,
    el
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export const BlockMap = ({
  blocks,
  selectedIdx,
  onSelect,
  mode,
  allocations = [],
  equalSplitPrefix,
  basePrefix = 0,
  onSplitChange,
}: BlockMapProps) => {
  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, block: null, idx: 0,
  });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback((e: React.MouseEvent, blk: ExtendedBlock, idx: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setTooltip({ visible: true, x: e.clientX, y: e.clientY, block: blk, idx });
  }, []);

  const moveTooltip = useCallback((e: React.MouseEvent) => {
    setTooltip(prev => prev.visible ? { ...prev, x: e.clientX, y: e.clientY } : prev);
  }, []);

  const hideTooltip = useCallback(() => {
    hideTimer.current = setTimeout(() => {
      setTooltip(prev => ({ ...prev, visible: false }));
    }, 80);
  }, []);

  // ── VLSM utilization ───────────────────────────────────────────────────────
  const utilization = useMemo(() => {
    if (mode !== 'vlsm' || allocations.length === 0) return null;
    const baseTotal = Math.pow(2, 32 - basePrefix);
    const allocatedAddresses = allocations
      .filter(a => a.status === 'allocated' && a.network !== 'N/A')
      .reduce((sum, a) => sum + Math.pow(2, 32 - a.derivedPrefix), 0);
    const overflowCount = allocations.filter(a => a.status === 'overflow').length;
    const pct = Math.min(100, (allocatedAddresses / baseTotal) * 100);
    return { allocatedAddresses, baseTotal, pct, overflowCount };
  }, [mode, allocations, basePrefix]);

  // ── Display mode ──────────────────────────────────────────────────────────
  const isCompact  = blocks.length > COMPACT_THRESHOLD;
  const pageSize   = isCompact ? PAGE_SIZE_TILE : PAGE_SIZE_BAR;

  // ── Pagination ────────────────────────────────────────────────────────────
  const pg = usePagination(blocks, pageSize);

  // When selected block is on a different page, jump to it
  const lastJumpedIdx = useRef<number>(-1);
  if (selectedIdx !== lastJumpedIdx.current) {
    const targetPage = Math.floor(selectedIdx / pageSize) + 1;
    if (targetPage !== pg.page) {
      pg.setPage(targetPage);
    }
    lastJumpedIdx.current = selectedIdx;
  }

  // ── Equal-split options ───────────────────────────────────────────────────
  const availableSplits = COMMON_PREFIXES.filter(p => p > basePrefix && p <= 30);

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <BlockTooltip state={tooltip} />

      {/* ── Header ── */}
      <div className="blockmap-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p className="label" style={{ margin: 0 }}>Address block map</p>
          {isCompact && (
            <span className="bm-compact-badge">tile view · {blocks.length} blocks</span>
          )}
        </div>

        {mode === 'equal-split' && onSplitChange && (
          <div className="split-control">
            <span>split into</span>
            <select
              value={equalSplitPrefix ?? ''}
              onChange={e => onSplitChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">none</option>
              {availableSplits.map(p => (
                <option key={p} value={p}>
                  /{p} ({Math.pow(2, p - basePrefix)} subnets)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Utilization bar (VLSM only) ── */}
      {utilization && (
        <div className="util-bar-wrap">
          <div className="util-bar-track">
            <div
              className={`util-bar-fill${utilization.overflowCount > 0 ? ' overflow' : ''}`}
              style={{ width: `${utilization.pct.toFixed(1)}%` }}
            />
          </div>
          <div className="util-stats">
            <span className="mono">
              {utilization.allocatedAddresses.toLocaleString()} / {utilization.baseTotal.toLocaleString()} addresses
              {' '}({utilization.pct.toFixed(1)}% used)
            </span>
            {utilization.overflowCount > 0 && (
              <span className="util-overflow-warn">
                ⚠ {utilization.overflowCount} requirement{utilization.overflowCount > 1 ? 's' : ''} overflow
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Compact tile view (> COMPACT_THRESHOLD blocks) ── */}
      {isCompact ? (
        <div
          className="blockmap-tiles"
          onMouseMove={moveTooltip}
          onMouseLeave={hideTooltip}
        >
          {pg.slice.map((blk) => {
            const i = blocks.indexOf(blk); // real index within full array
            return (
              <div
                key={i}
                className={[
                  'bm-tile',
                  i === selectedIdx         ? 'selected'  : '',
                  blk.isRemainder           ? 'remainder' : '',
                  blk.status === 'overflow' ? 'overflow'  : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onSelect(i)}
                onMouseEnter={(e) => showTooltip(e, blk, i)}
                onMouseLeave={hideTooltip}
              >
                <span className="bm-tile__prefix">/{blk.prefix}</span>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Normal bar view ── */
        <div
          className="blockmap"
          onMouseMove={moveTooltip}
          onMouseLeave={hideTooltip}
        >
          {pg.slice.map((blk) => {
            const i = blocks.indexOf(blk);
            return (
              <div
                key={i}
                className={[
                  'block',
                  i === selectedIdx         ? 'selected'  : '',
                  blk.isRemainder           ? 'remainder' : '',
                  blk.status === 'overflow' ? 'overflow'  : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onSelect(i)}
                onMouseEnter={(e) => showTooltip(e, blk, i)}
                onMouseLeave={hideTooltip}
                style={{
                  flexGrow: mode === 'vlsm'
                    ? Math.max(1, Math.log2(Math.max(blk.total, 1)))
                    : 1,
                }}
              >
                <div className="bnum">
                  {mode === 'vlsm' && blk.name && !blk.isRemainder ? `${blk.name} ` : ''}
                  {blk.network}
                </div>
                <div className="block__prefix">
                  <span className="block__slash">/</span>
                  <span className="block__pfxnum">{blk.prefix}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      <Paginator
        page={pg.page}
        totalPages={pg.totalPages}
        totalItems={pg.totalItems}
        pageSize={pg.pageSize}
        startIdx={pg.startIdx}
        setPage={pg.setPage}
        className="blockmap-paginator"
        itemLabel="blocks"
      />

      <div className="blockmap-note">
        {blocks.length === 1
          ? 'Single block — use split or VLSM to divide.'
          : `${blocks.length} block${blocks.length > 1 ? 's' : ''}. ${isCompact ? 'Hover a tile for details.' : 'Width is proportional to address space.'}`}
      </div>
    </div>
  );
};
