import {
	AuthService,
	useAuthStore,
	useTenantsQuery,
	PLATFORM_TENANT_ID,
	decodeJwtPayload,
} from '@autional/shared';

/**
 * 平台成员判定（PL-77）：当前会话是否平台租户成员。供路由门（PlatformMemberGuard）与
 * 控制台导航（NavMenu）共同消费 —— 非成员不得见控制台页面与 11 项菜单
 * （此前任一租户的 super_admin/admin 经跨租户 slug / 经平台 OAuth client 登录后
 * 角色码撞白名单或 role=null 穿透，即渲染全量外壳；数据全赖后端 40000503 兜住）。
 *
 * 两腿均镜像后端同谓词：
 *   ① 静态腿：token 租户 claim == 平台租户 —— 逐字镜像网关 platform_tenant_guard.go
 *      （"platform-level access required"）；audit P4 实证：租户级 super_admin 的
 *      token claim 仍是其自有租户，故本腿当场否决。
 *   ② 数据腿：平台租户下确有角色行 —— 镜像入口策略 platformTenantRoleGuard
 *      （entry_policy.go "platform audience requires platform tenant"）。
 *
 * 为什么不用 store.currentTenantId 当判据：它有两个会误判的写入源 ——
 *   a) shared useTenantRoute（RequireAuth 内挂载）每次 slug 解析完成都会覆写它
 *      （含跨租户 slug）；b) 它随 store 持久化，machine 可从持久化数据瞬间 ready，
 *      早于 slug 解析完成。综上它会滞后于真实上下文 —— 据它判「非平台」会把合法
 *      成员在收敛前误判为 403（本 hook 只把它用作「查询作用域是否已是平台租户」
 *      的结算校验，且失败方向是『不裁决』而非拒绝）。
 *
 * 查询作用域：client 请求拦截器以 store.currentTenantId 覆写 X-Tenant-ID
 * （api/client.ts），故查询 scope 恒等于会话上下文；平台租户成员行只可能由
 * 作用域=平台租户的查询写入。store 兜底 = 本人上次会话写入的持久化行（登出即清）。
 *
 * tri-state：'unknown' = 未可判（不裁决，防合法成员冷启动闪 403）；查询失败计入
 * 结算（fail-closed）；claim 不可解/缺失按非平台处理（与后端「claim ≠ 平台即拒」同向）。
 */
export type PlatformMemberState = 'member' | 'non-member' | 'unknown';

/** 读 access_token 的租户 claim（shared decodeJwtPayload 归一化解码：tenant_id 驼峰兜底） */
function readTokenTenantId(token: string | null): string | null {
	if (!token) return null;
	// 此前裸 atob 不认 base64url 字母表（-/_）也不补填充，命中即整链解析失败
	// → 合法平台会话被判非平台（误 403）。
	const p = decodeJwtPayload(token);
	if (!p) return null;
	return (p.tenant_id as string) || (p.tenantId as string) || null;
}

export function usePlatformMember(): PlatformMemberState {
	const currentTenantId = useAuthStore((s) => s.currentTenantId);
	const tenants = useAuthStore((s) => s.tenants);

	// 与 useBootstrap 同口径：无 token 不发起查询（防 401 → onUnauthorized 抢跑
	// RequireAuth 的 OAuth PKCE 决策）；同 key 查询与 bootstrap 去重。
	const rawToken = AuthService.getAccessToken();
	const hasToken = !!rawToken && rawToken !== 'undefined' && rawToken !== 'null';

	const isPlatformAudience = hasToken && readTokenTenantId(rawToken) === PLATFORM_TENANT_ID;

	const tentsQuery = useTenantsQuery(currentTenantId, hasToken);
	const isMember =
		tenants.some((t) => t.id === PLATFORM_TENANT_ID) ||
		!!tentsQuery.data?.some((t) => t.id === PLATFORM_TENANT_ID);

	if (!isPlatformAudience) return 'non-member';
	if (isMember) return 'member';
	// 非成员结论需要「作用域=平台租户且已结算」双条件；否则不裁决（null 输出）。
	if (currentTenantId === PLATFORM_TENANT_ID && tentsQuery.isFetched) return 'non-member';
	return 'unknown';
}
