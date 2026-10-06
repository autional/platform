/**
 * PL-38 回归：Robot 详情「停用」为不可逆操作，必须先确认。
 *
 * 旧行为：点击「停用」立即调用停用接口。
 * 判据：确认前不得调用停用接口；确认（含风险文案）后才调用。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
	getRobot: vi.fn(),
	decommission: vi.fn(),
	commission: vi.fn(),
	updateRobot: vi.fn(),
	intent: vi.fn(),
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminRobotsByRobots: (...args: unknown[]) => mocks.getRobot(...args),
	adminRobotsByRobotsPut: (...args: unknown[]) => mocks.updateRobot(...args),
	adminRobotsCommissionByRobotsPost: (...args: unknown[]) => mocks.commission(...args),
	adminRobotsDecommissionByRobotsPost: (...args: unknown[]) => mocks.decommission(...args),
	adminRobotsIntentByRobotsPost: (...args: unknown[]) => mocks.intent(...args),
}));

vi.mock('@autional/shared', () => ({
	usePageTitle: vi.fn(),
	useTenantSlug: () => 'demo',
}));

vi.mock('@/lib/antd-app', () => ({
	message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
	modal: { confirm: vi.fn() },
}));

vi.mock('@/lib/error-handler', () => ({
	handleApiError: vi.fn(),
}));

vi.mock('react-router', async () => {
	const actual = await vi.importActual<typeof import('react-router')>('react-router');
	return { ...actual, useParams: () => ({ id: 'r-1' }), useNavigate: () => vi.fn() };
});

import RobotDetailPage from '@/app/robots/[id]/page';

function renderPage() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<RobotDetailPage />
		</QueryClientProvider>,
	);
}

describe('RobotDetailPage (PL-38 停用二次确认)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getRobot.mockResolvedValue({
			id: 'r-1',
			name: 'assembly-bot-1',
			status: 'active',
			model: 'UR5e',
		});
		mocks.decommission.mockResolvedValue(undefined);
	});

	it('点击「停用」先弹确认（含风险文案），确认后才调用停用接口', async () => {
		const user = userEvent.setup();
		renderPage();

		// 图标 span（role=img aria-label=pause-circle）会并入按钮 accessible name，
		// 实际名称为「pause-circle停用」，故用尾部锚定正则匹配文案
		const decommissionBtn = await screen.findByRole('button', { name: /停用$/ });
		await user.click(decommissionBtn);

		expect(mocks.decommission).not.toHaveBeenCalled();
		expect(screen.getByText(/将产生审计记录/)).toBeInTheDocument();

		const confirmBtn = await screen.findByRole('button', { name: '确认停用' });
		await user.click(confirmBtn);

		await waitFor(() => {
			expect(mocks.decommission).toHaveBeenCalledWith('r-1');
		});
	}, 20000);
});
