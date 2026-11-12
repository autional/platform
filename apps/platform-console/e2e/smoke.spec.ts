import { expect, type Page, type Route, test } from '@playwright/test';

/**
 * 平台控制台浏览器冒烟（BFF 全量桩）。
 *
 * 为什么要有这一层：站点是**纯 API 控制台**，单测把 `@autional/shared` 的
 * auth / bootstrap / 租户白名单链全 mock 掉了，于是「路由白屏」「租户 slug 漏斗断裂」
 * 「平台成员门误判」「控制台报错」这类问题单测永远发现不了。
 *
 * 做法：不发真后端、不走登录 —— 用 localStorage 预置一份持久化会话（zustand persist 的
 * `autional-auth-v1`，见 shared/auth/create-auth-store.ts 的默认 name），再把 `/bff/**`
 * 全量拦截成**源码验证过的真实信封形状**。本站点同时存在两种信封，混用会假绿，
 * 所以逐个对照源码写了：
 *   - axios 客户端（identity / tenant / status / notification / profile）走
 *     `{ code, message, data, timestamp }`：响应拦截器解 `data` 并转 camelCase
 *     （shared/api/client.ts:88）。
 *   - 公开租户**名单**走裸 fetch（shared/components/TenantIndexGuard.tsx:60），后端是
 *     dto_base.ListResponse，数组在**顶层 `items`**（解析顺序 items → data → 原对象）。
 *   - 列表类端点（status incidents）后端同样是 ListResponse：axios 拦截器把顶层
 *     items 折成 `{ items, total, pagination }`（client.ts:92），hooks 再经 extractList 取。
 *
 * 平台成员门（PL-77）：`usePlatformMember` 要求 token 的 `tenant_id` claim == 平台租户
 * ULID（shared/hooks/usePortalCatalog.ts:17），且 store 的 tenants 里确有该租户行 ——
 * 两者都对齐后端网关 platform_tenant_guard，写错任一条就会整站 403/白屏。
 */

const SLUG = 'demo';
/** 平台租户 ULID（service-core base/constant TenantPlatformID，全环境同值）。 */
const PLATFORM_TENANT_ID = '01KSQCBNVMS6SX64PJS937CE33';
const USER_ID = 'user-smoke';
/** zustand persist 的存储键（shared/auth/create-auth-store.ts 默认 name）。 */
const AUTH_STORAGE_KEY = 'autional-auth-v1';
/** 角色集与 shared/auth/portal-config.ts 的 PLATFORM_GUARDS.superAdmin 对齐。 */
const ROLE = 'super_admin';
/**
 * 权限集（bootstrap 会把它写回 store）：只放只读码，避免任何页面因「有写权限」
 * 渲染出额外的动作按钮，把冒烟面收敛到「首屏能不能渲染」。
 */
const PERMISSIONS = ['tenant:read', 'status:read', 'notification:read', 'session:read'];

/** exp = 2100-01-01：避免被 shared 的 isTokenExpired 判过期，触发 refresh 分支跑偏。 */
const ACCESS_TOKEN = (() => {
	const encode = (payload: Record<string, unknown>) =>
		Buffer.from(JSON.stringify(payload)).toString('base64url');
	return [
		encode({ alg: 'none', typ: 'JWT' }),
		encode({ sub: USER_ID, exp: 4102444800, tenant_id: PLATFORM_TENANT_ID }),
		'smoke',
	].join('.');
})();

const TIMESTAMP = '2026-01-01T00:00:00Z';

const json = (data: unknown) => ({
	status: 200,
	contentType: 'application/json',
	body: JSON.stringify(data),
});

/** 标准信封（axios 拦截器解 data 后转 camelCase）。 */
const envelope = (data: unknown) => json({ code: 0, message: 'ok', data, timestamp: TIMESTAMP });

/** ListResponse 信封（数组在顶层 items，不走 data 分支）。 */
const listResponse = (items: unknown[]) =>
	json({ code: 0, message: 'ok', items, total: items.length, timestamp: TIMESTAMP });

/**
 * 控制台错误噪声白名单。
 * 只放「不是本次冒烟要抓的问题」的噪声；其余一律必须为 0 —— 否则这条断言就失去意义。
 *
 * - 资源类：favicon / 被桩短接的连接，是浏览器自己打的，不是应用代码。
 * - 组件库弃用告警：antd 6 用 console.error 发 deprecation 提示（如 `Card` 的
 *   `bordered`/`headStyle` 类）。修它要改应用源码 —— 不在本卡范围。
 */
