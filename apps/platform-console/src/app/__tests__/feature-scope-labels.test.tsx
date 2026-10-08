/**
 * PL-55(b)(c) 回归：功能开关两页必须标明真实生效范围。
 *  - feature-gates（计费功能开关）：按当前租户生效（套餐默认 + 租户覆盖）；
 *  - feature-flags（矩阵）：网关内置清单，按当前部署生效、非租户级。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
	featureGates: vi.fn(),
	overrides: vi.fn(),
	putOverride: vi.fn(),
	featureFlags: vi.fn(),
}));

vi.mock('@autional/shared', () => ({
	useCurrentTenantId: () => 't-1',
	usePageTitle: vi.fn(),
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminBillingFeatureGates: (...args: unknown[]) => mocks.featureGates(...args),
	adminBillingFeatureGatesOverrides: (...args: unknown[]) => mocks.overrides(...args),
	adminBillingFeatureGatesOverridesPut: (...args: unknown[]) => mocks.putOverride(...args),
	adminBillingFeatureGatesOverridesByOverridesDelete: vi.fn(),
	adminFeatureFlags: (...args: unknown[]) => mocks.featureFlags(...args),
}));

import FeatureGatesPage from '@/app/feature-gates/page';
import FeatureFlagsPage from '@/app/feature-flags/page';

function renderPage(ui: React.ReactElement) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('PL-55 生效范围标识', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.featureGates.mockResolvedValue({
			featureGates: [{ key: 'gate.a', name: 'Gate A', enabled: true }],
		});
		mocks.overrides.mockResolvedValue({ overrides: [] });
		mocks.featureFlags.mockResolvedValue({
			services: [{ service: 'identity', flags: [{ key: 'grpc', value: 'true' }] }],
		});
	});

	it('feature-gates：标明「当前租户」生效范围', async () => {
		renderPage(<FeatureGatesPage />);
		expect(await screen.findByText(/生效范围：当前租户/)).toBeInTheDocument();
	}, 20000);

	it('feature-flags：标明「当前部署（全部服务，非租户级）」生效范围', async () => {
		renderPage(<FeatureFlagsPage />);
		expect(await screen.findByText(/生效范围：当前部署（全部服务，非租户级）/)).toBeInTheDocument();
	}, 20000);
});
