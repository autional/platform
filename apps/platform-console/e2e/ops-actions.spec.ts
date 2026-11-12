import { expect, type Page, type Route, test } from '@playwright/test';

/**
 * P2-4 动作请求页（平台运维面）浏览器冒烟。
 *
 * 单测只覆盖形状归一/深链/错误分类；本 spec 证明「页面真的能渲染、能发起、能轮询」：
 *   目录渲染 → 发起 R1 动作（因子提示）→ 详情显示 pending_consent + Consent 深链
 *   → 轮询到终态 succeeded → 控制台无未捕获错误。
 *
 * 桩形状按 ops-action 真实响应：
 *   - 目录 `{"items":[...]}`（裸对象，无 code 信封）
 *   - 创建 202 + Action 裸对象（snake_case，params 是 json:"-" 不会出现）
 */

const SLUG = 'demo';
const PLATFORM_TENANT_ID = '01KSQCBNVMS6SX64PJS937CE33';
const USER_ID = 'user-e2e';
const AUTH_STORAGE_KEY = 'autional-auth-v1';
const ROLE = 'super_admin';
const ACTION_ID = '01ACTION0000000000000000AA';
const CONSENT_ID = '01CONSENT000000000000000AA';

const ACCESS_TOKEN = (() => {
	const encode = (payload: Record<string, unknown>) =>
		Buffer.from(JSON.stringify(payload)).toString('base64url');
	return [
		encode({ alg: 'none', typ: 'JWT' }),
		encode({ sub: USER_ID, exp: 4102444800, tenant_id: PLATFORM_TENANT_ID }),
		'smoke',
	].join('.');
})();

const json = (data: unknown, status = 200) => ({
	status,
	contentType: 'application/json',
	body: JSON.stringify(data),
});
const envelope = (data: unknown) => json({ code: 0, message: 'ok', data, timestamp: '2026-01-01T00:00:00Z' });
const listResponse = (items: unknown[]) =>
	json({ code: 0, message: 'ok', items, total: items.length, timestamp: '2026-01-01T00:00:00Z' });

async function seedSession(page: Page) {
	await page.addInitScript(
		({ key, token, tenantId, role, userId }) => {
			window.localStorage.setItem(
				key,
				JSON.stringify({
					state: {
						user: { id: userId, email: 'e2e@example.com', username: 'e2e', status: 'active' },
						accessToken: token,
						refreshToken: token,
						tenants: [{ id: tenantId, name: 'Demo Tenant', role }],
						currentTenantId: tenantId,
						permissions: ['tenant:read'],
						isAuthenticated: true,
					},
					version: 1,
				}),
			);
		},
		{ key: AUTH_STORAGE_KEY, token: ACCESS_TOKEN, tenantId: PLATFORM_TENANT_ID, role: ROLE, userId: USER_ID },
	);
}

