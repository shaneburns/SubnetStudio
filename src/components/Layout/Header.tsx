import React from 'react';

interface HeaderProps {
	mode:          'equal-split' | 'vlsm';
	setMode:       (mode: 'equal-split' | 'vlsm') => void;
	onOpenSettings: () => void;
}

export const Header = ({ mode, setMode, onOpenSettings }: HeaderProps) => (
	<header>
		<div className="brand">
			<h1>Subnet<span className="accent">Studio</span></h1>
			<span className="tagline">// v0.0.1a</span>
		</div>

		<div className="header-right">
			<div className="mode-toggle">
				<span
					className={mode === 'equal-split' ? 'active' : ''}
					onClick={() => setMode('equal-split')}
				>IPv4 Equal</span>
				<span
					className={mode === 'vlsm' ? 'active' : ''}
					onClick={() => setMode('vlsm')}
				>IPv4 VLSM</span>
			</div>

			<button
				className="header-settings-btn"
				onClick={onOpenSettings}
				title="Settings"
				aria-label="Open settings"
			>
				⚙
			</button>
		</div>
	</header>
);
