import React from 'react';
import { SubnetInfo } from '../../domain/ipv4';
import { CopyValue } from '../Shared/CopyValue';

interface QuickFactsProps {
	selectedSubnet: SubnetInfo | null;
	basePrefix: number;
}

export const QuickFacts = ({ selectedSubnet, basePrefix }: QuickFactsProps) => {
	if (!selectedSubnet) return null;

	const hostBits     = 32 - selectedSubnet.prefix;
	const borrowedBits = Math.max(0, selectedSubnet.prefix - basePrefix);
	const totalNetworks = borrowedBits > 0 ? Math.pow(2, borrowedBits) : 1;
	const blockSize    = Math.pow(2, hostBits);

	return (
		<div className="panel">
			<p className="label">Quick facts</p>

			<div className="fact-row">
				<span className="k">Network</span>
				<CopyValue className="v network" value={selectedSubnet.network} />
			</div>
			<div className="fact-row">
				<span className="k">Broadcast</span>
				<CopyValue className="v network" value={selectedSubnet.broadcast} />
			</div>
			<div className="fact-row">
				<span className="k">First host</span>
				<CopyValue className="v host" value={selectedSubnet.first} />
			</div>
			<div className="fact-row">
				<span className="k">Last host</span>
				<CopyValue className="v host" value={selectedSubnet.last} />
			</div>

			<div className="fact-row">
				<span className="k">Netmask</span>
				<CopyValue className="v" value={selectedSubnet.mask} />
			</div>
			<div className="fact-row">
				<span className="k">Wildcard</span>
				<CopyValue className="v" value={selectedSubnet.wildcard} />
			</div>

			<div className="fact-row">
				<span className="k">Usable hosts</span>
				<div style={{ textAlign: 'right' }}>
					<span className="v">{selectedSubnet.usable.toLocaleString()}</span>
					<div className="mono" style={{ fontSize: '9px', color: 'var(--muted-2)' }}>
						2^{hostBits} − 2
					</div>
				</div>
			</div>
			<div className="fact-row">
				<span className="k">Total addresses</span>
				<div style={{ textAlign: 'right' }}>
					<span className="v">{selectedSubnet.total.toLocaleString()}</span>
					<div className="mono" style={{ fontSize: '9px', color: 'var(--muted-2)' }}>
						2^{hostBits}
					</div>
				</div>
			</div>
			<div className="fact-row">
				<span className="k">Total networks</span>
				<div style={{ textAlign: 'right' }}>
					<span className="v">{totalNetworks.toLocaleString()}</span>
					<div className="mono" style={{ fontSize: '9px', color: 'var(--muted-2)' }}>
						2^{borrowedBits}
					</div>
				</div>
			</div>
			<div className="fact-row">
				<span className="k">Block size</span>
				<div style={{ textAlign: 'right' }}>
					<span className="v">{blockSize.toLocaleString()}</span>
					<div className="mono" style={{ fontSize: '9px', color: 'var(--muted-2)' }}>
						2^{hostBits}
					</div>
				</div>
			</div>
		</div>
	);
};
