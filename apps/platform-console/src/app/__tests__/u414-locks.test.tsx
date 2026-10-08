/**
 * U414 回归锁（平台前端批）:
 *
 * ① API 密钥表 rowKey 从 "prefix" 改为 "id"。prefix 可能恒空（后端 DTO 尚未映射 key_prefix）
 *    且即便映射后也非唯一（掩码形 ak_live_ab12****——随机段仅露 4+1 字符），
 *    以 prefix 作行键会致 React key 塌陷（展开态串行、选中串行）。
 *    锁法：源码扫描（禁止回退 rowKey="prefix"）+ hook 映射保留 id（rowKey="id" 的前提）。
 *
 * ② 租户列表列口径：name 是租户标识（URL slug，创建表单同名口径「租户标识」），
 *    列头不得再错挂「租户名称」；display_name 由 wire 下发（ListTenants 恒定返回，无 omitempty），
 *    单列展示。锁法：渲染断言（列头 + 显示名称实际值）。
 *
 * ③ 合规评分 grade（A+/A/B/C/D，score API 已下发）接渲染：仪表盘 Tag 行为锁（含数据链断言，
 *    fetch 捕获 grade 后渲染「评级 B」）+ 策略页圆环旁文本直读源码锁。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 由 vitest 以应用根目录为 cwd 运行（vitest.config.ts 在应用根）
const APP_DIR = join(process.cwd(), 'src', 'app');

vi.mock('@/hooks/use-tenants', () => ({
	useTenants: () => ({
		data: {
			items: [
				{
					id: 't-1',
					name: 'demo',
					displayName: '演示租户 GmbH',
					domain: 'demo.localhost',
					status: 'active',
					createdAt: '2026-10-01T00:00:00Z',
				},
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

vi.mock('@/hooks/use-compliance', () => {
	const q = () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() });
	const m = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false });
	return {
		useDSARs: q,
		useUpdateDSAR: m,
		useExecuteErasure: m,
		useRetentionPolicies: q,
		useSODRules: q,
		useISOControls: q,
		useCreateRetentionPolicy: m,
		useUpdateRetentionPolicy: m,
		useConsents: q,
		useCreateConsent: m,
		useRevokeConsent: m,
	};
});

vi.mock('react-router', async () => {
	const actual = await vi.importActual<typeof import('react-router')>('react-router');
	return {
		...actual,
		useNavigate: () => vi.fn(),
	};
});

vi.mock('@/lib/antd-app', () => ({
	message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
	modal: { confirm: vi.fn() },
	notification: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/error-handler', () => ({
	handleApiError: vi.fn(),
}));

vi.mock('@autional/shared', () => ({
	usePageTitle: vi.fn(),
	useTenantSlug: () => 'demo',
	useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
		selector({ currentTenantId: 't-1', switchTenant: vi.fn() }),
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminComplianceTenantsScoreByTenants: vi.fn(async () => ({
		data: { overall_score: 83, grade: 'B' },
	})),
	adminComplianceTenantsPolicyByTenants: vi.fn(async () => ({ data: { standards: [] } })),
}));

import TenantsPage from '@/app/tenants/page';
import CompliancePage from '@/app/compliance/page';

describe('U414② 租户列表双字段口径', () => {
	it('列头为「租户标识/显示名称」，显示名称渲染 wire 的 display_name 值', async () => {
		render(<TenantsPage />);
		const table = await screen.findByRole('table');
		// 注意：scroll 表下 antd 会渲染隐藏的列宽测量 div（同文本），
		// 故表头断言走 role=columnheader 而非 getByText
		const headers = within(table)
			.getAllByRole('columnheader')
			.map((th) => th.textContent);
		expect(headers).toContain('租户标识');
		expect(headers).toContain('显示名称');
		expect(headers).not.toContain('租户名称');
		within(table).getByText('演示租户 GmbH');
	}, 20000);
});

describe('U414③ 合规评分 grade 接渲染', () => {
	it('仪表盘：score API 的 grade 被捕获并渲染（评级 B）', async () => {
		render(<CompliancePage />);
		expect(await screen.findByText('评级 B')).toBeInTheDocument();
		expect(screen.getByText('83')).toBeInTheDocument();
	}, 20000);
});

describe('U414①③ 源码扫描锁', () => {
	it('api-keys 表 rowKey 不回退 prefix', () => {
		const text = readFileSync(join(APP_DIR, 'system', 'secrets-inventory', 'page.tsx'), 'utf8');
		expect(text).not.toMatch(/rowKey="prefix"/);
		expect(text).toMatch(/rowKey="id"/);
	});

	it('mapApiKeyRecord 保留 id 映射（rowKey="id" 的数据前提）', () => {
		const text = readFileSync(join(process.cwd(), 'src', 'hooks', 'use-secrets-inventory.ts'), 'utf8');
		expect(text).toMatch(/id: item\.id \?\? ''/);
	});

	it('compliance 仪表盘 grade Tag 渲染在位', () => {
		const text = readFileSync(join(APP_DIR, 'compliance', 'page.tsx'), 'utf8');
		expect(text).toMatch(/评级 \{complianceGrade\}/);
	});

	it('compliance/policy 圆环旁有分数文本直读 + grade', () => {
		const text = readFileSync(join(APP_DIR, 'compliance', 'policy', 'page.tsx'), 'utf8');
		expect(text).toMatch(/合规评分 \{Math\.round\(score\)\}\/100/);
		expect(text).toMatch(/\$\{scoreGrade\}/);
	});
});
