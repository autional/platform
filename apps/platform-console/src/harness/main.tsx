/**
 * 平台控制台**外壳取景框**（第 53 轮）—— 给 visual / contrast 两道闸门一个能渲染出
 * 真实导航图标的静态目标页（platform / admin 此前都没有任何取景框）。
 *
 * 为什么必须是取景框，而不是真实 dist：
 *   实测把会话播种进 localStorage 后直接加载**生产 dist**，控制台会因没有后端而自我弹跳 ——
 *   `auth.localhost/?redirect=…&from_requireauth=1&rt=localhost.session-expired…`（API 请求失败 →
 *   onUnauthorized → 整页跳登录页）。所以这里**不挂整棵路由树**，只挂外壳本身：
 *   `AppShell` 实测零网络调用，`NavMenu` 的全部依赖（i18n / router / TenantSlugProvider / 平台成员判定）都能在无后端下满足。
 *
 * 取景纪律（对齐 user 门户 storybook 先例与 authenticator harness）：**只换数据，不换代码路径** ——
 *   ① 会话：真实 `useAuthStore`，塞一条**平台租户行**（`usePlatformMember` 的 store 腿）——
 *      不满足它 `NavMenu` 会 `return null`（第 162 行），量到的就是一张空壳；
 *      合成 token 的 claim 与真 token 同形（`PLATFORM_TENANT_ID` + 远未到期的 exp）。
 *   ② 网络：API 前缀的 fetch 短路成 200 —— 否则 `useTenantsQuery` 401 → onUnauthorized → 整页跳走。
 *   ③ 不挂 `HeaderActions`：它会挂通知流，那是 L24 记过的雷（假 token → 判定会话过期 → window.location 跳走）。
 *      所以本取景框覆盖的是**侧栏导航**（12 个迁移后的图标），不含顶栏右侧控件 —— 这是已知的、写下来的边界。
 *
 * 对生产零干扰：生产 `src/main.tsx` 不 import 本目录；本目录只被 `vite.harness.config.ts` 引用。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell, ThemeProvider, ToastProvider } from '@autional/ui';
import { PLATFORM_TENANT_ID, TenantSlugProvider, useAuthStore } from '@autional/shared';
import { AntdAppProvider } from '../lib/antd-app';
import { NavMenu } from '../components/layout/NavMenu';
import '../i18n';
import '../app/globals.css';

const HARNESS_SLUG = 'demo';
const PLATFORM_ID = PLATFORM_TENANT_ID;

/** 合成 token：与真实身份 token 同形（三段、载荷可解）—— 守卫只 decode 载荷（见 PlatformMemberGuard 测试夹具）。
 *  exp 给一年，避免任何「已过期」判据拿到 undefined。 */
function makeProbeToken() {
	const payload = {
		tenant_id: PLATFORM_ID,
		sub: 'harness-probe',
		email: 'harness@probe.invalid',
		custom: { username: 'harness' },
		exp: Math.floor(Date.now() / 1000) + 86400 * 365,
	};
	return 'h.' + btoa(JSON.stringify(payload)) + '.s';
}

// ① 会话播种（真实 store，只换数据）
useAuthStore.setState({
	accessToken: makeProbeToken(),
	refreshToken: 'harness-probe-refresh',
	user: { id: 'harness-probe', username: 'harness', email: 'harness@probe.invalid', status: 'active' },
	tenants: [{ id: PLATFORM_ID, name: 'platform', role: 'super_admin' }],
	currentTenantId: PLATFORM_ID,
	permissions: [],
	isAuthenticated: true,
} as never);

// ② API 短路：无后端时任何 401 都会触发 onUnauthorized 整页弹跳（实测见文件头）
const API_PREFIXES = ['/api/v1/', '/identity/', '/tenant/', '/audit/', '/billing/', '/compliance/', '/storage/',
	'/wallet/', '/session/', '/mfa/', '/notification/', '/communication/', '/point/', '/profile/', '/status/',
	'/oauth/', '/bff', '/.well-known/'];
const realFetch = window.fetch.bind(window);
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	try {
		const u = new URL(url, window.location.origin);
		if (u.origin === window.location.origin && API_PREFIXES.some((p) => u.pathname.startsWith(p))) {
			return Promise.resolve(new Response(JSON.stringify({ items: [], total: 0 }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			}));
		}
	} catch {
		/* 非法 URL 交给真 fetch */
	}
	return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

function Harness() {
	return (
		<TenantSlugProvider value={HARNESS_SLUG}>
			<AppShell
				brand={<span className="truncate text-lg font-bold">Autional 平台控制台</span>}
				nav={<NavMenu />}
				headerLeft={<span className="text-sm">外壳取景框</span>}
				headerRight={<span className="text-sm">harness</span>}
			>
				<div className="p-6 text-sm">platform-console shell harness —— 只量外壳（侧栏导航图标），不含页面内容。</div>
			</AppShell>
		</TenantSlugProvider>
	);
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={['/' + HARNESS_SLUG + '/']}>
				<ThemeProvider storageKey="platform-console-harness-theme">
					<AntdAppProvider>
						<ToastProvider>
							<Routes>
								<Route path="/:tenantSlug/*" element={<Harness />} />
							</Routes>
						</ToastProvider>
					</AntdAppProvider>
				</ThemeProvider>
			</MemoryRouter>
		</QueryClientProvider>
	</StrictMode>,
);
