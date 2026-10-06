/**
 * PL-20 回归：公告发布的两处二次确认。
 *  (a) 列表「发布」按钮：确认前不得调用发布接口；
 *  (b) 表单勾选「立即发布」：提交前弹 modal.confirm，确认后才创建并发布。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
	publish: vi.fn(),
	create: vi.fn(),
	modalConfirm: vi.fn(),
}));

vi.mock('@/hooks/use-announcements', () => ({
	useAnnouncements: () => ({
		data: [
			{ id: 'a1', title: '国庆服务公告', status: 'draft', targetRoles: [] },
			{ id: 'a2', title: '已发布公告', status: 'published', targetRoles: ['member'] },
		],
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useCreateAnnouncement: () => ({ mutateAsync: mocks.create, isPending: false }),
	useUpdateAnnouncement: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useDeleteAnnouncement: () => ({ mutateAsync: vi.fn(), isPending: false }),
	usePublishAnnouncement: () => ({ mutateAsync: mocks.publish, isPending: false }),
	useUnpublishAnnouncement: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/antd-app', () => ({
	message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
	modal: { confirm: mocks.modalConfirm },
}));

vi.mock('@/lib/error-handler', () => ({
	handleApiError: vi.fn(),
}));

vi.mock('@autional/shared', () => ({
	extractItem: (res: any) => res?.data ?? res ?? null,
	usePageTitle: vi.fn(),
}));

import AnnouncementsPage from '@/app/announcements/page';

describe('AnnouncementsPage (PL-20 发布二次确认)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('列表「发布」：确认前不调用发布接口，确认后才调用', async () => {
		const user = userEvent.setup();
		render(<AnnouncementsPage />);

		// 图标 span（role=img aria-label=send）并入按钮 accessible name，
		// 实际名称为「send发布」，故用尾部锚定正则匹配文案（「plus发布公告」不误命中）
		const publishBtn = await screen.findByRole('button', { name: /发布$/ });
		await user.click(publishBtn);

		expect(mocks.publish).not.toHaveBeenCalled();

		const confirmBtn = await screen.findByRole('button', { name: '确认发布' });
		await user.click(confirmBtn);

		await waitFor(() => {
			expect(mocks.publish).toHaveBeenCalledWith('a1');
		});
	}, 20000);

	it('表单勾选「立即发布」：提交前弹确认，确认后才创建并发布', async () => {
		const user = userEvent.setup();
		mocks.create.mockResolvedValue({ data: { id: 'new-1' } });
		mocks.publish.mockResolvedValue(undefined);

		render(<AnnouncementsPage />);

		await user.click(await screen.findByRole('button', { name: /发布公告/ }));
		await user.type(await screen.findByLabelText('标题'), '测试公告');
		await user.type(screen.getByLabelText('内容'), '公告正文');
		await user.click(screen.getByRole('checkbox', { name: /创建后立即发布/ }));

		// 直接触发 <form> 的 submit：jsdom 不实现回车隐式提交；
		// 同时避开弹窗底部按钮的本地化文案差异
		const formEl = screen.getByLabelText('标题').closest('form');
		expect(formEl).not.toBeNull();
		fireEvent.submit(formEl!);

		await waitFor(() => {
			expect(mocks.modalConfirm).toHaveBeenCalledTimes(1);
		});
		expect(mocks.create).not.toHaveBeenCalled();

		const confirmCfg = mocks.modalConfirm.mock.calls[0][0];
		expect(String(confirmCfg.content)).toContain('对用户可见');

		await act(async () => {
			await confirmCfg.onOk();
		});

		await waitFor(() => {
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.publish).toHaveBeenCalledWith('new-1');
		});
	}, 20000);
});
