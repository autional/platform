/**
 * U410 回归：Agent 详情三表契约对齐（N20 表格契约错配家族）。
 *
 * 旧行为：活动表时间列绑 timestamp（后端为 created_at）恒 '-'；凭证表绑后端不存在的
 * type/last_used_at/expires_at（「最后使用/过期时间」幻影两列恒 '-'），丢 key_prefix/created_at；
 * 活动/权限 DTO 无 id 而三表 rowKey="id" ⇒ React key 塌陷警告；状态映射两页各持一份且缺
 * rotating/revoked/deleted ⇒ 裸英文外露（线上 revoked Agent 实测）。
 *
 * 判据：① 状态单源映射全枚举覆盖，后端不存在键走兜底；② 三表列绑定真字段（时间格式化非 '-'、
 * 凭证前缀/类型/创建时间渲染、幻影列不复存在）；③ 无 id 表复合 rowKey 零 React key 警告。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { statusLabel, statusVariant } from '@/lib/agent-status';

const mocks = vi.hoisted(() => ({
	getAgent: vi.fn(),
	putAgent: vi.fn(),
	listAgents: vi.fn(),
	postAgent: vi.fn(),
	deleteAgent: vi.fn(),
	apiGet: vi.fn(),
}));

vi.mock('@autional/shared', () => ({
	apiClient: { get: (...args: unknown[]) => mocks.apiGet(...args) },
	extractItem: (x: unknown) => x,
	usePageTitle: vi.fn(),
	useTenantSlug: () => 'demo',
	fromPageResult: (res: unknown) => res,
	toPageParams: (p: unknown) => p,
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminAgentsByAgents: (...args: unknown[]) => mocks.getAgent(...args),
	adminAgentsByAgentsPut: (...args: unknown[]) => mocks.putAgent(...args),
	adminAgents: (...args: unknown[]) => mocks.listAgents(...args),
	adminAgentsPost: (...args: unknown[]) => mocks.postAgent(...args),
	adminAgentsByAgentsDelete: (...args: unknown[]) => mocks.deleteAgent(...args),
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
	return { ...actual, useParams: () => ({ id: 'a-1' }), useNavigate: () => vi.fn() };
});

import AgentDetailPage from '@/app/agents/[id]/page';
import AgentsPage from '@/app/agents/page';

function renderPage(node: ReactElement) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

// 三子资源 URL → 信封 {items}（apiClient 已做 camelCaseKeys，这里给的就是 camelCase 真形状）
function mockSubResources(payload: {
	credentials?: unknown[];
	activity?: unknown[];
	permissions?: unknown[];
}) {
	mocks.apiGet.mockImplementation((url: string) => {
		if (url.includes('/credentials'))
			return Promise.resolve({ data: { items: payload.credentials ?? [] } });
		if (url.includes('/activity'))
			return Promise.resolve({ data: { items: payload.activity ?? [] } });
		if (url.includes('/permissions'))
			return Promise.resolve({ data: { items: payload.permissions ?? [] } });
		return Promise.reject(new Error(`unexpected url: ${url}`));
	});
}

describe('agent-status 单源映射表', () => {
	it('statusLabel：五态中文全覆盖，未知回透传、空回 \'-\'（不静默丢状态）', () => {
		expect(statusLabel('provisioning')).toBe('配置中');
		expect(statusLabel('active')).toBe('活跃');
		expect(statusLabel('rotating')).toBe('凭证轮换中');
		expect(statusLabel('revoked')).toBe('已吊销');
		expect(statusLabel('deleted')).toBe('已删除');
		expect(statusLabel('mystery')).toBe('mystery');
		expect(statusLabel(undefined)).toBe('-');
	});

	it('statusVariant：后端五态各有变体；历史死键回兜底 neutral', () => {
		expect(statusVariant('provisioning')).toBe('info');
		expect(statusVariant('active')).toBe('success');
		expect(statusVariant('rotating')).toBe('warning');
		expect(statusVariant('revoked')).toBe('danger');
		expect(statusVariant('deleted')).toBe('neutral');
		// 回归锁：旧映射表里的 disabled/suspended 后端不存在，不再被特判着色。
		expect(statusVariant('disabled')).toBe('neutral');
		expect(statusVariant('suspended')).toBe('neutral');
	});
});

describe('AgentDetailPage 三表契约（U410）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getAgent.mockResolvedValue({ identityId: 'a-1', name: 'verify-agent', status: 'active' });
		mocks.apiGet.mockResolvedValue({ data: { items: [] } });
	});

	it('凭证表绑定真字段：前缀/类型/创建时间渲染，幻影两列不复存在', async () => {
		// agent 状态用 provisioning，避免与凭证 active 的「活跃」标签多匹配
		mocks.getAgent.mockResolvedValue({
			identityId: 'a-1',
			name: 'verify-agent',
			status: 'provisioning',
		});
		mockSubResources({
			credentials: [
				{
					id: 'c-1',
					agentId: 'a-1',
					name: '默认凭证',
					credType: 'client_credentials',
					keyPrefix: 'agnt_9f2a',
					status: 'active',
					createdAt: '2026-10-01T02:00:00Z',
				},
				{
					id: 'c-2',
					agentId: 'a-1',
					name: '旧凭证',
					credType: 'client_credentials',
					keyPrefix: 'agnt_11bc',
					status: 'revoked',
					createdAt: '2026-09-20T06:00:00Z',
				},
			],
		});
		renderPage(<AgentDetailPage />);

		expect(await screen.findByText('默认凭证')).toBeInTheDocument();
		expect(screen.getByText('旧凭证')).toBeInTheDocument();
		// key_prefix 渲染（旧版整个字段不显示）
		expect(screen.getByText('agnt_9f2a')).toBeInTheDocument();
		expect(screen.getByText('agnt_11bc')).toBeInTheDocument();
		// cred_type 列（旧版绑不存在的 type 恒 '-'）
		expect(screen.getAllByText('client_credentials')).toHaveLength(2);
		// 状态走单源映射：revoked 不再裸英文
		expect(screen.getByText('活跃')).toBeInTheDocument();
		expect(screen.getByText('已吊销')).toBeInTheDocument();
		expect(screen.queryByText('revoked')).toBeNull();
		// created_at 列已格式化（旧版无此列；时间列同族曾恒 '-'）
		expect(
			screen.getByText(new Date('2026-10-01T02:00:00Z').toLocaleDateString('zh-CN')),
		).toBeInTheDocument();
		// 幻影列（后端无 last_used_at/expires_at 数据）不复存在
		expect(screen.queryByText('最后使用')).toBeNull();
		expect(screen.queryByText('过期时间')).toBeNull();
	}, 20000);

	it('活动表时间列绑 createdAt：格式化渲染非 \'-\'（旧版绑 timestamp 恒 \'-\'）', async () => {
		mockSubResources({
			activity: [
				{
					action: 'agent.created',
					detail: '创建 Agent',
					operatorId: 'u-1',
					createdAt: '2026-10-02T03:00:00Z',
				},
			],
		});
		renderPage(<AgentDetailPage />);

		expect(await screen.findByText('agent.created')).toBeInTheDocument();
		expect(
			screen.getByText(new Date('2026-10-02T03:00:00Z').toLocaleDateString('zh-CN')),
		).toBeInTheDocument();
	}, 20000);

	it('无 id 表（活动/权限）复合 rowKey：重复渲染零 React key 警告', async () => {
		const errorSpy = vi.spyOn(console, 'error');
		try {
			mockSubResources({
				permissions: [
					{
						code: 'agents.read',
						name: '读取 Agent',
						resource: 'agents',
						action: 'read',
						effect: 'allow',
					},
					{
						code: 'agents.write',
						name: '写入 Agent',
						resource: 'agents',
						action: 'write',
						effect: 'allow',
					},
				],
				activity: [
					{ action: 'agent.created', detail: '创建 Agent', createdAt: '2026-10-02T03:00:00Z' },
					{ action: 'agent.updated', detail: '更新 Agent', createdAt: '2026-10-03T03:00:00Z' },
				],
			});
			renderPage(<AgentDetailPage />);

			// 权限表渲染 resource/action 两列（code 不作列）
			expect(await screen.findByText('read')).toBeInTheDocument();
			expect(screen.getByText('write')).toBeInTheDocument();
			expect(screen.getByText('agent.updated')).toBeInTheDocument();

			const keyWarnings = errorSpy.mock.calls.filter(
				(call) => typeof call[0] === 'string' && call[0].includes('unique "key"'),
			);
			expect(keyWarnings).toEqual([]);
		} finally {
			errorSpy.mockRestore();
		}
	}, 20000);

	it('Agent 状态列：revoked 渲染「已吊销」不裸英文', async () => {
		mocks.getAgent.mockResolvedValue({
			identityId: 'a-1',
			name: 'verify-agent',
			status: 'revoked',
		});
		renderPage(<AgentDetailPage />);

		expect(await screen.findByText('已吊销')).toBeInTheDocument();
		expect(screen.queryByText('revoked')).toBeNull();
	}, 20000);
});

describe('AgentsPage 列表状态列（U410）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('状态列渲染中文标签，不再外露英文原值', async () => {
		mocks.listAgents.mockResolvedValue({
			items: [
				{ identityId: 'a-1', name: 'bot-revoked', status: 'revoked' },
				{ identityId: 'a-2', name: 'bot-rotating', status: 'rotating' },
			],
			total: 2,
		});
		renderPage(<AgentsPage />);

		expect(await screen.findByText('已吊销')).toBeInTheDocument();
		expect(screen.getByText('凭证轮换中')).toBeInTheDocument();
		expect(screen.queryByText('revoked')).toBeNull();
		expect(screen.queryByText('rotating')).toBeNull();
	}, 20000);
});
