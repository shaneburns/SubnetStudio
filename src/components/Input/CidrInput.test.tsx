// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CidrInput } from './CidrInput';

describe('CidrInput', () => {
	it('renders dense high-prefix shortcut buttons and applies them', () => {
		const updateBase = vi.fn();
		render(
			<CidrInput
				base={{ ip: '192.168.1.0', prefix: 24 }}
				updateBase={updateBase}
			/>,
		);

		expect(screen.getByRole('button', { name: '/29' })).toBeTruthy();
		expect(screen.getByRole('button', { name: '/31' })).toBeTruthy();
		expect(screen.getByRole('button', { name: '/32' })).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: '/29' }));
		expect(updateBase).toHaveBeenCalledWith('192.168.1.0', 29);
	});
});
