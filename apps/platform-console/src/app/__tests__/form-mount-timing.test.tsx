/**
 * U412① 回归：弹窗表单「未挂载即调用」时序锁（rc-field-form deferred 告警）。
 *
 * 机制（@rc-component/form useForm.js）：resetFields/setFieldsValue 等实例方法调用时若实例
 * 尚未挂载（Form 未渲染），会排一个延迟复核并在复核时告警
 * 「Instance created by `useForm` is not connected to any Form element」。
 *
 * 病灶：destroyOnHidden 的 Modal 在从未打开时不渲染子树（rc-dialog DialogWrap early return），
 * 而「创建」按钮 onClick 先 resetFields/setFieldsValue 再开弹窗 ⇒ 首次点击命中未挂载窗口；
 * minors 为非弹窗表单，loadConfig 内 setFieldsValue 早于 Form 首次挂载（loading 早退）。
 *
 * 修复：Modal 加 forceRender（内容随页挂载，交互前 formHooked 已置位）+ minors 由 effect 回填。
 *
 * 判据（主）：forceRender 的可观测契约 = 页面挂载后弹窗子树（role="dialog"）已在 DOM。
 * 实测修复前为 0 个（rc-portal 未开不渲染），修复后 ≥1。
 * 判据（次）：零未挂载告警。jsdom+act 会在断言前冲刷完挂载，rc-form 的延迟复核不复现该
 * 告警（阳性对照失败：修复前 4 项全绿）——故仅作弱信号，主判别力在上面的 DOM 预挂载锁。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const UNHOOKED_MARK = 'not connected to any Form element';

function collectUnhooked(spy: ReturnType<typeof vi.spyOn>): string[] {
	return (spy as unknown as { mock: { calls: unknown[][] } }).mock.calls
		.map((args) => args.map((a) => String(a)).join(' '))
		.filter((line) => line.includes(UNHOOKED_MARK));
}

async function captureUnhookedWarnings(run: () => Promise<unknown>): Promise<string[]> {
	const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		await run();
		await new Promise((resolve) => setTimeout(resolve, 80));
		return collectUnhooked(spy);
	} finally {
		spy.mockRestore();
	}
}

const mocks = vi.hoisted(() => ({
	getMinorsConfig: vi.fn(),
	putMinorsConfig: vi.fn(),
	adminUsers: vi.fn(),
	adminConsents: vi.fn(),
}));

vi.mock('@/hooks/use-status', () => ({
	useIncidents: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
	useIncident: () => ({ data: undefined, isLoading: false }),
	useCreateIncident: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useUpdateIncident: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useDeleteIncident: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useAddIncidentUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useMaintenances: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
	useCreateMaintenance: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useUpdateMaintenance: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useDeleteMaintenance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/use-tenants', () => ({
	useTenants: () => ({
		data: {
			items: [
				{ id: 't-1', name: 'demo', domain: 'demo.localhost', status: 'active', createdAt: '2026-10-01T00:00:00Z' },
			],
			total: 1,
		},
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useCreateTenant: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useUpdateTenant: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useDeleteTenant: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useActivateTenant: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useSuspendTenant: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/use-members', () => ({
	useMembers: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('@/hooks/use-applications', () => ({
	useApplications: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('react-router', async () => {
	const actual = await vi.importActual<typeof import('react-router')>('react-router');
	return {
		...actual,
		useNavigate: () => vi.fn(),
		useParams: () => ({}),
		useSearchParams: () => [new URLSearchParams(), vi.fn()],
	};
});

vi.mock('@/lib/antd-app', () => ({
	message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
	modal: { confirm: vi.fn() },
	notification: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/error-handler', () => ({
	handleApiError: vi.fn(),
	classifyApiError: vi.fn(() => 'unknown'),
	apiErrorCopy: vi.fn(() => null),
	extractApiErrorMessage: vi.fn(() => ''),
}));

vi.mock('@autional/shared', () => ({
	AuthService: { getCurrentTenantId: () => 't-1' },
	fromPageResult: (d: any) => ({ items: d?.items ?? [], total: d?.total ?? 0 }),
	toPageParams: (p: unknown) => p,
	usePageTitle: vi.fn(),
	useTenantSlug: () => 'demo',
	useCurrentTenantId: () => 't-1',
	apiClient: { get: vi.fn() },
	extractItem: (x: unknown) => x,
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminTenantsMinorsProtectionByTenants: (...args: unknown[]) => mocks.getMinorsConfig(...args),
	adminTenantsMinorsProtectionByTenantsPut: (...args: unknown[]) => mocks.putMinorsConfig(...args),
	adminUsers: (...args: unknown[]) => mocks.adminUsers(...args),
	adminConsents: (...args: unknown[]) => mocks.adminConsents(...args),
}));

import IncidentsPage from '@/app/status/incidents/page';
import MaintenancesPage from '@/app/status/maintenances/page';
import TenantsPage from '@/app/tenants/page';
import MinorsProtectionPage from '@/app/compliance/minors/page';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getMinorsConfig.mockResolvedValue({
		dailyUsageLimitMin: 60,
		monthlySpendLimit: 10000,
		nightModeEnabled: false,
		nightModeStart: '22:00',
		nightModeEnd: '06:00',
		liveStreamBlockedUnder16: true,
		contentFilterEnabled: true,
		childDefaultMaxPrivacy: true,
		minorDataRetentionDays: 365,
	});
	mocks.putMinorsConfig.mockResolvedValue(undefined);
	mocks.adminUsers.mockResolvedValue({});
	mocks.adminConsents.mockResolvedValue({});
});

describe('U412① 弹窗表单预挂载锁（forceRender 契约）+ 零「not connected」告警', () => {
	it('incidents：弹窗子树随页预挂载（修复前 role=dialog 为 0）', async () => {
		const hits = await captureUnhookedWarnings(async () => {
			render(<IncidentsPage />);
			await screen.findByRole('button', { name: /创建事故/ });
		});
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		expect(hits).toEqual([]);
	}, 20000);

	it('maintenances：弹窗子树随页预挂载', async () => {
		const hits = await captureUnhookedWarnings(async () => {
			render(<MaintenancesPage />);
			await screen.findByRole('button', { name: /创建维护/ });
		});
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		expect(hits).toEqual([]);
	}, 20000);

	it('tenants：弹窗子树随页预挂载', async () => {
		const hits = await captureUnhookedWarnings(async () => {
			render(<TenantsPage />);
			await screen.findByRole('button', { name: /创建租户/ });
		});
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		expect(hits).toEqual([]);
	}, 20000);

	it('minors：配置回填在表单挂载后生效（effect 回填回归）+ 零告警', async () => {
		const hits = await captureUnhookedWarnings(async () => {
			render(<MinorsProtectionPage />);
			await screen.findByRole('button', { name: /保存配置$/ });
		});
		// 回填确实落到表单（effect 依赖若失配，字段将保持空值）
		expect(await screen.findByDisplayValue('60')).toBeInTheDocument();
		expect(hits).toEqual([]);
	}, 20000);
});
