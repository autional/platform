import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@autional/shared', () => ({
	usePageTitle: vi.fn(),
	useBootstrap: () => 'done',
	useTenantSlug: () => 'platform',
	apiClient: { get: vi.fn(() => Promise.resolve({ data: {} })) },
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

import DashboardPage from '@/app/page';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderPage() {
	return render(
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				<DashboardPage />
			</BrowserRouter>
		</QueryClientProvider>,
	);
}

describe('DashboardPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryClient.clear();
	});

	it('renders the Platform Dashboard title', () => {
		renderPage();
		expect(screen.getByText('平台仪表盘')).toBeInTheDocument();
	});

	it('renders 4 Statistic cards', () => {
		renderPage();
		expect(screen.getByText('租户总数')).toBeInTheDocument();
		expect(screen.getByText('活跃事故')).toBeInTheDocument();
		expect(screen.getByText('健康服务')).toBeInTheDocument();
		// 「平台通知」同时出现在 KPI 卡与快捷入口，故用 getAllByText
		expect(screen.getAllByText('平台通知').length).toBeGreaterThan(0);
	});
});
