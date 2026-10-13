// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VlsmRow } from './VlsmRow';

describe('VlsmRow', () => {
	afterEach(() => {
		cleanup();
	});

	it('provides accessible controls for reordering a requirement', () => {
		const onMoveUp = vi.fn();
		const onMoveDown = vi.fn();
		render(
			<VlsmRow
				req={{ id: 'guest', name: 'Guest', hostsNeeded: 120, order: 1 }}
				updateRequest={vi.fn()}
				removeRequest={vi.fn()}
				onMoveUp={onMoveUp}
				onMoveDown={onMoveDown}
				canMoveUp
				canMoveDown={false}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Move Guest up' }));
		expect(onMoveUp).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: 'Move Guest down' }).hasAttribute('disabled')).toBe(true);
	});
});
