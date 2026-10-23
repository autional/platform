import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const logout = vi.fn();
let membership: 'member' | 'non-member' | 'unknown' = 'member';

vi.mock('@autional/shared', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@autional/shared')>();
	return {
		...actual,
		useLogout: () => logout,
		usePageTitle: vi.fn(),
		useTenantSlug: () => 'demo',
	};
});

vi.mock('@/components/auth/usePlatformMember', () => ({
	usePlatformMember: () => membership,
}));

import ForbiddenPage from '../page';

function renderPage() {
	return render(
		<MemoryRouter initialEntries={['/demo/403']}>
			<ForbiddenPage />
		</MemoryRouter>,
	);
}

describe('platform 403 page', () => {
	beforeEach(() => {
		logout.mockClear();
		membership = 'member';
	});

	it('主按钮切换账号（终结平台会话，避免同账号回环）', () => {
		renderPage();
		fireEvent.click(screen.getByRole('button', { name: '切换账号' }));
		expect(logout).toHaveBeenCalledTimes(1);
	});

	it('平台成员保留返回仪表盘', () => {
		renderPage();
		expect(screen.getByRole('button', { name: '返回仪表盘' })).toBeInTheDocument();
	});

	it('非平台成员不显示必回环的返回仪表盘', () => {
		membership = 'non-member';
		renderPage();
		expect(screen.queryByRole('button', { name: '返回仪表盘' })).toBeNull();
	});
});
