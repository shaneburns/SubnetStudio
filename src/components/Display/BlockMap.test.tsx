// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockMap } from './BlockMap';
import { subnetInfo } from '../../domain/ipv4';

describe('BlockMap', () => {
	it('shows high-prefix equal-split options like /29 when the base supports them', () => {
		render(
			<BlockMap
				blocks={[subnetInfo('192.168.1.0', 24)]}
				selectedIdx={0}
				onSelect={vi.fn()}
				mode="equal-split"
				equalSplitPrefix={null}
				basePrefix={24}
				onSplitChange={vi.fn()}
			/>,
		);

		const options = screen.getAllByRole('option').map(option => option.textContent);
		expect(options).toContain('/29 (32 subnets)');
		expect(options).toContain('/31 (128 subnets)');
		expect(options).toContain('/32 (256 subnets)');
	});
});
