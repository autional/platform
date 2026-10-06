import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const mockNavigate = vi.fn();
const mockSlug = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('react-router', async () => {
	const actual = await vi.importActual('react-router');
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock('@autional/shared', () => ({
	usePageTitle: vi.fn(),
	useTenantSlug: () => mockSlug.value,
}));

import ForbiddenPage from '@/app/403/page';

describe('ForbiddenPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSlug.value = undefined;
	});

	it('renders 403 status', () => {
		render(
			<MemoryRouter>
				<ForbiddenPage />
			</MemoryRouter>,
		);
		expect(screen.getByText('403')).toBeInTheDocument();
	});

	it('has Back to Dashboard button', () => {
		render(
			<MemoryRouter>
				<ForbiddenPage />
			</MemoryRouter>,
		);
		expect(screen.getByRole('button', { name: '返回仪表盘' })).toBeInTheDocument();
	});

	it('navigates back to slug-scoped dashboard root (not bare /)', async () => {
		mockSlug.value = 'demo';
		const user = userEvent.setup();
		render(
			<MemoryRouter>
				<ForbiddenPage />
			</MemoryRouter>,
		);

		await user.click(screen.getByRole('button', { name: '返回仪表盘' }));

		expect(mockNavigate).toHaveBeenCalledWith('/demo');
	});
});
