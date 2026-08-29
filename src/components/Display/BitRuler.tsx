import React, { useMemo } from 'react';
import { BaseNetwork, ipToInt, SubnetInfo } from '../../domain/ipv4';
import { CidrHighlight } from '../Shared/CidrHighlight';

// Bit values per octet (128, 64, 32, 16, 8, 4, 2, 1)
const BIT_VALUES = [128, 64, 32, 16, 8, 4, 2, 1];

interface BitRulerProps {
	base: BaseNetwork;
	prefix: number;
	onPrefixChange: (newPrefix: number) => void;
	selectedAllocation?: SubnetInfo | null;
	mode: 'equal-split' | 'vlsm';
}

export const BitRuler = ({ base, prefix, onPrefixChange, selectedAllocation, mode }: BitRulerProps) => {
	const ipInt = ipToInt(base.ip);
	const basePrefix = base.prefix;

	// In VLSM mode with a selected allocation, compute the three visual states
	const { baseFixedBits, borrowedBits, hostBits } = useMemo(() => {
		if (mode !== 'vlsm' || !selectedAllocation) {
			return { baseFixedBits: prefix, borrowedBits: 0, hostBits: 32 - prefix };
		}
		return {
			baseFixedBits: basePrefix,
			borrowedBits: selectedAllocation.prefix - basePrefix,
			hostBits: 32 - selectedAllocation.prefix,
		};
	}, [mode, basePrefix, prefix, selectedAllocation]);

	// Determine the effective prefix for boundary calculation
	const effectivePrefix = mode === 'vlsm' && selectedAllocation ? selectedAllocation.prefix : prefix;

	// Which octet contains the network/host boundary? (0-3)
	const interestingOctet = Math.floor((effectivePrefix - 1) / 8);

	// Check if host portion is all zeros (for dimming host bits)
	const hostPortionAllZero = useMemo(() => {
		if (effectivePrefix >= 32) return false;
		const hostMask = (0xFFFFFFFF >>> effectivePrefix) >>> 0;
		return (ipInt & hostMask) === 0;
	}, [ipInt, effectivePrefix]);

	const renderOctet = (octetIdx: number) => {
		const bits = [];
		for (let b = 0; b < 8; b++) {
			const bitIndex = octetIdx * 8 + b;
			const bitVal = (ipInt >>> (31 - bitIndex)) & 1;
			const bitValue = BIT_VALUES[b];

			// Determine bit state for VLSM three-state visualization
			let bitState: 'base-fixed' | 'borrowed' | 'host' = 'host';
			if (mode === 'vlsm' && selectedAllocation) {
				if (bitIndex < baseFixedBits) bitState = 'base-fixed';
				else if (bitIndex < baseFixedBits + borrowedBits) bitState = 'borrowed';
				else bitState = 'host';
			} else {
				bitState = bitIndex < prefix ? 'base-fixed' : 'host';
			}

			const isBoundary = bitIndex === effectivePrefix - 1;
			const isHostBit = bitState === 'host';
			const showDim = isHostBit && hostPortionAllZero && bitVal === 0;

			bits.push(
				<div
					key={bitIndex}
					className={[
						'bit',
						bitState,
						isBoundary ? 'boundary' : '',
						showDim ? 'dim' : '',
						mode === 'vlsm' ? 'no-click' : '',
					].filter(Boolean).join(' ')}
					onClick={() => mode === 'equal-split' && onPrefixChange(bitIndex + 1)}
					title={
						mode === 'vlsm'
							? `bit ${bitIndex + 1} — prefix locked in VLSM mode`
							: showDim
								? 'Host bits — enter a specific address to see real values'
								: `bit ${bitIndex + 1} — click to set prefix to /${bitIndex + 1}`
					}
				>
					<div className="bit-index">{bitIndex+1}</div>
					{bitVal}
					<div className="bit-value">{bitValue}</div>
				</div>
			);
		}
		return bits;
	};

	// Display prefix: if VLSM with a selected allocation, show that allocation's CIDR
	const displayCidr = mode === 'vlsm' && selectedAllocation
		? `${selectedAllocation.network}/${selectedAllocation.prefix}`
		: `${base.ip}/${prefix}`;

	return (
		<div className="panel">
			<div className="bitruler-head">
				<p className="label">Bit ruler — click a bit to move the prefix</p>
				<span className="hint mono">
					<CidrHighlight value={displayCidr} />
				</span>
			</div>
			<div className="octets">
				{[0, 1, 2, 3].map(o => (
					<div key={o} className={`octet ${o === interestingOctet ? 'interesting' : ''}`}>
						<div className="octet-label">
							{['1st', '2nd', '3rd', '4th'][o]} octet
							{o === interestingOctet && <span className="interesting-badge">interesting</span>}
						</div>
						<div className="bits">{renderOctet(o)}</div>
					</div>
				))}
			</div>
			<div className="legend">
				{mode === 'vlsm' && selectedAllocation ? (
					<>
						<span><span className="swatch base-fixed"></span>base network</span>
						<span><span className="swatch borrowed"></span>borrowed</span>
						<span><span className="swatch host"></span>host</span>
						<span className="mono" style={{ marginLeft: 'auto' }}>
							<CidrHighlight value={`/${baseFixedBits}`} />
							<span style={{ color: 'var(--muted-2)' }}> base</span>
							{' · '}{borrowedBits}
							<span style={{ color: 'var(--muted-2)' }}> borrowed</span>
							{' · '}{hostBits}
							<span style={{ color: 'var(--muted-2)' }}> host</span>
						</span>
					</>
				) : (
					<>
						<span><span className="swatch network"></span>network bits</span>
						<span><span className="swatch host"></span>host bits</span>
						<span className="mono" style={{ marginLeft: 'auto' }}>
							<CidrHighlight value={`/${prefix}`} />
							<span style={{ color: 'var(--muted-2)' }}> network</span>
							{' · '}{32 - prefix}
							<span style={{ color: 'var(--muted-2)' }}> host</span>
						</span>
					</>
				)}
			</div>
		</div>
	);
};
