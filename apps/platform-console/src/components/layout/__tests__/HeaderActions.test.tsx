import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderActions } from '@/components/layout/HeaderActions';

const mockUser = vi.hoisted(() => ({
	email: 'test@example.com' as string | null,
	username: 'test' as string | null,
}));

const mockSlug = vi.hoisted(() => ({ value: 'demo' as string | undefined }));
const mockGetPortalUrl = vi.hoisted(() =>
	vi.fn((portal: string, slug?: string) => `https://${portal}.example.com${slug ? `/${slug}` : ''}`),
);
const mockLogout = vi.hoisted(() => vi.fn());
const mockCatalog = vi.hoisted(() => ({
	value: {
		portals: [] as Array<{ code: string; name?: string; url: string }>,
		isError: false,
		isLoading: false,
	},
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		// 忠实模拟 i18next：key 未命中时回落 defaultValue（@autional/ui 组件内置文案走此路径）
		t: (key: string, options?: { defaultValue?: string }) =>
			typeof options?.defaultValue === 'string' ? options.defaultValue : key,
		i18n: {
			language: 'zh-CN',
			changeLanguage: vi.fn(),
		},
	}),
	initReactI18next: {
		type: '3rdParty',
		init: () => {},
	},
}));

vi.mock('@autional/shared', () => ({
	useAuth: () => ({ user: mockUser, currentTenantId: 'platform-tenant', isAuthenticated: true }),
	useTenantSlug: () => mockSlug.value,
	getPortalUrl: mockGetPortalUrl,
	useLogout: () => mockLogout,
	usePortalCatalog: () => mockCatalog.value,
}));

describe('HeaderActions', () => {
	beforeEach(() => {
		mockUser.email = 'test@example.com';
		mockUser.username = 'test';
		mockSlug.value = 'demo';
		mockCatalog.value = { portals: [], isError: false, isLoading: false };
		mockGetPortalUrl.mockClear();
		mockLogout.mockClear();
	});


	it('renders the user display name in the user menu trigger', () => {
		render(<HeaderActions />);
		expect(screen.getByText('test')).toBeInTheDocument();
	});

	it('opens the user menu with email and lets logout fire once', async () => {
		const user = userEvent.setup();
		render(<HeaderActions />);

		await user.click(screen.getByLabelText('用户菜单'));
		expect(screen.getByText('test@example.com')).toBeInTheDocument();

		await user.click(screen.getByRole('menuitem', { name: '退出登录' }));
		expect(mockLogout).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('menuitem', { name: '退出登录' })).not.toBeInTheDocument();
	});

	it('shows fallback label in the user menu when user is missing', () => {
		mockUser.email = null;
		mockUser.username = null;

		render(<HeaderActions />);
		expect(screen.getByText('未登录')).toBeInTheDocument();
	});

	it('falls back to static [platform, admin] portals when catalog errors (U94)', async () => {
		mockCatalog.value = { portals: [], isError: true, isLoading: false };
		const user = userEvent.setup();
		render(<HeaderActions />);

		await user.click(screen.getByLabelText('切换门户'));

		const adminLink = screen.getByRole('menuitem', { name: '管理后台' });
		expect(adminLink).toHaveAttribute('href', 'https://admin.example.com/demo');
		expect(mockGetPortalUrl).toHaveBeenCalledWith('admin', 'demo');

		const platformLink = screen.getByRole('menuitem', { name: '平台控制台' });
		expect(platformLink).toHaveAttribute('aria-current', 'true');
	});

	it('uses the catalog portals when the catalog resolves', async () => {
		mockCatalog.value = {
			portals: [
				{ code: 'admin', url: 'https://admin.example.com/demo' },
				{ code: 'user', url: 'https://user.example.com/demo' },
			],
			isError: false,
			isLoading: false,
		};
		const user = userEvent.setup();
		render(<HeaderActions />);

		await user.click(screen.getByLabelText('切换门户'));

		expect(screen.getByRole('menuitem', { name: '管理后台' })).toHaveAttribute(
			'href',
			'https://admin.example.com/demo',
		);
		expect(screen.getByRole('menuitem', { name: '用户中心' })).toHaveAttribute(
			'href',
			'https://user.example.com/demo',
		);
	});

	it('hides the portal switcher when fewer than two portals resolve', () => {
		mockCatalog.value = {
			portals: [{ code: 'admin', url: 'https://admin.example.com/demo' }],
			isError: false,
			isLoading: false,
		};
		render(<HeaderActions />);

		expect(screen.queryByLabelText('切换门户')).not.toBeInTheDocument();
	});
});