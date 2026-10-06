/**
 * PL-55(a) 回归：未成年人保护「保存配置」需二次确认后才提交。
 *
 * 旧行为：点击「保存配置」立即 PUT。
 * 判据：确认前不得调用 PUT；确认（含生效范围说明）后才调用。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
	getConfig: vi.fn(),
	putConfig: vi.fn(),
	adminUsers: vi.fn(),
	adminConsents: vi.fn(),
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminTenantsMinorsProtectionByTenants: (...args: unknown[]) => mocks.getConfig(...args),
	adminTenantsMinorsProtectionByTenantsPut: (...args: unknown[]) => mocks.putConfig(...args),
	adminUsers: (...args: unknown[]) => mocks.adminUsers(...args),
	adminConsents: (...args: unknown[]) => mocks.adminConsents(...args),
}));

vi.mock('@autional/shared', () => ({
	AuthService: { getCurrentTenantId: () => 't-1' },
	fromPageResult: (d: any) => ({ items: d?.items ?? [], total: d?.total ?? 0 }),
	toPageParams: (p: any) => p,
}));

import MinorsProtectionPage from '@/app/compliance/minors/page';

describe('MinorsProtectionPage (PL-55a 保存二次确认)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getConfig.mockResolvedValue({
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
		mocks.putConfig.mockResolvedValue(undefined);
		mocks.adminUsers.mockResolvedValue({});
		mocks.adminConsents.mockResolvedValue({});
	});

	it('点击「保存配置」先弹确认（含生效范围），确认后才调用保存接口', async () => {
		const user = userEvent.setup();
		render(<MinorsProtectionPage />);

		// 图标 span（role=img aria-label=save）并入按钮 accessible name，
		// 实际名称为「save保存配置」，故用尾部锚定正则匹配文案
		const saveBtn = await screen.findByRole('button', { name: /保存配置$/ });
		await user.click(saveBtn);

		expect(mocks.putConfig).not.toHaveBeenCalled();
		expect(screen.getByText(/对当前租户立即生效/)).toBeInTheDocument();

		const confirmBtn = await screen.findByRole('button', { name: '确认保存' });
		await user.click(confirmBtn);

		await waitFor(() => {
			expect(mocks.putConfig).toHaveBeenCalledWith(
				't-1',
				expect.objectContaining({ dailyUsageLimitMin: 60 }),
			);
		});
	}, 20000);
});
