import { describe, expect, it } from 'vitest';
import { applyAutomationPlanToState, NetworkState } from './useNetworkState';
import { AutomationPlan } from '../types/automation';

function makeBaseState(): NetworkState {
	return {
		base: { ip: '192.168.1.0', prefix: 24 },
		mode: 'equal-split',
		equalSplitPrefix: null,
		vlsmRequests: [],
		selectedBlockIdx: 0,
	};
}

describe('automation state application', () => {
	it('applies a base CIDR change and equal-split update deterministically', () => {
		const plan: AutomationPlan = {
			summary: 'set base network to 10.0.0.0/24 → set equal split to /26',
			confidence: 0.96,
			requiresConfirmation: true,
			actions: [
				{ intent: 'set-base-cidr', cidr: '10.0.0.0/24' },
				{ intent: 'set-equal-split-prefix', prefix: 26 },
			],
		};

		const result = applyAutomationPlanToState(makeBaseState(), plan);
		expect(result.ok).toBe(true);
		expect(result.applied).toBe(2);
		expect(result.state.base).toEqual({ ip: '10.0.0.0', prefix: 24 });
		expect(result.state.equalSplitPrefix).toBe(26);
	});

	it('rejects an invalid equal-split prefix without mutating state', () => {
		const initial = makeBaseState();
		const plan: AutomationPlan = {
			summary: 'set equal split to /24',
			confidence: 0.91,
			requiresConfirmation: true,
			actions: [{ intent: 'set-equal-split-prefix', prefix: 24 }],
		};

		const result = applyAutomationPlanToState(initial, plan);
		expect(result.ok).toBe(false);
		expect(result.applied).toBe(0);
		expect(result.state).toEqual(initial);
	});

	it('accepts /32 as a valid equal-split prefix when it is narrower than the base', () => {
		const plan: AutomationPlan = {
			summary: 'set equal split to /32',
			confidence: 0.95,
			requiresConfirmation: true,
			actions: [{ intent: 'set-equal-split-prefix', prefix: 32 }],
		};

		const result = applyAutomationPlanToState(makeBaseState(), plan);
		expect(result.ok).toBe(true);
		expect(result.state.equalSplitPrefix).toBe(32);
	});

	it('upserts batch VLSM requests and switches to VLSM mode', () => {
		const plan: AutomationPlan = {
			summary: 'upsert 2 VLSM requests',
			confidence: 0.93,
			requiresConfirmation: true,
			actions: [
				{
					intent: 'batch-vlsm-requests',
					requests: [
						{ name: 'Guest', hostsNeeded: 120 },
						{ name: 'Staff', hostsNeeded: 60 },
					],
				},
			],
		};

		const result = applyAutomationPlanToState(makeBaseState(), plan);
		expect(result.ok).toBe(true);
		expect(result.state.mode).toBe('vlsm');
		expect(result.state.vlsmRequests).toHaveLength(2);
		expect(result.state.vlsmRequests.map(req => `${req.name}:${req.hostsNeeded}`)).toEqual([
			'Guest:120',
			'Staff:60',
		]);
	});
});
