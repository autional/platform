import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { useTenantSlug } from '@autional/shared';
import { usePlatformMember } from '@/components/auth/usePlatformMember';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref, stripTenantPrefix } from '@/lib/nav';
import {
	DashboardOutlined,
	TeamOutlined,
	NotificationOutlined,
	WarningOutlined,
	RobotOutlined,
	ControlOutlined,
	SafetyOutlined,
	CloudServerOutlined,
	SettingOutlined,
	DesktopOutlined,
	ApiOutlined,
	KeyOutlined,
} from '@ant-design/icons';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';

// NavMenu —— 本站的**导航内容**。
//
// 它过去是 Sidebar.tsx：一个 <Sider> 外壳 + 品牌 + <Menu>。外壳那部分（固定定位、宽度、
// 折叠、移动端抽屉）2026-10-04 起归设计系统的 <AppShell>，这里只留**菜单本身** ——
// 也就是四个门户里真正不同的那部分。
type MenuItem = {
	key: string;
	icon?: React.ReactNode;
	label: string;
	children?: MenuItem[];
};

function findMenuKey(items: MenuItem[], path: string): string | null {
	for (const item of items) {
		if (item.key === path) return item.key;
		if (item.children) {
			const found = findMenuKey(item.children, path);
			if (found) return found;
		}
	}
	return null;
}

export function NavMenu() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const tenantSlug = useTenantSlug();
	const membership = usePlatformMember();

	const allMenuItems: MenuItem[] = useMemo(
		() => [
			{ key: ROUTE.DASHBOARD, icon: <DashboardOutlined />, label: t('nav.dashboard') },
			{
				key: 'tenants-section',
				icon: <TeamOutlined />,
				label: t('nav.tenants'),
				children: [{ key: ROUTE.TENANTS, label: t('nav.tenants') }],
			},
			{ key: ROUTE.ANNOUNCEMENTS, icon: <NotificationOutlined />, label: t('nav.announcements') },
			{
				key: 'status-section',
				icon: <WarningOutlined />,
				label: t('nav.status'),
				children: [
					{ key: ROUTE.INCIDENTS, label: t('nav.incidents') },
					{ key: ROUTE.MAINTENANCES, label: t('nav.maintenances') },
				],
			},
			{
				key: 'nhi-section',
				icon: <RobotOutlined />,
				label: t('nav.nhiSection'),
				children: [
					{ key: ROUTE.AGENTS, label: t('nav.agents') },
					{ key: ROUTE.ROBOTS, label: t('nav.robots') },
					{ key: ROUTE.DEVICES, label: t('nav.devices') },
					{ key: ROUTE.NHI_POLICY, label: t('nav.nhiPolicy') },
				],
			},
			{
				key: ROUTE.PLATFORM_NOTIFICATIONS,
				icon: <DesktopOutlined />,
				label: t('nav.platformNotifications'),
			},
			{
				key: 'features-section',
				icon: <ControlOutlined />,
				label: t('nav.featureManagement', '功能管理'),
				children: [
					{ key: ROUTE.FEATURE_GATES, label: t('nav.featureGates') },
					{ key: ROUTE.FEATURE_FLAGS, label: t('nav.featureFlags') },
				],
			},
			{
				key: 'compliance-section',
				icon: <SafetyOutlined />,
				label: t('nav.complianceSection'),
				children: [
					{ key: ROUTE.COMPLIANCE_POLICY, label: t('nav.compliancePolicy') },
					{ key: ROUTE.MINORS_PROTECTION, label: t('nav.minorsProtection') },
					{ key: ROUTE.GDPR_ERASURE, label: t('nav.gdprErasure') },
				],
			},
			{
				key: 'system-section',
				icon: <CloudServerOutlined />,
				label: t('nav.systemSection'),
				children: [
					{ key: ROUTE.OPS, label: t('nav.ops') },
					{ key: ROUTE.SYSTEM_OVERVIEW, label: t('nav.systemOverview') },
					{ key: ROUTE.SYSTEM_CONFIG, label: t('nav.systemConfig') },
					{ key: ROUTE.SYSTEM_SCHEDULERS, label: t('nav.systemSchedulers') },
					{ key: ROUTE.SECRETS_INVENTORY, icon: <KeyOutlined />, label: t('nav.secretsInventory') },
					{ key: ROUTE.RATE_LIMITS, icon: <ApiOutlined />, label: t('nav.rateLimits') },
					{ key: ROUTE.ENV_VARS, label: t('nav.envVars') },
					{ key: ROUTE.INFRA_CREDENTIALS, label: t('nav.infraCredentials') },
					{ key: ROUTE.IMPERSONATE, label: t('nav.impersonate') },
				],
			},
			{ key: ROUTE.SETTINGS, icon: <SettingOutlined />, label: t('nav.settings') },
		],
		[t],
	);

	const selectedKeys = useMemo(() => {
		// 菜单 key 是站内相对路径（'/tenants'）；location.pathname 带租户段（'/demo/tenants'）
		const path = stripTenantPrefix(location.pathname, tenantSlug);
		if (path === '/') return ['/'];
		const matched = findMenuKey(allMenuItems, path);
		return matched ? [matched] : [];
	}, [location.pathname, allMenuItems, tenantSlug]);

	const defaultOpenKeys = useMemo(() => {
		const path = stripTenantPrefix(location.pathname, tenantSlug);
		const keys: string[] = [];
		for (const item of allMenuItems) {
			if (item.children?.some((c) => path.startsWith(c.key))) {
				keys.push(item.key);
			}
		}
		return keys;
	}, [location.pathname, allMenuItems, tenantSlug]);

	const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
		navigate(buildNavHref(key, tenantSlug));
	};

	const convertItems = (items: MenuItem[]): any[] =>
		items.map((item) => ({
			key: item.key,
			icon: item.icon,
			label: item.label,
			children: item.children ? convertItems(item.children) : undefined,
		}));

	// PL-77：非平台成员（或未可判）不渲染全量菜单 —— 此前任一租户的
	// super_admin/admin 可经跨租户 slug/平台 OAuth client 见到 11 项菜单。
	if (membership !== 'member') return null;

	return (
		<Menu
			mode="inline"
			selectedKeys={selectedKeys}
			defaultOpenKeys={defaultOpenKeys}
			items={convertItems(allMenuItems)}
			onClick={handleMenuClick}
			className="border-r-0"
		/>
	);
}
