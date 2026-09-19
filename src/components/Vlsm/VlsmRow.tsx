import React from 'react';
import { AllocationRequest, Allocation } from '../../domain/vlsm';
import { CidrHighlight } from '../Shared/CidrHighlight';

interface VlsmRowProps {
	req: AllocationRequest;
	allocation?: Allocation;
	updateRequest: (id: string, updates: Partial<AllocationRequest>) => void;
	removeRequest: (id: string) => void;
}

export const VlsmRow = ({ req, allocation, updateRequest, removeRequest }: VlsmRowProps) => {
	const isOverflow = allocation?.status === 'overflow';

	const allocationLabel = () => {
		if (!allocation) return <span style={{ color: 'var(--muted-2)' }}>fill in hosts needed →</span>;
		if (isOverflow) return <span style={{ color: 'var(--error)' }}>⚠ overflow — base too small</span>;
		return (
			<span>
				<CidrHighlight value={`/${allocation.derivedPrefix}`} />
				<span style={{ color: 'var(--muted-2)' }}> · {allocation.usable.toLocaleString()} usable</span>
			</span>
		);
	};

	return (
		<div className="vlsm-row">
			<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
				<input
					value={req.name}
					onChange={e => updateRequest(req.id, { name: e.target.value })}
					placeholder="Segment name"
				/>
				<span className="mono" style={{ fontSize: '10px' }}>
					{allocationLabel()}
				</span>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '90px' }}>
				<input
					type="number"
					value={req.hostsNeeded || ''}
					onChange={e => updateRequest(req.id, { hostsNeeded: parseInt(e.target.value) || 0 })}
					min="1"
					placeholder="hosts"
					style={{ color: isOverflow ? 'var(--error)' : undefined }}
				/>
				<span className="mono" style={{ fontSize: '10px', color: 'var(--muted)' }}>req. hosts</span>
			</div>

			<button
				className="btn btn-danger"
				onClick={() => removeRequest(req.id)}
				title="Remove this requirement"
			>×</button>
		</div>
	);
};
