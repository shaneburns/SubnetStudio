import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { SubnetInfo } from '../../domain/ipv4';
import { Allocation } from '../../domain/vlsm';
import { CopyValue } from '../Shared/CopyValue';
import { CidrHighlight } from '../Shared/CidrHighlight';
import { Paginator } from '../Shared/Paginator';
import { usePagination } from '../../state/usePagination';

interface ExtendedBlock extends SubnetInfo {
  name?: string;
  status?: 'allocated' | 'conflict' | 'overflow';
  isRemainder?: boolean;
}

interface RangeReportProps {
  blocks: ExtendedBlock[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  mode: 'equal-split' | 'vlsm';
  allocations?: Allocation[];
}

type ExportFormat = 'csv' | 'json';

const PAGE_SIZE = 25;

// ── Export helpers ─────────────────────────────────────────────────────────────
function blockToCsvRow(blk: ExtendedBlock, idx: number, isVLSM: boolean): string {
  const fields: string[] = [
    String(idx + 1),
    ...(isVLSM ? [`"${(blk.name ?? '').replace(/"/g, '""')}"`] : []),
    blk.isRemainder ? `${blk.network}–${blk.broadcast}` : `${blk.network}/${blk.prefix}`,
    blk.network,
    blk.isRemainder ? '—' : blk.mask,
    blk.broadcast,
    blk.first,
    blk.last,
    String(blk.usable),
    String(blk.total),
    ...(isVLSM ? [blk.isRemainder ? 'unallocated' : (blk.status ?? 'allocated')] : []),
  ];
  return fields.join(',');
}

function blockToJsonObj(blk: ExtendedBlock, idx: number, isVLSM: boolean): object {
  return {
    index:     idx + 1,
    ...(isVLSM ? { name: blk.name ?? '' } : {}),
    ...(blk.isRemainder
      ? { range: `${blk.network}–${blk.broadcast}` }
      : { cidr: `${blk.network}/${blk.prefix}` }),
    firstAddr:  blk.network,
    ...(!blk.isRemainder ? { mask: blk.mask, wildcard: blk.wildcard } : {}),
    lastAddr:   blk.broadcast,
    firstHost:  blk.first,
    lastHost:   blk.last,
    usable:     blk.usable,
    total:      blk.total,
    ...(isVLSM ? { status: blk.isRemainder ? 'unallocated' : (blk.status ?? 'allocated') } : {}),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export const RangeReport = ({ blocks, selectedIdx, onSelect, mode }: RangeReportProps) => {
  const isVLSM = mode === 'vlsm';

  // ── Search / filter ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  const filteredEntries = useMemo(() => {
    const mapped = blocks.map((b, i) => ({ block: b, origIdx: i }));
    if (!search.trim()) return mapped;
    const q = search.trim().toLowerCase();
    return mapped.filter(({ block: b }) =>
      (b.name ?? '').toLowerCase().includes(q) ||
      b.network.includes(q) ||
      b.broadcast.includes(q) ||
      b.mask.includes(q) ||
      `${b.network}/${b.prefix}`.includes(q) ||
      `/${b.prefix}`.includes(q)
    );
  }, [blocks, search]);

  // ── Pagination (operates on the filtered list) ─────────────────────────────
  const pg = usePagination(filteredEntries, PAGE_SIZE);

  // When selected block changes, jump to the page that contains it
  const lastJumpedIdx = React.useRef<number>(-1);
  if (selectedIdx !== lastJumpedIdx.current) {
    // Find position of selected block within filteredEntries
    const posInFiltered = filteredEntries.findIndex(e => e.origIdx === selectedIdx);
    if (posInFiltered >= 0) {
      const targetPage = Math.floor(posInFiltered / PAGE_SIZE) + 1;
      if (targetPage !== pg.page) pg.setPage(targetPage);
    }
    lastJumpedIdx.current = selectedIdx;
  }

  // ── Export state ───────────────────────────────────────────────────────────
  const [exportOpen,   setExportOpen]   = useState(false);
  const [exportFmt,    setExportFmt]    = useState<ExportFormat>('csv');
  const [exclUnalloc,  setExclUnalloc]  = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // When export panel opens, select all exportable rows
  useEffect(() => {
    if (!exportOpen) return;
    const eligible = blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => !exclUnalloc || !b.isRemainder)
      .map(({ i }) => i);
    setSelectedRows(new Set(eligible));
  }, [exportOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selection when exclUnalloc changes while panel is open
  useEffect(() => {
    if (!exportOpen) return;
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (exclUnalloc) blocks.forEach((b, i) => { if (b.isRemainder) next.delete(i); });
      return next;
    });
  }, [exclUnalloc]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportableBlocks = useMemo(
    () => blocks.map((b, i) => ({ b, i })).filter(({ b }) => !exclUnalloc || !b.isRemainder),
    [blocks, exclUnalloc]
  );

  const allSelected = exportableBlocks.length > 0 &&
    exportableBlocks.every(({ i }) => selectedRows.has(i));

  const toggleRow = useCallback((idx: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedRows(allSelected ? new Set() : new Set(exportableBlocks.map(({ i }) => i)));
  }, [allSelected, exportableBlocks]);

  const runExport = useCallback(() => {
    const rows = blocks.map((b, i) => ({ b, i })).filter(({ i }) => selectedRows.has(i));

    let content: string;
    let mime: string;
    let ext: string;

    if (exportFmt === 'csv') {
      const header = [
        '#',
        ...(isVLSM ? ['Name'] : []),
        'CIDR / Range', 'Network / First', 'Mask', 'Broadcast / Last',
        'First Host', 'Last Host', 'Usable', 'Total',
        ...(isVLSM ? ['Status'] : []),
      ].join(',');
      const body = rows.map(({ b, i }) => blockToCsvRow(b, i, isVLSM)).join('\n');
      content = `${header}\n${body}`;
      mime = 'text/csv';
      ext  = 'csv';
    } else {
      content = JSON.stringify(rows.map(({ b, i }) => blockToJsonObj(b, i, isVLSM)), null, 2);
      mime = 'application/json';
      ext  = 'json';
    }

    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `subnet-report.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [blocks, selectedRows, exportFmt, isVLSM]);

  return (
    <div className="panel">
      {/* ── Panel header ── */}
      <div className="rr-head">
        <p className="label" style={{ margin: 0 }}>Range report</p>
        <div className="rr-head__controls">
          <div className="rr-search-wrap">
            <span className="rr-search-icon">⌕</span>
            <input
              className="rr-search"
              type="text"
              placeholder="filter by name, IP, mask…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="rr-search-clear" onClick={() => setSearch('')} title="Clear filter">×</button>
            )}
          </div>
          {isVLSM && (
            <button
              className={`btn rr-export-btn${exportOpen ? ' active' : ''}`}
              onClick={() => setExportOpen(o => !o)}
              title="Export report"
            >↓ Export</button>
          )}
        </div>
      </div>

      {/* ── Export panel ── */}
      {exportOpen && isVLSM && (
        <div className="rr-export-panel">
          <div className="rr-export-row">
            <label className="rr-export-label">Format</label>
            <div className="rr-fmt-toggle">
              <button className={`btn rr-fmt-btn${exportFmt === 'csv'  ? ' active' : ''}`} onClick={() => setExportFmt('csv')}>CSV</button>
              <button className={`btn rr-fmt-btn${exportFmt === 'json' ? ' active' : ''}`} onClick={() => setExportFmt('json')}>JSON</button>
            </div>
            <label className="rr-export-check">
              <input type="checkbox" checked={exclUnalloc} onChange={e => setExclUnalloc(e.target.checked)} />
              Exclude unallocated
            </label>
            <label className="rr-export-check">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              {allSelected ? 'Deselect all' : 'Select all'}
            </label>
            <button
              className="btn rr-export-download"
              onClick={runExport}
              disabled={selectedRows.size === 0}
              title={selectedRows.size === 0 ? 'Select at least one row' : `Export ${selectedRows.size} row(s)`}
            >↓ Download ({selectedRows.size})</button>
          </div>

          <div className="rr-export-list">
            {exportableBlocks.map(({ b, i }) => (
              <label key={i} className="rr-export-item">
                <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)} />
                <span className="mono rr-export-item__cidr">
                  {b.isRemainder
                    ? <span style={{ color: 'var(--muted-2)' }}>{b.network} – {b.broadcast}</span>
                    : <CidrHighlight value={`${b.network}/${b.prefix}`} />
                  }
                </span>
                {b.name && <span className="rr-export-item__name">{b.name}</span>}
                {b.isRemainder && <span className="rr-export-item__tag">unalloc.</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Search feedback ── */}
      {search && (
        <div className="rr-filter-info">
          {filteredEntries.length} of {blocks.length} block{blocks.length !== 1 ? 's' : ''} match
          {filteredEntries.length === 0 && ` "${search}"`}
        </div>
      )}

      {/* ── Scroll well ── */}
      <div className="report-scroll">
        <table className="range-table">
          <colgroup>
            {exportOpen && isVLSM && <col style={{ width: '30px' }} />}
            <col className="col-idx" />
            {isVLSM && <col className="col-name" />}
            <col className="col-cidr" />
            <col className="col-addr" />
            <col className="col-addr" />
            <col className="col-hosts" />
            <col className="col-usable" />
            {isVLSM && <col className="col-status" />}
          </colgroup>
          <thead>
            <tr>
              {exportOpen && isVLSM && (
                <th style={{ padding: '0 4px 9px' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Toggle all" style={{ cursor: 'pointer' }} />
                </th>
              )}
              <th>#</th>
              {isVLSM && <th>Name</th>}
              <th>CIDR</th>
              <th>Network</th>
              <th>Broadcast</th>
              <th>First / Last host</th>
              <th>Usable</th>
              {isVLSM && <th>Status</th>}
            </tr>
          </thead>
          <tbody>
            {pg.slice.map(({ block: blk, origIdx: i }) => (
              <tr
                key={i}
                className={[
                  i === selectedIdx ? 'selected' : '',
                  blk.isRemainder   ? 'row-unalloc' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onSelect(i)}
              >
                {exportOpen && isVLSM && (
                  <td style={{ padding: '0 4px' }} onClick={e => e.stopPropagation()}>
                    {(!exclUnalloc || !blk.isRemainder) && (
                      <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)} style={{ cursor: 'pointer' }} />
                    )}
                  </td>
                )}

                <td className="idx">{i + 1}</td>

                {isVLSM && (
                  <td className="name" title={blk.name ?? ''}>{blk.name ?? ''}</td>
                )}

                {/* CIDR / Range */}
                <td>
                  {blk.isRemainder ? (
                    <span className="rr-unalloc-range mono">
                      {blk.network}
                      <span className="rr-unalloc-sep"> – </span>
                      {blk.broadcast}
                    </span>
                  ) : (
                    <CopyValue value={`${blk.network}/${blk.prefix}`}>
                      <CidrHighlight value={`${blk.network}/${blk.prefix}`} />
                    </CopyValue>
                  )}
                </td>

                <td>
                  {blk.isRemainder
                    ? <span className="mono" style={{ color: 'var(--muted-2)' }}>—</span>
                    : <CopyValue value={blk.network} />}
                </td>
                <td>
                  {blk.isRemainder
                    ? <span className="mono" style={{ color: 'var(--muted-2)' }}>—</span>
                    : <CopyValue value={blk.broadcast} />}
                </td>

                <td className="hosts-cell">
                  <CopyValue value={blk.first} />
                  <CopyValue value={blk.last} />
                </td>

                <td className="usable">{blk.usable.toLocaleString()}</td>

                {isVLSM && (
                  <td className={`status ${blk.isRemainder ? 'remainder' : (blk.status ?? 'allocated')}`}>
                    {blk.isRemainder ? 'unalloc.' : (blk.status ?? 'ok')}
                  </td>
                )}
              </tr>
            ))}

            {pg.slice.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  style={{ textAlign: 'center', color: 'var(--muted-2)', padding: '16px',
                           fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}
                >
                  No blocks match "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <Paginator
        page={pg.page}
        totalPages={pg.totalPages}
        totalItems={pg.totalItems}
        pageSize={pg.pageSize}
        startIdx={pg.startIdx}
        setPage={pg.setPage}
        className="rr-paginator"
        itemLabel="rows"
      />
    </div>
  );
};