const CONSOLE_NOISE = [
	/Failed to load resource/i,
	/net::ERR_/i,
	/\[antd: [^\]]+\] `[^`]+` is deprecated/i,
];

function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
	page.on('console', (msg) => {
		if (msg.type() !== 'error') return;
		const text = msg.text();
		if (CONSOLE_NOISE.some((re) => re.test(text))) return;
		errors.push(`[console.error] ${text}`);
	});
	return errors;
}

/** 预置持久化会话：localStorage 在每次导航前写入（addInitScript 每条文档都执行）。 */
async function seedSession(page: Page) {
	await page.addInitScript(
		({ key, token, tenantId, role, permissions, userId }) => {
			window.localStorage.setItem(
				key,
				JSON.stringify({
					state: {
						user: {
							id: userId,
							email: 'smoke@example.com',
							username: 'smoke',
							status: 'active',
						},
						accessToken: token,
						refreshToken: token,
						// 平台成员门的数据腿：store 里必须有平台租户行（role 同时喂 PlatformGuard）
						tenants: [{ id: tenantId, name: 'Demo Tenant', role }],
						currentTenantId: tenantId,
						permissions,
						isAuthenticated: true,
					},
					version: 1,
				}),
			);
		},
		{
			key: AUTH_STORAGE_KEY,
			token: ACCESS_TOKEN,
			tenantId: PLATFORM_TENANT_ID,
			role: ROLE,
			permissions: PERMISSIONS,
			userId: USER_ID,
		},
	);
}

/** `/bff/**` 全量桩。未知端点兜底返回空 data（保证不出现 4xx/5xx 噪声）。 */
async function mockApi(page: Page) {
	await page.route('**/bff/**', async (route: Route) => {
		const path = new URL(route.request().url()).pathname.replace(/^\/bff/, '');

		// ── 启动链（TenantRootRedirect / TenantIndexGuard / useBootstrap）──────────
		// 公开租户名单：裸 fetch + ListResponse（`items` 在顶层，不是 `data`）
		if (path === '/tenant/api/v1/tenant/public/tenants') {
			return route.fulfill(listResponse([{ id: PLATFORM_TENANT_ID, name: SLUG, slug: SLUG }]));
		}
		if (path === '/identity/api/v1/auth/me/permissions') {
			return route.fulfill(envelope(PERMISSIONS));
		}
		if (path === '/identity/api/v1/auth/me/tenants') {
			return route.fulfill(
				envelope([{ id: PLATFORM_TENANT_ID, name: 'Demo Tenant', role: ROLE }]),
			);
		}
		if (path === '/identity/api/v1/auth/me') {
			return route.fulfill(
				envelope({
					id: USER_ID,
					email: 'smoke@example.com',
					username: 'smoke',
					status: 'active',
				}),
			);
		}

		// ── 顶栏门户切换器（usePortalCatalog，audience=admin）──────────────────────
		// 空目录 ⇒ 切换器按 Gainsight 规则自动隐藏（≤1 个门户不渲染），
		// 冒烟面收敛到「首屏能不能渲染」，不把无关接口的成败混进断言。
		if (/^\/tenant\/api\/v1\/admin\/tenants\/[^/]+\/applications$/.test(path)) {
			return route.fulfill(envelope([]));
		}

		// ── 仪表盘数据（shape 对齐页面读取的字段名：camelCase）──────────────────
		// 头像：空 URL ⇒ Avatar 回落首字母（不产生 <img> 失败请求）。
		if (path === '/profile/api/v1/profile/avatar') {
			return route.fulfill(envelope({ avatarUrl: '' }));
		}
		// useSystemTenants 读 `data.stats`（多一层嵌套），total 用来证明形状没写错：
		// 读成扁平形状时 KPI 会退化成「—」。
		if (path === '/tenant/api/v1/admin/tenants/stats') {
			return route.fulfill(
				envelope({
					stats: {
						total: 128,
						active: 120,
						suspended: 8,
						byPlan: { free: 100, pro: 28 },
					},
				}),
			);
		}
		if (path === '/status/api/v1/status/overview') {
			return route.fulfill(
				envelope({
					overallStatus: 'operational',
					activeIncidents: 1,
					servicesHealthy: 7,
					servicesTotal: 8,
					lastUpdated: TIMESTAMP,
				}),
			);
		}
		// 「最近事故」走 extractList：后端 ListResponse（顶层 items）
		if (path === '/status/api/v1/status/incidents') {
			return route.fulfill(
				listResponse([
					{
						id: 'inc-smoke-1',
						title: '冒烟示例事故',
						severity: 'major',
						status: 'investigating',
						createdAt: TIMESTAMP,
					},
				]),
			);
		}
		if (path === '/notification/api/v1/admin/notifications/platform-stats') {
			return route.fulfill(
				envelope({ totalSent: 42, totalRead: 30, readRate: 71.4, byType: {} }),
			);
		}

		// ── 会话活动心跳（useSessionActivity，POST）：给个空信封即可 ──────────────
		if (path === '/session/api/v1/admin/sessions/me/activity') {
			return route.fulfill(envelope({ ok: true }));
		}

		return route.fulfill(envelope({}));
	});
}

