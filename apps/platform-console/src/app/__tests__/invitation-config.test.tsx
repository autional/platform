/**
 * PL-14 回归：邀请配置页「加载失败态」不得渲染可提交的表单。
 *
 * 旧行为：查询失败时页面同时渲染 PageError 与带默认值的表单（保存按钮可点，会把
 * defaultInviteRole='member' 等前端默认值写回后端）。判据 = 任何路径都不可能以默认值提交。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
	getInvitationConfig: vi.fn(),
	updateInvitationConfig: vi.fn(),
}));

vi.mock('@/lib/api.generated', () => ({
	getInvitationConfig: (...args: unknown[]) => mocks.getInvitationConfig(...args),
	updateInvitationConfig: (...args: unknown[]) => mocks.updateInvitationConfig(...args),
}));

vi.mock('@autional/shared', () => ({
	// 与真实实现同形的信封解包（页面读 extractItem）
	extractItem: (res: any) => res?.data ?? res ?? null,
	usePageTitle: vi.fn(),
}));

vi.mock('@/hooks/use-tenants', () => ({
	useTenant: () => ({ data: { id: 't-1', name: 'Demo Tenant' } }),
}));

vi.mock('react-router', async () => {
	const actual = await vi.importActual<typeof import('react-router')>('react-router');
	return { ...actual, useParams: () => ({ id: 't-1' }) };
});

import InvitationConfigPage from '@/app/tenants/[id]/invitation-config/page';

describe('InvitationConfigPage (PL-14 失败态禁保存)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('加载失败：渲染错误态且「保存配置」不可达（不渲染表单）', async () => {
		mocks.getInvitationConfig.mockRejectedValue(new Error('boom'));

		render(<InvitationConfigPage />);

		await waitFor(() => {
			expect(screen.getByText('加载邀请配置失败')).toBeInTheDocument();
		});

		expect(screen.queryByRole('button', { name: /保存配置/ })).not.toBeInTheDocument();
		// 重试入口仍在（文案经设计系统 i18n 回落链：本测试无 i18n 实例 → 命中 en-US "Retry"）
		expect(screen.getByRole('button', { name: /retry|重试/i })).toBeInTheDocument();
	}, 20000);

	it('加载成功：表单可渲染（正向对照）', async () => {
		mocks.getInvitationConfig.mockResolvedValue({
			data: { inviteExpiryDays: 14, defaultInviteRole: 'admin' },
		});

		render(<InvitationConfigPage />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /保存配置/ })).toBeInTheDocument();
		});
	}, 20000);
});
