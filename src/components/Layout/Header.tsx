import React from 'react';

interface HeaderProps {
	mode:                'equal-split' | 'vlsm';
	setMode:             (mode: 'equal-split' | 'vlsm') => void;
	automationVisible:   boolean;
	onToggleAutomation:  () => void;
	onOpenSettings:      () => void;
}

export const Header = ({ mode, setMode, automationVisible, onToggleAutomation, onOpenSettings }: HeaderProps) => (
	<header>
		<div className="brand">
			<span id="subnet-studio-logo" role="img" aria-label="Subnet Studio Logo"><img src="/logo-transparent.svg" alt="Subnet Studio Logo" /></span>
			<h1>Subnet<span className="accent">Studio</span></h1>
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
				className={`header-ai-btn${automationVisible ? ' active' : ''}`}
				onClick={onToggleAutomation}
				title={automationVisible ? 'Hide AI Assist' : 'Show AI Assist'}
				aria-label={automationVisible ? 'Hide AI Assist' : 'Show AI Assist'}
				aria-pressed={automationVisible}
			>
				✦
			</button>

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