test.describe('平台控制台冒烟', () => {
	test.beforeEach(async ({ page }) => {
		await seedSession(page);
		await mockApi(page);
	});

	test('裸根 / 返回 200，且有会话时漏斗到租户总览', async ({ page }) => {
		const errors = collectErrors(page);

		// waitUntil: 'commit' —— 该页是一条「立即整页跳走」的漏斗路由（TenantRootRedirect），
		// 等 load 会在跳转中途被中断（假红），只取文档响应状态这一件事。
		const response = await page.goto('/', { waitUntil: 'commit' });
		expect(response?.status(), 'GET / 的 HTTP 状态').toBe(200);

		// 裸根不得停在空白页：有会话 + 公开名单命中 → /<slug>/（源码 TenantRootRedirect 口径）。
		// 注意 URL 上会带一跳溯源参数 `?rt=<层>.funnel-slug.<id>`（auth-trace 的 decorateTarget），
		// 断言因此只认路径 /demo/，不认整个字符串。
		await expect(page).toHaveURL(new RegExp(`/${SLUG}/(\\?.*)?$`));
		await expect(page.locator('main h1')).toHaveText('平台仪表盘');

		// 跳转后仍有接口在路上（bootstrap / 仪表盘四路查询），给它们落定再判控制台干净。
		await page.waitForTimeout(1_500);
		expect(errors.join('\n'), '控制台/pageerror').toBe('');
	});

	test('租户总览渲染：标题、KPI 与最近事故可见，且无未捕获异常', async ({ page }) => {
		const errors = collectErrors(page);

		const response = await page.goto(`/${SLUG}/`);
		expect(response?.status()).toBe(200);

		// ④ 稳定元素：AppPageHeader 的 h1（i18n zh-CN 的 dashboard.title）。
		//    它是「真的渲染出来了」的证据，而不是 Suspense 的占位。
		await expect(page.locator('main h1')).toHaveText('平台仪表盘');

		// KPI 与卡片标题限定在 main 内：这些词在左侧菜单里也有一份（严格模式会命中 2 个）。
		const main = page.locator('main');
		await expect(main.getByText('租户总数')).toBeVisible();
		await expect(main.getByText('活跃事故')).toBeVisible();
		await expect(main.getByText('健康服务')).toBeVisible();
		await expect(main.getByText('最近事故')).toBeVisible();

		// 桩值落到页面上 ⇒ 同时证明三处**信封形状**写对了：
		//   - 租户统计：`{ data: { stats: {...} } }` 的嵌套（读错 → KPI 显示「—」）
		//   - 事故列表：ListResponse 顶层 items（读错 → 「暂无事故记录」）
		await expect(main.getByText('128', { exact: true })).toBeVisible();
		await expect(main.getByText('冒烟示例事故')).toBeVisible();

		// ② 非白屏：主体有可见文本，且没有把 undefined 直接喷到脸上。
		const text = await main.innerText();
		expect(text.trim().length).toBeGreaterThan(0);
		expect(text).not.toContain('undefined');

		// ③ 给迟到的报错留窗口（头像补读 / react-query 重试都在这之后落定）。
		await page.waitForTimeout(2_000);
		expect(errors.join('\n'), '控制台/pageerror').toBe('');
	});

	test('未知租户 slug 渲染 404（白名单守卫没被绕过）', async ({ page }) => {
		const errors = collectErrors(page);

		const response = await page.goto('/not-a-tenant/');
		// SPA 由 vite 回落 index.html，HTTP 仍 200；404 是前端按公开名单判定的
		// （RequireAuth 放行 → TenantIndexGuard 用名单比对后渲染 not-found 页）。
		expect(response?.status()).toBe(200);

		await expect(page.getByText('页面不存在或已被移动')).toBeVisible();
		await expect(page.getByRole('button', { name: '返回首页' })).toBeVisible();
		await page.waitForTimeout(1_000);
		expect(errors.join('\n'), '控制台/pageerror').toBe('');
	});
});
