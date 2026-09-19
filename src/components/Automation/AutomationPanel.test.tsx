// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomationPanel } from './AutomationPanel';
import { AutomationHealthResponse, AutomationInterpretResponse } from '../../types/automation';

const baseHealth: AutomationHealthResponse = {
	ok: true,
	provider: 'typesafe',
	configured: true,
	model: 'jev-latest',
	apiUrl: 'https://api.typesafe.ai/v1/systemone',
	supportedIntents: [
		'set-mode',
		'set-base-cidr',
		'set-equal-split-prefix',
		'upsert-vlsm-request',
		'batch-vlsm-requests',
		'unsupported',
	],
};

function renderPanel(response: AutomationInterpretResponse | null) {
	return render(
		<AutomationPanel
			prompt="split 10.0.0.0/24 into /26s"
			response={response}
			health={baseHealth}
			busy={false}
			notice={null}
			onPromptChange={vi.fn()}
			onSubmit={vi.fn()}
			onApply={vi.fn()}
			onClear={vi.fn()}
		/>,
	);
}

describe('AutomationPanel', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders the cloud-assisted entry point and plan preview', () => {
		const response: AutomationInterpretResponse = {
			ok: true,
			provider: 'typesafe',
			configured: true,
			status: 'ready',
			message: 'set base network to 10.0.0.0/24 → set equal split to /26',
			supportedIntents: baseHealth.supportedIntents,
			plan: {
				summary: 'set base network to 10.0.0.0/24 → set equal split to /26',
				confidence: 0.96,
				requiresConfirmation: true,
				actions: [
					{ intent: 'set-base-cidr', cidr: '10.0.0.0/24' },
					{ intent: 'set-equal-split-prefix', prefix: 26 },
				],
			},
		};

		renderPanel(response);
		expect(screen.getByRole('heading', { name: /AI Assist/i })).toBeTruthy();
		expect(screen.getByText(/powered by/i)).toBeTruthy();
		expect(screen.getByRole('link', { name: /TypeSafeAI/i })).toBeTruthy();
		expect(screen.getByText('Set base network to 10.0.0.0/24')).toBeTruthy();
		expect(screen.getByText('Set equal split target to /26')).toBeTruthy();
		expect(screen.getByText(/confirmation required/i)).toBeTruthy();
	});

	it('fills the prompt when an example button is clicked', () => {
		const onPromptChange = vi.fn();
		render(
			<AutomationPanel
				prompt=""
				response={null}
				health={baseHealth}
				busy={false}
				notice={null}
				onPromptChange={onPromptChange}
				onSubmit={vi.fn()}
				onApply={vi.fn()}
				onClear={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'split this into at least 5 subnets' }));
		expect(onPromptChange).toHaveBeenCalledWith('split this into at least 5 subnets');
	});

	it('disables apply for unsupported responses', () => {
		const response: AutomationInterpretResponse = {
			ok: true,
			provider: 'typesafe',
			configured: true,
			status: 'ready',
			message: 'This request falls outside the supported automation slice.',
			supportedIntents: baseHealth.supportedIntents,
			plan: {
				summary: 'This request falls outside the supported automation slice.',
				confidence: 0.72,
				requiresConfirmation: true,
				actions: [
					{ intent: 'unsupported', reason: 'This request falls outside the supported automation slice.' },
				],
			},
		};

		const onApply = vi.fn();
		render(
			<AutomationPanel
				prompt="do ipv6 magic"
				response={response}
				health={baseHealth}
				busy={false}
				notice={null}
				onPromptChange={vi.fn()}
				onSubmit={vi.fn()}
				onApply={onApply}
				onClear={vi.fn()}
			/>,
		);

		const applyButton = screen.getByRole('button', { name: /Apply reviewed plan/i });
		expect(applyButton.hasAttribute('disabled')).toBe(true);
		fireEvent.click(applyButton);
		expect(onApply).not.toHaveBeenCalled();
	});
});
