// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RangeReport } from './RangeReport';
import { subnetInfo } from '../../domain/ipv4';

describe('RangeReport', () => {
	afterEach(() => {
		cleanup();
	});

	it('resets export state when switching modes so stale downloads are not available', () => {
		const { rerender } = render(
			<RangeReport
				blocks={[
					{ ...subnetInfo('10.0.0.0', 25), name: 'guest', status: 'allocated' as const },
					{ ...subnetInfo('10.0.0.128', 26), name: 'staff', status: 'allocated' as const },
					{ ...subnetInfo('10.0.0.192', 26), name: 'printers', status: 'allocated' as const },
				]}
				selectedIdx={0}
				onSelect={vi.fn()}
				mode="vlsm"
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /export/i }));
		expect(screen.getByRole('button', { name: '↓ Download (3)' })).toBeTruthy();

		rerender(
			<RangeReport
				blocks={[subnetInfo('192.168.1.0', 24)]}
				selectedIdx={0}
				onSelect={vi.fn()}
				mode="equal-split"
			/>,
		);

		expect(screen.queryByRole('button', { name: /↓ Download/i })).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: /export/i }));
		expect(screen.getByRole('button', { name: '↓ Download (1)' })).toBeTruthy();
	});

	it('supports exporting equal-split reports as all-or-none without row selection controls', () => {
		render(
			<RangeReport
				blocks={[
					subnetInfo('192.168.1.0', 25),
					subnetInfo('192.168.1.128', 25),
				]}
				selectedIdx={0}
				onSelect={vi.fn()}
				mode="equal-split"
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /export/i }));

		expect(screen.getByRole('button', { name: '↓ Download (2)' })).toBeTruthy();
		expect(screen.getByText(/Equal-split exports include the full report only/i)).toBeTruthy();
		expect(screen.queryByText(/Exclude unallocated/i)).toBeNull();
		expect(screen.queryByRole('checkbox', { name: /toggle all/i })).toBeNull();
		expect(document.querySelector('.rr-export-list')).toBeNull();
	});
});
