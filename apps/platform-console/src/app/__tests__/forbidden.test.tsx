import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** 403 页依赖 useLogout → shared hooks → react-query；没有 Provider 会直接抛「No QueryClient set」。 */
function Providers({ children }: { children: React.ReactNode }) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return (
		<QueryClientProvider client={client}>
			<MemoryRouter>{children}</MemoryRouter>
		</QueryClientProvider>
	);
}

const mockNavigate = vi.fn();
const mockSlug = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('react-router', async () => {
	const actual = await vi.importActual('react-router');
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

// 用 importOriginal 保底：403 页及其依赖链会用到 shared 的多个导出（useLogout / useAuthStore …），
// 逐个手写 mock 等于每次新增依赖就红一次；这里只覆盖本用例关心的三个。
vi.mock('@autional/shared', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@autional/shared')>();
	return {
		...actual,
		usePageTitle: vi.fn(),
		useTenantSlug: () => mockSlug.value,
		useLogout: () => vi.fn(),
	};
});

const mockMembership = vi.hoisted(() => ({ value: 'member' as PlatformMemberState }));

// 403 页只在「已确认是平台成员」时才渲染「返回仪表盘」（非成员点了会被守卫送回 403，成环）。
vi.mock('@/components/auth/usePlatformMember', () => ({
	usePlatformMember: () => mockMembership.value,
}));

import ForbiddenPage from '@/app/403/page';
import type { PlatformMemberState } from '@/components/auth/usePlatformMember';

describe('ForbiddenPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSlug.value = undefined;
		mockMembership.value = 'member';
	});

	it('renders 403 status', () => {
		render(
			<Providers>
				<ForbiddenPage />
			</Providers>,
		);
		expect(screen.getByText('403')).toBeInTheDocument();
	});

	it('has Back to Dashboard button', () => {
		render(
			<Providers>
				<ForbiddenPage />
			</Providers>,
		);
		expect(screen.getByRole('button', { name: '返回仪表盘' })).toBeInTheDocument();
	});

	it('navigates back to slug-scoped dashboard root (not bare /)', async () => {
		mockSlug.value = 'demo';
		const user = userEvent.setup();
		render(
			<Providers>
				<ForbiddenPage />
			</Providers>,
		);

		await user.click(screen.getByRole('button', { name: '返回仪表盘' }));

		expect(mockNavigate).toHaveBeenCalledWith('/demo');
	});
});
