import React, { useState, useEffect, useMemo } from 'react';
import { parseCIDR, classifyAddress } from '../../domain/ipv4';

interface CidrInputProps {
	base: { ip: string; prefix: number };
	updateBase: (ip: string, prefix: number) => void;
}

const COMMON_PREFIXES = [8, 16, 20, 24, 25, 26, 27, 28, 30];

export const CidrInput = ({ base, updateBase }: CidrInputProps) => {
	const [val, setVal]       = useState(`${base.ip}/${base.prefix}`);
	const [error, setError]   = useState<string | null>(null);

	const addrClass = useMemo(() => classifyAddress(base.ip), [base.ip]);

	// Keep the text field in sync when the prefix is changed externally
	// (e.g. clicking a bit in the BitRuler or pressing a shortcut button)
	useEffect(() => {
		setVal(`${base.ip}/${base.prefix}`);
		setError(null);
	}, [base.ip, base.prefix]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const input = e.target.value;
		setVal(input);
		const parsed = parseCIDR(input);
		if (parsed) {
			setError(null);
			updateBase(parsed.ip, parsed.prefix);
		} else {
			setError('Not a valid CIDR — expected A.B.C.D/prefix');
		}
	};

	return (
		<div className="panel">
			<p className="label">Network</p>
			<input
				className={`cidr-input mono${error ? ' invalid' : ''}`}
				value={val}
				onChange={handleChange}
				spellCheck={false}
			/>
			<div className={`input-hint${error ? ' error' : ''}`}>
				{error ?? 'Enter address and prefix, e.g. 10.0.0.0/22'}
			</div>

			<div className="prefix-buttons">
				{COMMON_PREFIXES.map(p => (
					<button
						key={p}
						className={`prefix-btn${p === base.prefix ? ' active' : ''}`}
						onClick={() => updateBase(base.ip, p)}
					>/{p}</button>
				))}
			</div>

			<div className={`addr-badge addr-badge--${addrClass.variant}`}>
				<span className="addr-badge__label">{addrClass.label}</span>
				<span className="addr-badge__rfc">{addrClass.rfc}</span>
			</div>
		</div>
	);
};
