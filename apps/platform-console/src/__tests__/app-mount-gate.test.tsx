/**
 * Shape B 回归锁：平台控制台挂载在 /:tenantSlug（与 user/security 门户口径一致）。
 *
 * 契约：
 *  - 首段解析不出 slug 的裸业务路径（/403、/agents、/settings…… 已注册为业务段）
 *    必须本地 404，**不得进入 RequireAuth** —— 否则其「无 slug 无 client →
 *    buildLoginUrl」弹跳会与 auth 侧「有会话 → 回跳 redirect」构成无限整页往返
 *    （F-W7 只覆盖了 by-slug 404 的未注册 slug，未覆盖「已注册业务段」这一类）。
 *  - 带 slug 的路径（/demo/...）不拦截，交给共享 RequireAuth（含 F-W6 未知 slug 闸门）。
 *  - 裸根 / 走 TenantRootRedirect 品牌漏斗，不经 RequireAuth。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'zh-CN', changeLanguage: vi.fn() },
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => children,
	initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@autional/shared', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@autional/shared')>();
	return {
		...actual,
		// 仅替换渲染结果：RequireAuth 只打标记、不渲染 children —— 让断言聚焦
		// 「闸门是否放行」这一决策，避免把整棵 Layout/页面子树拖进本测试。
		RequireAuth: () => <div data-testid="require-auth" />,
		TenantRootRedirect: () => <div data-testid="tenant-root-redirect" />,
	};
});

import App from '@/App';
// 副作用注册业务路由首段（main.tsx 的等价动作；registerNonTenantSegments 走 mock 透传的真实实现）
import '@/non-tenant-segments';

/**
 * 同时设置 jsdom window.location 与 MemoryRouter 的入口：闸门读 window.location.pathname
 * （与共享层 extractSlugFromPath/useOAuthClientIdFromUrl 同源），路由匹配读 MemoryRouter。
 * 生产中 BrowserRouter 下二者恒一致。
 */
function renderAt(path: string) {
	window.history.pushState({}, '', path);
	return render(
		<MemoryRouter initialEntries={[path]}>
			<App />
		</MemoryRouter>,
	);
}

describe('App 挂载闸门（/:tenantSlug 门户）', () => {
	beforeEach(() => {
		window.history.pushState({}, '', '/');
	});

	it('裸业务路径 /403 → 本地 404，不进入 RequireAuth（断登录弹跳往返）', () => {
		renderAt('/403');
		expect(screen.getByText('404')).toBeInTheDocument();
		expect(screen.queryByTestId('require-auth')).not.toBeInTheDocument();
	});

	it('裸业务路径 /agents → 本地 404，不进入 RequireAuth', () => {
		renderAt('/agents');
		expect(screen.getByText('404')).toBeInTheDocument();
		expect(screen.queryByTestId('require-auth')).not.toBeInTheDocument();
	});

	it('裸业务路径 /settings → 本地 404（单段业务首段注册完整性）', () => {
		renderAt('/settings');
		expect(screen.getByText('404')).toBeInTheDocument();
		expect(screen.queryByTestId('require-auth')).not.toBeInTheDocument();
	});

	it('带 slug 路径 /demo/agents → 放行给 RequireAuth（不拦截）', () => {
		renderAt('/demo/agents');
		expect(screen.getByTestId('require-auth')).toBeInTheDocument();
	});

	it('裸根 / → TenantRootRedirect 品牌漏斗（不经 RequireAuth）', () => {
		renderAt('/');
		expect(screen.getByTestId('tenant-root-redirect')).toBeInTheDocument();
		expect(screen.queryByTestId('require-auth')).not.toBeInTheDocument();
	});

	it('slug=platform 的路径 /platform/ → 放行给 RequireAuth（业务段名单不得吃掉真实租户 slug）', () => {
		renderAt('/platform/');
		expect(screen.getByTestId('require-auth')).toBeInTheDocument();
		expect(screen.queryByText('404')).not.toBeInTheDocument();
	});

	it('裸业务路径 /notifications → 本地 404（路由段与名单同步，不误放行）', () => {
		renderAt('/notifications');
		expect(screen.getByText('404')).toBeInTheDocument();
		expect(screen.queryByTestId('require-auth')).not.toBeInTheDocument();
	});
});
