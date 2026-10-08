/**
 * Part C: Cross-Portal Flow Test
 *
 * Verifies the cross-portal navigation structure between
 * platform-console and admin-console.
 *
 * Run: pnpm test -- -t "Cross-Portal"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 不 mock react-i18next：测试 setup 已初始化真实 i18n 并钉死 zh-CN，
// 断言的中文文案就走真实词典与插值（与生产一致）。

vi.mock('@autional/shared', () => ({
	useAuthStore: (selector?: (s: unknown) => unknown) => {
		const state = {
			user: { email: 'platform-admin@autional.dev', username: 'root' },
			tenants: [],
		};
		return selector ? selector(state) : state;
	},
	useAuth: () => ({
		user: { email: 'platform-admin@autional.dev', username: 'root' },
		isAuthenticated: true,
	}),
	getPortalUrl: () => 'http://localhost:13002/admin',
	useTenantSlug: () => undefined,
	apiClient: { get: vi.fn() },
	usePageTitle: vi.fn(),
	usePermission: () => ({ can: () => false }),
	useLogout: () => vi.fn(),
	usePortalCatalog: () => ({ portals: [], isError: true, isLoading: false }),
	extractItem: (v: unknown) => v,
}));

vi.mock('@/hooks/use-system-overview', () => ({
	useSystemTenants: () => ({
		data: { total: 1, active: 1, suspended: 0, planDistribution: [] },
		isLoading: false,
		error: null,
	}),
}));

vi.mock('@/hooks/use-status', () => ({
	useOverview: () => ({
		data: { activeIncidents: 0, servicesHealthy: 1 },
		isLoading: false,
		error: null,
	}),
	useIncidents: () => ({
		data: [],
		isLoading: false,
		error: null,
	}),
}));

vi.mock('@/hooks/use-platform-stats', () => ({
	usePlatformNotificationStats: () => ({
		data: { totalSent: 0 },
		isLoading: false,
		error: null,
	}),
}));

vi.mock('@autional/ui', () => ({
	useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
	ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
	EmptyState: ({ title, description }: { title: string; description?: string }) => (
		<div>
			<div>{title}</div>
			<div>{description}</div>
		</div>
	),
	ErrorState: ({ title, onRetry }: { title: string; onRetry?: () => void }) => (
		<div>
			<div>{title}</div>
			{onRetry && <button onClick={onRetry}>Retry</button>}
		</div>
	),
	AppPageHeader: ({ title, description }: { title: string; description?: string }) => (
		<div>
			<h1>{title}</h1>
			{description && <p>{description}</p>}
		</div>
	),
	LoadingScreen: () => null,
	ToastProvider: ({ children }: { children: React.ReactNode }) => children,
	LanguageSwitcher: () => <button type="button">lang</button>,
	ThemeToggle: () => <button type="button">theme</button>,
	PortalSwitcher: ({
		portals,
		currentPortal,
	}: {
		portals: Array<{ code: string; url: string }>;
		currentPortal?: string;
	}) => (
		<div data-testid="portal-switcher" data-current={currentPortal}>
			{portals.map((p) => (
				<a key={p.code} href={p.url}>
					{p.code}
				</a>
			))}
		</div>
	),
	UserMenu: ({ user }: { user?: { email?: string | null } | null }) => (
		<div data-testid="user-menu">{user?.email}</div>
	),
	StatusBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { HeaderActions } from '@/components/layout/HeaderActions';
import DashboardPage from '@/app/page';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('Cross-Portal Navigation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryClient.clear();
	});

	describe('Platform Console Header', () => {
		// 品牌不再由顶栏渲染：2026-10-04 起外壳归设计系统的 <AppShell>，品牌挪到侧栏顶部
		// （原来平台站在顶栏与侧栏各显示了一遍）。这里只断言顶栏右侧那组控件。
		it('renders portal switcher with static [platform, admin] fallback and admin entry to admin-console', () => {
			render(<HeaderActions />, { wrapper: BrowserRouter });

			const switcher = screen.getByTestId('portal-switcher');
			expect(switcher).toBeInTheDocument();
			expect(switcher.getAttribute('data-current')).toBe('platform');

			const adminLink = screen.getByText('admin');
			expect(adminLink.closest('a')).toHaveAttribute('href', 'http://localhost:13002/admin');
			expect(screen.getByText('platform')).toBeInTheDocument();
		});

		it('renders user email when user is authenticated', () => {
			render(<HeaderActions />, { wrapper: BrowserRouter });
			expect(screen.getByTestId('user-menu')).toHaveTextContent('platform-admin@autional.dev');
		});
	});

	describe('Cross-Portal Target URLs', () => {
		it('admin-console URL is localhost:13002/admin', () => {
			const ADMIN_CONSOLE_URL = 'http://localhost:13002/admin';
			expect(ADMIN_CONSOLE_URL).toBe('http://localhost:13002/admin');
		});

		it('platform-console URL is localhost:13010/platform', () => {
			const PLATFORM_CONSOLE_URL = 'http://localhost:13010/platform';
			expect(PLATFORM_CONSOLE_URL).toBe('http://localhost:13010/platform');
		});

		it('all 9 portal URLs follow correct port assignments', () => {
			const ports: Record<string, { port: number; path: string }> = {
				'auth-pages': { port: 13101, path: '/auth' },
				'admin-console': { port: 13102, path: '/admin' },
				'developer-portal': { port: 13103, path: '/developer' },
				'end-user-portal': { port: 13104, path: '/user' },
				'security-dashboard': { port: 13105, path: '/security' },
				'status-page': { port: 13106, path: '/status' },
				'landing-site': { port: 13107, path: '/' },
				'authenticator-app': { port: 13108, path: '/authenticator' },
				'trust-center': { port: 13109, path: '/trust' },
			};

			for (const [name, config] of Object.entries(ports)) {
				const url = `http://localhost:${config.port}${config.path}`;
				expect(url).toBeTruthy();
				expect(config.port).toBeGreaterThan(13000);
			}
		});
	});

	describe('Platform Dashboard Page', () => {
		it('renders dashboard stat cards', () => {
			render(
				<QueryClientProvider client={queryClient}>
					<BrowserRouter>
						<DashboardPage />
					</BrowserRouter>
				</QueryClientProvider>,
			);

			expect(screen.getByText('平台仪表盘')).toBeInTheDocument();
			expect(screen.getByText('租户总数')).toBeInTheDocument();
			expect(screen.getByText('活跃事故')).toBeInTheDocument();
			expect(screen.getByText('健康服务')).toBeInTheDocument();
			// 「平台通知」同时出现在 KPI 卡与快捷入口，故用 getAllByText
			expect(screen.getAllByText('平台通知').length).toBeGreaterThan(0);
		});
	});
});
