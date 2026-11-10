import { useTranslation } from 'react-i18next';
import {
	isConsolePortal,
	useAuth,
	useLogout,
	usePortalCatalog,
	useTenantSlug,
	getPortalUrl,
	getDEVELOPER_PORTAL_URL,
	getLANDING_SITE_URL,
	getSTATUS_PAGE_URL,
} from '@autional/shared';
import {
	LanguageSwitcher,
	PortalSwitcher,
	ThemeToggle,
	UserMenu,
	type PortalLink,
} from '@autional/ui';
import { SlidersHorizontal } from 'lucide-react';

// HeaderActions —— 顶栏**右侧**那组控件。
//
// 它过去是 Header.tsx：一个 <AntHeader> 外壳 + 品牌 + 这几个控件。外壳（sticky、高度令牌、
// 左右分布、移动端行为）2026-10-04 起归设计系统的 <AppShell>；品牌挪到侧栏顶部（与另外三个
// 门户一致 —— 原来平台站在顶栏和侧栏各显示了一遍品牌）。这里只剩**内容**。

/** 门户切换器只列「同类控制台」——清单来自 `@autional/shared` 门户注册表（`isConsolePortal`），
 *  新增控制台只改共享注册表，本仓无需再动。 */
/** 目录里的 code → 图标；config 需显式补一个，否则落到 Globe 兜底。 */
const PORTAL_ICONS = { config: SlidersHorizontal };
export function HeaderActions() {
	const { t } = useTranslation();
	const { user, currentTenantId } = useAuth();
	const tenantSlug = useTenantSlug();
	const handleLogout = useLogout();

	// 管理面平面（audiences [admin, platform]）：平台控制台走 admin 受众端点
	const { portals: catalogPortals, isError } = usePortalCatalog({
		tenantId: currentTenantId,
		slug: tenantSlug,
		audience: 'admin',
	});

	// U94：平台租户打目录端点 403（平台平面守卫）⇒ 目录失败即静态清单兜底 [platform, admin]
	const fallbackPortals: PortalLink[] = [
		{ code: 'platform', url: getPortalUrl('platform', tenantSlug ?? undefined) },
		{ code: 'admin', url: getPortalUrl('admin', tenantSlug ?? undefined) },
	];
	// 切换器只列同类控制台（2026-11-02）：目录正常返回时也必须过滤 —— 静态兜底只覆盖
	// isError 分支，修复前 status/trust/developer/brand 照旧出现在切换器里。
	const consolePortals = catalogPortals.filter((p) => isConsolePortal(p.code));
	const portals = isError ? fallbackPortals : consolePortals;

	return (
		<>
			<PortalSwitcher portals={portals} currentPortal="platform" iconForPortal={PORTAL_ICONS} />
			<LanguageSwitcher />
			<ThemeToggle />
			<UserMenu
				user={user}
				items={[
					// 站外出口（2026-11-02）：此前只有退出，控制台内回不到官网/文档/状态页。
					{ key: 'docs', type: 'custom', label: t('nav.docs'), href: getDEVELOPER_PORTAL_URL() },
					{ key: 'status', type: 'custom', label: t('nav.statusPage'), href: getSTATUS_PAGE_URL() },
					{ key: 'landing', type: 'custom', label: t('nav.officialSite'), href: getLANDING_SITE_URL() },
					{ key: 'logout', type: 'logout', onClick: handleLogout },
				]}
			/>
		</>
	);
}