async function mockApi(page: Page) {
	let detailCalls = 0;
	await page.route('**/bff/**', async (route: Route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname.replace(/^\/bff/, '');

		// ── 启动链 ─────────────────────────────────────────────
		if (path === '/tenant/api/v1/tenant/public/tenants') {
			return route.fulfill(listResponse([{ id: PLATFORM_TENANT_ID, name: SLUG, slug: SLUG }]));
		}
		if (path === '/identity/api/v1/auth/me/permissions') return route.fulfill(envelope(['tenant:read']));
		if (path === '/identity/api/v1/auth/me/tenants') {
			return route.fulfill(envelope([{ id: PLATFORM_TENANT_ID, name: 'Demo Tenant', role: ROLE }]));
		}
		if (path === '/identity/api/v1/auth/me') {
			return route.fulfill(envelope({ id: USER_ID, email: 'e2e@example.com', username: 'e2e', status: 'active' }));
		}
		if (/^\/tenant\/api\/v1\/admin\/tenants\/[^/]+\/applications$/.test(path)) {
			return route.fulfill(envelope([]));
		}
		if (path === '/session/api/v1/admin/sessions/me/activity') return route.fulfill(envelope({ ok: true }));

		// ── 被测面：ops-action 平台运维面 ──────────────────────
		if (path === '/ops-action/api/v1/admin/actions') {
			if (request.method() === 'POST') {
				const body = request.postDataJSON() as Record<string, unknown>;
				return route.fulfill(
					json(
						{
							action_id: ACTION_ID,
							tenant_id: PLATFORM_TENANT_ID,
							client_id: 'platform-console',
							action: body.action,
							target: body.target,
							target_tenant_id: body.target_tenant_id,
							summary: body.summary,
							risk: 'R1',
							status: 'pending_consent',
							consent_id: CONSENT_ID,
							created_at: '2026-01-01T00:00:00Z',
						},
						202,
					),
				);
			}
			return route.fulfill(
				json({
					items: [
						{ action: 'ops.echo', description: 'Return params', risk: 'R0' },
						{ action: 'ops.tenant.suspend', description: 'Suspend a tenant', risk: 'R1', required_factor: 'sms_otp' },
					],
				}),
			);
		}
		if (path === `/ops-action/api/v1/admin/actions/${ACTION_ID}`) {
			detailCalls += 1;
			return route.fulfill(
				json({
					action_id: ACTION_ID,
					tenant_id: PLATFORM_TENANT_ID,
					client_id: 'platform-console',
					action: 'ops.tenant.suspend',
					target_tenant_id: '01TARGET00000000000000000A',
					summary: 'E2E suspend',
					risk: 'R1',
					status: detailCalls >= 2 ? 'succeeded' : 'pending_consent',
					consent_id: CONSENT_ID,
					result: '{"ok":true}',
					created_at: '2026-01-01T00:00:00Z',
				}),
			);
		}

		return route.fulfill(envelope({}));
	});
}

test.describe('P2-4 动作请求页', () => {
	test.beforeEach(async ({ page }) => {
		await seedSession(page);
		await mockApi(page);
	});

	test('目录可渲染；发起 R1 动作后进入 pending_consent 并轮询到 succeeded', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));
		page.on('console', (msg) => {
			if (msg.type() !== 'error') return;
			const text = msg.text();
			if (/Failed to load resource|net::ERR_|\[antd: [^\]]+\] `[^`]+` is deprecated/i.test(text)) return;
			errors.push(text);
		});

		// 用 localhost（不是 127.0.0.1）：shared 的 portal resolver 对 IP 根域名返回 ''，
		// 那样 Consent 深链会按设计不渲染（真实域名下才有）。localhost 能覆盖深链分支。
		await page.goto(`http://localhost:13942/${SLUG}/ops/actions`);

		// 页面与目录
		await expect(page.locator('main h1')).toHaveText('动作请求');
		const main = page.locator('main');
		await expect(main.getByText('ops.tenant.suspend')).toBeVisible();

		// 发起（点第二行的「发起」按钮）
		const suspendRow = main.locator('tr', { hasText: 'ops.tenant.suspend' });
		await suspendRow.getByRole('button', { name: '发起' }).click();

		// 弹窗：动作已带出 + 因子提示（R2/需要 sms_otp 的动作用例）
		await expect(page.locator('input#action')).toHaveValue('ops.tenant.suspend');
		await expect(page.getByText('审批需要因子：sms_otp')).toBeVisible();

		await page.locator('input#summary').fill('E2E suspend');
		// AntD 会在两个汉字之间插空格（「提 交」）；按钮用弹窗 footer 的 primary 定位。
		await page.locator('.ant-modal-footer .ant-btn-primary').click();

		// 详情：pending_consent + Consent 深链 + 敏感参数不回显
		await expect(main.getByText('等待审批').first()).toBeVisible();
		const consentLink = main.getByRole('link', { name: '去 Consent 审批' });
		await expect(consentLink).toHaveAttribute('href', new RegExp(`/c/${CONSENT_ID}$`));
		// 详情卡不得回显 params（目录里 ops.echo 的描述含 "params" 字样，不能拿 main 断言）
		await expect(main.locator('.ant-descriptions')).not.toContainText('params');

		// 轮询到终态（4s 间隔；expect 自带 15s 超时）
		await expect(main.getByText('成功').first()).toBeVisible({ timeout: 20_000 });

		expect(errors.join('\n'), '控制台/pageerror').toBe('');
	});
});
