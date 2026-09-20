// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
	it('toggles the AI Assist button state', () => {
		const onToggleAutomation = vi.fn();
		render(
			<Header
				mode="equal-split"
				setMode={vi.fn()}
				automationVisible={true}
				onToggleAutomation={onToggleAutomation}
				onOpenSettings={vi.fn()}
			/>,
		);

		const button = screen.getByRole('button', { name: /Hide AI Assist/i });
		expect(button.getAttribute('aria-pressed')).toBe('true');
		fireEvent.click(button);
		expect(onToggleAutomation).toHaveBeenCalledTimes(1);
	});
});
