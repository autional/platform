/**
 * U409 回归：功能门控「清除覆盖」入口。
 *
 * 旧行为：租户覆盖只能开关（PUT upsert），无恢复套餐默认的路径（DELETE 端点缺失）。
 * 判据：
 *  - 存在租户覆盖（自定义）时出现「清除覆盖」，二次确认后才调用 DELETE；
 *  - 无覆盖（全部默认）时不出现该入口。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
	featureGates: vi.fn(),
	overrides: vi.fn(),
	putOverride: vi.fn(),
	deleteOverride: vi.fn(),
	message: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@autional/shared', () => ({
	useCurrentTenantId: () => 't-1',
	usePageTitle: vi.fn(),
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminBillingFeatureGates: (...args: unknown[]) => mocks.featureGates(...args),
	adminBillingFeatureGatesOverrides: (...args: unknown[]) => mocks.overrides(...args),
	adminBillingFeatureGatesOverridesPut: (...args: unknown[]) => mocks.putOverride(...args),
	adminBillingFeatureGatesOverridesByOverridesDelete: (...args: unknown[]) =>
		mocks.deleteOverride(...args),
}));

vi.mock('antd', async (importOriginal) => {
	const actual = await importOriginal<typeof import('antd')>();
	return {
		...actual,
		App: { ...actual.App, useApp: () => ({ message: mocks.message }) },
	};
});

import FeatureGatesPage from '@/app/feature-gates/page';

function renderPage() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<FeatureGatesPage />
		</QueryClientProvider>
	);
}

describe('FeatureGatesPage (U409 清除覆盖)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.featureGates.mockResolvedValue({
			featureGates: [{ key: 'gate.a', name: 'Gate A', enabled: true }],
		});
		mocks.deleteOverride.mockResolvedValue(undefined);
	});

	it('存在租户覆盖时：二次确认后才调用删除接口', async () => {
		mocks.overrides.mockResolvedValue({ overrides: [{ gate_key: 'gate.a', enabled: false }] });
		const user = userEvent.setup();
		renderPage();

		const clearBtn = await screen.findByRole('button', { name: '清除覆盖' });
		await user.click(clearBtn);

		// 确认前不得触达 DELETE
		expect(mocks.deleteOverride).not.toHaveBeenCalled();
		expect(await screen.findByText('清除该门控的租户覆盖？')).toBeInTheDocument();

		// antd 对两字中文按钮自动插入空格（「清 除」），accessibility name 随之带空格
		await user.click(await screen.findByRole('button', { name: /^清\s*除$/ }));

		await waitFor(() => {
			expect(mocks.deleteOverride).toHaveBeenCalledWith('gate.a');
		});
		await waitFor(() => {
			expect(mocks.message.success).toHaveBeenCalled();
		});
	}, 20000);

	it('无租户覆盖（全部默认）时不出现清除入口', async () => {
		mocks.overrides.mockResolvedValue({ overrides: [] });
		renderPage();

		await screen.findByText(/生效范围：当前租户/);
		expect(screen.queryByRole('button', { name: '清除覆盖' })).not.toBeInTheDocument();
	}, 20000);
});
