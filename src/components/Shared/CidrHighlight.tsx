import React from 'react';

interface CidrHighlightProps {
  /** Full CIDR string like "192.168.1.0/24", or just "/24", or just a prefix number 24 */
  value: string;
  className?: string;
}

/**
 * Renders an IP/CIDR string with the prefix portion visually accented.
 * Works for:
 *   - Full CIDR  →  "192.168.1.0/24"   → ip + accent(/24)
 *   - Prefix only → "/24"               → accent(/24)
 *   - Plain text  → "anything"          → plain text (no slash found)
 */
export const CidrHighlight: React.FC<CidrHighlightProps> = ({ value, className = '' }) => {
  const slashIdx = value.lastIndexOf('/');

  if (slashIdx === -1) {
    // No slash — render as-is
    return <span className={`cidr-hl ${className}`}>{value}</span>;
  }

  const host   = value.slice(0, slashIdx);
  const prefix = value.slice(slashIdx); // includes the slash

  return (
    <span className={`cidr-hl ${className}`}>
      {host && <span className="cidr-hl__host">{host}</span>}
      <span className="cidr-hl__slash">/</span>
      <span className="cidr-hl__prefix">{prefix.slice(1)}</span>
    </span>
  );
};
