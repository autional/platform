/**
 * U408 回归：Robot 状态机视图层与后端对齐（N18 robots 状态机死路）。
 *
 * 旧行为：新建（commissioning）后前端「启用」按钮不可达（条件写的是 decommissioned/provisioning
 * 这对后端不存在的组合）⇒ 列表/详情全流程死路；「启用状态：」条件链全不匹配整块挂空；
 * 状态列为英文原值且变体表含后端不存在的 offline/maintenance/provisioning。
 *
 * 判据：① 动作门 = 后端守卫（commissioning→可启用；active∪degraded→可停用/可签发）；
 * ② 中文状态标签全状态覆盖；③ 未知/历史状态走兜底不静默。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { operationHint, statusLabel, statusVariant } from '@/lib/robot-status';

const mocks = vi.hoisted(() => ({
	getRobot: vi.fn(),
	decommission: vi.fn(),
	commission: vi.fn(),
	updateRobot: vi.fn(),
	intent: vi.fn(),
	listRobots: vi.fn(),
	createRobot: vi.fn(),
	deleteRobot: vi.fn(),
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminRobotsByRobots: (...args: unknown[]) => mocks.getRobot(...args),
	adminRobotsByRobotsPut: (...args: unknown[]) => mocks.updateRobot(...args),
	adminRobotsCommissionByRobotsPost: (...args: unknown[]) => mocks.commission(...args),
	adminRobotsDecommissionByRobotsPost: (...args: unknown[]) => mocks.decommission(...args),
	adminRobotsIntentByRobotsPost: (...args: unknown[]) => mocks.intent(...args),
	adminRobots: (...args: unknown[]) => mocks.listRobots(...args),
	adminRobotsPost: (...args: unknown[]) => mocks.createRobot(...args),
	adminRobotsByRobotsDelete: (...args: unknown[]) => mocks.deleteRobot(...args),
}));

vi.mock('@autional/shared', () => ({
	usePageTitle: vi.fn(),
	useTenantSlug: () => 'demo',
	fromPageResult: (res: unknown) => res,
	toPageParams: (p: unknown) => p,
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
import RobotsPage from '@/app/robots/page';

function renderPage(node: ReactElement) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

describe('robot-status 单源映射表', () => {
	it('statusLabel：五态中文全覆盖，未知回透传、空回 '-'（不静默丢状态）', () => {
		expect(statusLabel('commissioning')).toBe('待启用');
		expect(statusLabel('active')).toBe('活跃');
		expect(statusLabel('degraded')).toBe('降级运行');
		expect(statusLabel('decommissioned')).toBe('已停用');
		expect(statusLabel('deleted')).toBe('已删除');
		expect(statusLabel('mystery')).toBe('mystery');
		expect(statusLabel(undefined)).toBe('-');
	});

	it('statusVariant：后端五态各有变体；历史死状态回兜底 neutral', () => {
		expect(statusVariant('commissioning')).toBe('info');
		expect(statusVariant('active')).toBe('success');
		expect(statusVariant('degraded')).toBe('warning');
		expect(statusVariant('decommissioned')).toBe('neutral');
		expect(statusVariant('deleted')).toBe('danger');
		// 回归锁：后端不存在的状态不再被特判（旧列表页曾把 offline/maintenance/provisioning 当真实状态着色）。
		expect(statusVariant('offline')).toBe('neutral');
		expect(statusVariant('maintenance')).toBe('neutral');
		expect(statusVariant('provisioning')).toBe('neutral');
	});

	it('operationHint：五态全有文案（旧「启用状态：」条件链挂空回归锁），未知走兜底', () => {
		for (const s of ['commissioning', 'active', 'degraded', 'decommissioned', 'deleted']) {
			expect(operationHint(s).text).not.toBe('');
		}
		expect(operationHint('mystery').text).toContain('未知状态');
	});
});

describe('RobotDetailPage 动作门与状态机对齐（U408）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('commissioning：显示「启用」，隐藏「停用」「签发 Intent」（旧版新建即死路回归锁）', async () => {
		mocks.getRobot.mockResolvedValue({ name: 'bot-new', status: 'commissioning' });
		renderPage(<RobotDetailPage />);

		expect(await screen.findByRole('button', { name: /启用$/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /停用$/ })).toBeNull();
		expect(screen.queryByRole('button', { name: /签发 Intent/ })).toBeNull();
		expect(screen.getByText('待启用 —— 可点击「启用」上线')).toBeInTheDocument();
		expect(screen.getByText('待启用')).toBeInTheDocument();
	}, 20000);

	it('active：显示「停用」「签发 Intent」，隐藏「启用」', async () => {
		mocks.getRobot.mockResolvedValue({ name: 'bot-live', status: 'active' });
		renderPage(<RobotDetailPage />);

		expect(await screen.findByRole('button', { name: /停用$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /签发 Intent/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /启用$/ })).toBeNull();
		expect(screen.getByText('活跃 —— 可停用、可签发 Intent')).toBeInTheDocument();
	}, 20000);

	it('degraded：与 active 同集（可停用、可签发）', async () => {
		mocks.getRobot.mockResolvedValue({ name: 'bot-deg', status: 'degraded' });
		renderPage(<RobotDetailPage />);

		expect(await screen.findByRole('button', { name: /停用$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /签发 Intent/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /启用$/ })).toBeNull();
		expect(screen.getByText('降级运行')).toBeInTheDocument();
	}, 20000);

	it('decommissioned：三动作全隐藏，「启用状态：」不再挂空', async () => {
		mocks.getRobot.mockResolvedValue({ name: 'bot-old', status: 'decommissioned' });
		renderPage(<RobotDetailPage />);

		expect(await screen.findByText('已停用 —— 不可再启用')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /启用$/ })).toBeNull();
		expect(screen.queryByRole('button', { name: /停用$/ })).toBeNull();
		expect(screen.queryByRole('button', { name: /签发 Intent/ })).toBeNull();
		expect(screen.getByText('已停用')).toBeInTheDocument();
	}, 20000);
});

describe('RobotsPage 列表状态列（U408）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('状态列渲染中文标签，不再外露英文原值', async () => {
		mocks.listRobots.mockResolvedValue({
			items: [
				{ identityId: 'r-1', name: 'bot-a', status: 'commissioning' },
				{ identityId: 'r-2', name: 'bot-b', status: 'deleted' },
			],
			total: 2,
		});
		renderPage(<RobotsPage />);

		expect(await screen.findByText('待启用')).toBeInTheDocument();
		expect(screen.getByText('已删除')).toBeInTheDocument();
		expect(screen.queryByText('commissioning')).toBeNull();
		expect(screen.queryByText('deleted')).toBeNull();
	}, 20000);
});
