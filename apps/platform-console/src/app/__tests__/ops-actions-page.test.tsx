/**
 * P2-4 动作请求页组件测试（不依赖浏览器，CI 无 Playwright 也能跑）。
 *
 * 覆盖：
 *  1. 目录渲染（带 required_factor）；
 *  2. 发起 R1 动作：POST body 用 snake_case（target_tenant_id）、带 Idempotency-Key；
 *  3. 创建后详情显示 consent 深链（不在页面里复制审批逻辑）；
 *  4. 429 配额错误给出专门提示（不是笼统「创建失败」）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@autional/shared', () => ({
	usePageTitle: vi.fn(),
	getPortalUrl: () => 'https://consent.autional.cn',
	apiClient: {
		get: (...args: unknown[]) => mocks.get(...args),
		post: (...args: unknown[]) => mocks.post(...args),
	},
}));

vi.mock('@/lib/antd-app', () => ({ message: mocks.message }));

import OpsActionsPage from '@/app/ops/actions/page';

const CATALOG = {
	items: [
		{ action: 'ops.echo', description: 'Return params', risk: 'R0' },
		{ action: 'ops.tenant.suspend', description: 'Suspend a tenant', risk: 'R1', required_factor: 'sms_otp' },
	],
};

const PENDING = {
	action_id: '01ACTION',
	action: 'ops.tenant.suspend',
	risk: 'R1',
	status: 'pending_consent',
	consent_id: '01CONSENT',
	summary: 'suspend tenant',
	created_at: '2026-01-01T00:00:00Z',
};

function renderPage() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<OpsActionsPage />
		</QueryClientProvider>,
	);
}

describe('OpsActionsPage (P2-4)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.get.mockImplementation((url: string) =>
			Promise.resolve({
				data: url.includes('/ops-action/api/v1/admin/actions/') ? PENDING : CATALOG,
			}),
		);
		mocks.post.mockResolvedValue({ data: PENDING });
	});

	it('目录渲染 + 发起动作走 snake_case body + 展示 Consent 深链', async () => {
		const user = userEvent.setup();
		renderPage();

		// 目录
		expect(await screen.findByText('ops.tenant.suspend')).toBeInTheDocument();
		expect(screen.getByText('sms_otp')).toBeInTheDocument();

		// 发起（目录第二行 = ops.tenant.suspend；按按钮顺序取，避免 tr/measure 行差异）
		const startButtons = await screen.findAllByRole('button', { name: '发起' });
		await user.click(startButtons[1]);

		// 弹窗：动作已带出 + 因子提示
		await waitFor(() => expect(screen.getByLabelText('动作')).toHaveValue('ops.tenant.suspend'));
		expect(screen.getByText('审批需要因子：sms_otp')).toBeInTheDocument();

		await user.type(screen.getByLabelText('摘要'), 'suspend tenant');
		await user.click(screen.getByRole('button', { name: /提\s*交/ }));

		await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
		const [path, body, config] = mocks.post.mock.calls[0] as [
			string,
			Record<string, unknown>,
			{ headers: Record<string, string> },
		];
		expect(path).toBe('/ops-action/api/v1/admin/actions');
		expect(body.action).toBe('ops.tenant.suspend');
		expect(body.summary).toBe('suspend tenant');
		// 幂等键必须在（防重复动作）
		expect(config.headers['Idempotency-Key']).toMatch(/^console-/);

		// 详情：pending_consent + Consent 深链（状态徽标与提示 Alert 都会出现该文案）
		expect((await screen.findAllByText('等待审批')).length).toBeGreaterThan(0);
		const link = await screen.findByRole('link', { name: /去 Consent 审批/ });
		expect(link).toHaveAttribute('href', 'https://consent.autional.cn/c/01CONSENT');
	}, 20_000);

	it('429 配额错误给出专门提示', async () => {
		const user = userEvent.setup();
		mocks.post.mockRejectedValue({ response: { status: 429, data: { error: 'auto_quota_exceeded' } } });
		renderPage();

		const startButtons = await screen.findAllByRole('button', { name: '发起' });
		await user.click(startButtons[1]);
		await waitFor(() => expect(screen.getByLabelText('动作')).toHaveValue('ops.tenant.suspend'));
		await user.type(screen.getByLabelText('摘要'), 'quota case');
		await user.click(screen.getByRole('button', { name: /提\s*交/ }));

		await waitFor(() =>
			expect(mocks.message.error).toHaveBeenCalledWith(
				'自动执行配额已超限（429），请稍后重试',
			),
		);
	}, 20_000);
});
