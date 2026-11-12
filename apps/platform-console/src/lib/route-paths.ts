/**
 * route-paths.ts — 前端路由路径常量
 * 所有导航组件（Sidebar、App.tsx、Breadcrumb、页面 navigate()）必须从此文件导入
 * 禁止在任何地方硬编码路由路径字符串
 */
export const ROUTE = {
	DASHBOARD: '/',

	// ===== 租户管理 =====
	TENANTS: '/tenants',
	TENANT_INVITATION_CONFIG: '/tenants/:id/invitation-config',
	TENANT_QUOTA: '/tenants/:id/quota',

	// ===== 公告 =====
	ANNOUNCEMENTS: '/announcements',

	// ===== 状态管理 =====
	INCIDENTS: '/status/incidents',
	MAINTENANCES: '/status/maintenances',

	// ===== NHI 管理 =====
	AGENTS: '/agents',
	AGENT_DETAIL: '/agents/:id',
	ROBOTS: '/robots',
	ROBOT_DETAIL: '/robots/:id',
	DEVICES: '/devices',
	DEVICE_DETAIL: '/devices/:id',
	NHI_POLICY: '/policies/nhi',

	// ===== 平台通知 =====
	PLATFORM_NOTIFICATIONS: '/notifications',

	// ===== Feature Management =====
	FEATURE_GATES: '/feature-gates',
	FEATURE_FLAGS: '/feature-flags',

	// ===== 合规 =====
	COMPLIANCE_POLICY: '/compliance/policy',
	MINORS_PROTECTION: '/compliance/minors',
	GDPR_ERASURE: '/gdpr-erasure',

	// ===== 系统 =====
	OPS: '/ops',
	OPS_ACTIONS: '/ops/actions',
	SYSTEM_OVERVIEW: '/system/overview',
	SYSTEM_CONFIG: '/system/config',
	SYSTEM_SCHEDULERS: '/system/schedulers',
	RATE_LIMITS: '/system/rate-limits',
	ENV_VARS: '/env-vars',
	INFRA_CREDENTIALS: '/infra-credentials',
	IMPERSONATE: '/impersonate',

	// ===== 设置 =====
	SETTINGS: '/settings',

	// ===== 通用 =====
	FORBIDDEN: '/403',
	OAUTH_CALLBACK: '/oauth/callback',
} as const;
