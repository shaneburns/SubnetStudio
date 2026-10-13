// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

afterEach(cleanup);

describe('Header', () => {
	it('toggles the AI Assist button state when automation is enabled', () => {
		const onToggleAutomation = vi.fn();
		render(
			<Header
				mode="equal-split"
				setMode={vi.fn()}
				automationEnabled={true}
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

	it('does not render the AI Assist button when automation is disabled', () => {
		render(
			<Header
				mode="equal-split"
				setMode={vi.fn()}
				automationEnabled={false}
				onOpenSettings={vi.fn()}
			/>,
		);

		expect(screen.queryByRole('button', { name: /AI Assist/i })).toBeNull();
		expect(screen.getByRole('button', { name: /Open settings/i })).toBeTruthy();
	});

	it('hides the AI Assist button by default', () => {
		render(<Header mode="vlsm" setMode={vi.fn()} onOpenSettings={vi.fn()} />);
		expect(screen.queryByRole('button', { name: /AI Assist/i })).toBeNull();
	});
});
