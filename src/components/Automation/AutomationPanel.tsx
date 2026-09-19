import React from 'react';
import {
	AutomationAction,
	AutomationHealthResponse,
	AutomationInterpretResponse,
} from '../../types/automation';

interface AutomationPanelProps {
	prompt: string;
	response: AutomationInterpretResponse | null;
	health: AutomationHealthResponse | null;
	busy: boolean;
	notice: string | null;
	onPromptChange: (value: string) => void;
	onSubmit: () => void;
	onApply: () => void;
	onClear: () => void;
}

function formatAction(action: AutomationAction): string {
	switch (action.intent) {
		case 'set-mode':
			return `Set mode to ${action.mode}`;
		case 'set-base-cidr':
			return `Set base network to ${action.cidr}`;
		case 'set-equal-split-prefix':
			return action.prefix === null
				? 'Clear equal split target'
				: `Set equal split target to /${action.prefix}`;
		case 'upsert-vlsm-request':
			return `Upsert VLSM request ${action.name} (${action.hostsNeeded} hosts)`;
		case 'batch-vlsm-requests':
			return `Upsert ${action.requests.length} VLSM requests: ${action.requests.map(req => `${req.name} ${req.hostsNeeded}`).join(', ')}`;
		case 'unsupported':
			return action.reason;
	}
}

function isPlanApplyable(response: AutomationInterpretResponse | null): boolean {
	if (!response?.plan) return false;
	return !response.plan.actions.some(action => action.intent === 'unsupported');
}

function getHealthTone(health: AutomationHealthResponse | null): 'red' | 'yellow' | 'green' {
	if (!health) return 'red';
	if (!health.configured) return 'yellow';
	return 'green';
}

function getHealthTooltip(health: AutomationHealthResponse | null): string {
	if (!health) return 'not connected — the AI assist server could not be reached';
	if (!health.configured) return `server misconfigured — backend reachable, but TypeSafeAI credentials are missing for ${health.model}`;
	return `connected — backend reachable and configured for ${health.model}`;
}

const EXAMPLE_PROMPTS = [
	'use 10.0.0.0/24 and split into 10 subnets',
	'split this into at least 5 subnets',
	'guest: 120, staff: 60',
];

export const AutomationPanel = ({
	prompt,
	response,
	health,
	busy,
	notice,
	onPromptChange,
	onSubmit,
	onApply,
	onClear,
}: AutomationPanelProps) => {
	const applyable = isPlanApplyable(response);
	const requiresConfirmation = response?.plan?.requiresConfirmation ?? true;
	const confidencePct = response?.plan ? Math.round(response.plan.confidence * 100) : null;
	const healthTone = getHealthTone(health);
	const healthTooltip = getHealthTooltip(health);

	return (
		<div className="panel automation-panel">
			<div className="automation-panel__head">
				<div>
					<div className="automation-panel__title-row">
						<h2 className="automation-panel__title">AI Assist</h2>
					</div>
				</div>
				<div className="automation-panel__meta">
					<div className={`automation-panel__health automation-panel__health--${healthTone}`} title={healthTooltip}>
						<span className="automation-panel__health-dot" aria-hidden="true" />
						<span className="mono">{health?.model ?? 'offline'}</span>
					</div>
					<div className="automation-panel__powered-by">
						powered by{' '}
						<a
							className="automation-panel__provider-link"
							href="https://typesafe.ai/"
							target="_blank"
							rel="noopener noreferrer"
						>
							<span className="automation-panel__provider-mark" aria-hidden="true">✦</span>
							TypeSafeAI
						</a>
					</div>
				</div>
			</div>

			<div className="automation-panel__examples">
				<span className="automation-panel__examples-label mono">Examples</span>
				<div className="automation-panel__example-buttons">
					{EXAMPLE_PROMPTS.map(example => (
						<button
							key={example}
							type="button"
							className="automation-panel__example-btn mono"
							onClick={() => onPromptChange(example)}
						>
							{example}
						</button>
					))}
				</div>
			</div>

			<div className="automation-panel__composer">
				<input
					className="automation-panel__input"
					type="text"
					value={prompt}
					onChange={e => onPromptChange(e.target.value)}
					placeholder="Describe the subnet change you want…"
					onKeyDown={e => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							onSubmit();
						}
					}}
				/>
				<button className="btn automation-panel__submit" onClick={onSubmit} disabled={busy || !prompt.trim()}>
					{busy ? '…thinking' : 'Interpret'}
				</button>
			</div>

			{notice && (
				<div className="automation-panel__notice">
					{notice}
				</div>
			)}

			{response && (
				<div className={`automation-panel__result automation-panel__result--${response.status}`}>
					<div className="automation-panel__result-head">
						<div>
							<div className="automation-panel__result-title">Interpretation result</div>
							<div className="automation-panel__result-message">{response.message}</div>
						</div>
						{confidencePct !== null && (
							<div className="automation-panel__confidence mono">confidence {confidencePct}%</div>
						)}
					</div>

					{response.plan && (
						<>
							<div className="automation-panel__summary mono">{response.plan.summary}</div>
							<ol className="automation-panel__actions">
								{response.plan.actions.map((action, idx) => (
									<li key={`${action.intent}-${idx}`}>{formatAction(action)}</li>
								))}
							</ol>
							<div className="automation-panel__decision-row">
								<span className={`automation-panel__decision${requiresConfirmation ? ' confirm' : ' direct'}`}>
									{requiresConfirmation ? 'confirmation required' : 'low-risk direct action'}
								</span>
								<div className="automation-panel__result-buttons">
									<button className="btn" onClick={onClear}>Clear</button>
									<button className="btn automation-panel__apply" onClick={onApply} disabled={!applyable || busy}>
										{requiresConfirmation ? 'Apply reviewed plan' : 'Apply plan'}
									</button>
								</div>
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
};
