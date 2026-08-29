import React, { useState, useCallback } from 'react';

interface CopyValueProps {
  value: string;
  className?: string;
  /** Optional custom display content — if omitted the raw value string is shown */
  children?: React.ReactNode;
}

/**
 * Renders `value` as monospace text. On click it copies the value to the
 * clipboard and briefly shows a ✓ tick. Stops event propagation so it can
 * live inside a clickable table row without triggering row selection.
 *
 * Pass `children` to render custom content (e.g. CidrHighlight) while still
 * copying the raw `value` string on click.
 */
export const CopyValue = ({ value, className = '', children }: CopyValueProps) => {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!value || value === 'N/A' || value === '—') return;
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [value],
  );

  return (
    <span
      className={`copy-value ${className}`}
      onClick={handleClick}
      title={`Click to copy: ${value}`}
    >
      {children ?? value}
      <span className="copy-icon">{copied ? '✓' : '⧉'}</span>
    </span>
  );
};
