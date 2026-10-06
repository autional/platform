import { useTranslation } from 'react-i18next';
import {
	useAuth,
	useLogout,
	usePortalCatalog,
	useTenantSlug,
	getPortalUrl,
} from '@autional/shared';
import {
	LanguageSwitcher,
	PortalSwitcher,
	ThemeToggle,
	UserMenu,
	type PortalLink,
} from '@autional/ui';

// HeaderActions —— 顶栏**右侧**那组控件。
//
// 它过去是 Header.tsx：一个 <AntHeader> 外壳 + 品牌 + 这几个控件。外壳（sticky、高度令牌、
// 左右分布、移动端行为）2026-10-04 起归设计系统的 <AppShell>；品牌挪到侧栏顶部（与另外三个
// 门户一致 —— 原来平台站在顶栏和侧栏各显示了一遍品牌）。这里只剩**内容**。
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
	const portals = isError ? fallbackPortals : catalogPortals;

	return (
		<>
			<PortalSwitcher portals={portals} currentPortal="platform" />
			<LanguageSwitcher />
			<ThemeToggle />
			<UserMenu
				user={user}
				items={[{ key: 'logout', type: 'logout', onClick: handleLogout }]}
			/>
		</>
	);
}
