import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderActions } from '@/components/layout/HeaderActions';
import zhCN from '@/i18n/locales/zh-CN.json';
import enUS from '@/i18n/locales/en-US.json';

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
	// 2026-11-02：控制台用户菜单新增「文档 / 状态 / 官网」三项，白名单 mock 必须同步，
	// 否则 HeaderActions import 到 undefined 会直接抛 "is not a function"。
	getDEVELOPER_PORTAL_URL: () => 'https://developer.example.com',
	getSTATUS_PAGE_URL: () => 'https://status.example.com',
	getLANDING_SITE_URL: () => 'https://www.example.com',
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

	// 2026-11-02（W2）：控制台此前只有「退出」，登录后回不到官网/文档/状态页。
	// 三条站外出口必须存在于用户菜单，且指向 shared 解析出的门户 host。
	it('portal menu i18n keys are flat top-level keys (keySeparator:false)', () => {
		// 本仓 locale 同时存在嵌套 "nav": {} 与平铺 "nav.*"；只有平铺键可解析。
		for (const key of ['nav.docs', 'nav.statusPage', 'nav.officialSite']) {
			expect(Object.prototype.hasOwnProperty.call(zhCN, key)).toBe(true);
			expect(Object.prototype.hasOwnProperty.call(enUS, key)).toBe(true);
		}
	});

	it('user menu exposes docs / status / official-site exits', async () => {
		const user = userEvent.setup();
		render(<HeaderActions />);
		await user.click(screen.getByLabelText('用户菜单'));

		expect(screen.getByRole('menuitem', { name: 'nav.docs' })).toHaveAttribute(
			'href',
			'https://developer.example.com',
		);
		expect(screen.getByRole('menuitem', { name: 'nav.statusPage' })).toHaveAttribute(
			'href',
			'https://status.example.com',
		);
		expect(screen.getByRole('menuitem', { name: 'nav.officialSite' })).toHaveAttribute(
			'href',
			'https://www.example.com',
		);

		// 登出恒为末项（UserMenu 内置排序契约）
		const items = screen.getAllByRole('menuitem');
		expect(items[items.length - 1]).toHaveTextContent('退出登录');
	});

	// 2026-11-02（W3）：切换器只列同类控制台。目录里混入内容站时必须被过滤掉，
	// 否则从平台控制台点「状态页」会整页甩出工作上下文。
	it('portal switcher drops content portals and keeps only consoles', async () => {
		mockCatalog.value = {
			portals: [
				{ code: 'admin', url: 'https://admin.example.com/demo' },
				{ code: 'user', url: 'https://user.example.com/demo' },
				{ code: 'status', url: 'https://status.example.com' },
				{ code: 'trust', url: 'https://trust.example.com' },
				{ code: 'developer', url: 'https://developer.example.com' },
				{ code: 'brand', url: 'https://brand.example.com' },
			],
			isError: false,
			isLoading: false,
		};
		const user = userEvent.setup();
		render(<HeaderActions />);

		await user.click(screen.getByLabelText('切换门户'));

		expect(screen.getByRole('menuitem', { name: '管理后台' })).toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: '用户中心' })).toBeInTheDocument();
		expect(screen.queryByRole('menuitem', { name: '状态页' })).not.toBeInTheDocument();
		expect(screen.queryByRole('menuitem', { name: '信任中心' })).not.toBeInTheDocument();
		expect(screen.queryByRole('menuitem', { name: '开发者门户' })).not.toBeInTheDocument();
	});
});