import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useTenantSlug } from '@autional/shared';
import { Breadcrumb as SharedBreadcrumb } from '@autional/ui/antd';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref, stripTenantPrefix } from '@/lib/nav';

const routeLabels: Record<string, string> = {
	[ROUTE.DASHBOARD]: 'nav.dashboard',
	[ROUTE.TENANTS]: 'nav.tenants',
	// 组段（自身非页面、只做中间层级）：不登记就会直出原始路由键
	// （PL-39：'/policies/nhi' 的中段显示成英文 "policies"）
	'/status': 'nav.status',
	'/policies': 'nav.nhiSection',
	'/compliance': 'nav.complianceSection',
	'/system': 'nav.systemSection',
	[ROUTE.ANNOUNCEMENTS]: 'nav.announcements',
	[ROUTE.INCIDENTS]: 'nav.incidents',
	[ROUTE.MAINTENANCES]: 'nav.maintenances',
	[ROUTE.AGENTS]: 'nav.agents',
	[ROUTE.ROBOTS]: 'nav.robots',
	[ROUTE.DEVICES]: 'nav.devices',
	[ROUTE.NHI_POLICY]: 'nav.nhiPolicy',
	[ROUTE.PLATFORM_NOTIFICATIONS]: 'nav.platformNotifications',
	[ROUTE.FEATURE_GATES]: 'nav.featureGates',
	[ROUTE.FEATURE_FLAGS]: 'nav.featureFlags',
	[ROUTE.COMPLIANCE_POLICY]: 'nav.compliancePolicy',
	[ROUTE.MINORS_PROTECTION]: 'nav.minorsProtection',
	[ROUTE.GDPR_ERASURE]: 'nav.gdprErasure',
	[ROUTE.OPS]: 'nav.ops',
	[ROUTE.SYSTEM_OVERVIEW]: 'nav.systemOverview',
	[ROUTE.SYSTEM_CONFIG]: 'nav.systemConfig',
	[ROUTE.SYSTEM_SCHEDULERS]: 'nav.systemSchedulers',
	[ROUTE.SECRETS_INVENTORY]: 'nav.secretsInventory',
	[ROUTE.RATE_LIMITS]: 'nav.rateLimits',
	[ROUTE.ENV_VARS]: 'nav.envVars',
	[ROUTE.INFRA_CREDENTIALS]: 'nav.infraCredentials',
	[ROUTE.IMPERSONATE]: 'nav.impersonate',
	[ROUTE.SETTINGS]: 'nav.settings',
};

// 可点段白名单 = ROUTE 中的静态注册路由。共享面包屑把中间段一律做成链接，
// 未注册的中间段（'/policies'、'/tenants/<ULID>'）就会引入死链（N8）——
// 只有真正注册过页面的路径才给 href。
const staticRoutes = new Set<string>(
	(Object.values(ROUTE) as string[]).filter((p) => !p.includes(':')),
);

// 动态路由（'/tenants/:id/quota' 这类）进不了静态映射表；此类页面没有子路由，
// 动态尾段只可能出现在自身页面上，所以按「当前路径」动态补一条映射。
const dynamicPageLabels: Array<{ test: RegExp; key: string }> = [
	{ test: /^\/tenants\/[^/]+\/quota$/, key: 'nav.tenantQuota' },
	{ test: /^\/tenants\/[^/]+\/invitation-config$/, key: 'nav.tenantInvitationConfig' },
];

/**
 * 面包屑。
 *
 * 这里只剩**业务**：路由 → 文案的映射表 + 可点白名单 / 动态段补丁。
 * 机制（剥租户段、按段累积、中间段可点、末段纯文本）在设计系统那一份里。
 */
export function Breadcrumb() {
	const { t } = useTranslation();
	const location = useLocation();
	const tenantSlug = useTenantSlug();

	const currentPath = stripTenantPrefix(location.pathname, tenantSlug);

	const labels = useMemo<Record<string, string>>(() => {
		const map = Object.fromEntries(
			Object.entries(routeLabels).map(([path, key]) => [path, t(key)]),
		);
		for (const { test, key } of dynamicPageLabels) {
			if (test.test(currentPath)) map[currentPath] = t(key);
		}
		return map;
	}, [t, currentPath]);

	return (
		<SharedBreadcrumb
			pathname={location.pathname}
			tenantSlug={tenantSlug}
			labels={labels}
			home={{ label: t('nav.dashboard'), href: buildNavHref('/', tenantSlug) }}
			detailLabel={t('breadcrumb.detail')}
			buildHref={(path) => (staticRoutes.has(path) ? buildNavHref(path, tenantSlug) : '')}
		/>
	);
}
