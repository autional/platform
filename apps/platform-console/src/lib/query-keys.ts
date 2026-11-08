/**
 * Query Key Factory — centralized, type-safe cache keys for TanStack Query.
 * Rules:
 * - All keys live here; no hardcoded strings in hooks/pages.
 * - Lists use objects for filters: ['users', { params }]
 * - Detail keys are predictable: ['users', id]
 * - Invalidations target parent scopes (e.g. invalidate 'users' clears list + detail)
 */

export const queryKeys = {
	users: {
		all: ['users'] as const,
		list: (params?: unknown) => ['users', { params }] as const,
		detail: (id: string) => ['users', id] as const,
		activeSessions: ['active-sessions'] as const,
		passwordStatus: (id: string) => ['users', id, 'password-status'] as const,
	},
	roles: {
		all: ['roles'] as const,
		detail: (id: string) => ['roles', id] as const,
		permissions: (roleId: string) => ['roles', roleId, 'permissions'] as const,
	},
	permissions: {
		all: ['permissions'] as const,
	},
	secrets: {
		all: ['secrets'] as const,
		list: (params?: unknown) => ['secrets', 'list', { params }] as const,
		detail: (key: string) => ['secrets', 'detail', key] as const,
		versions: (key: string) => ['secrets', 'versions', key] as const,
		encryptionKeys: ['secrets', 'encryption-keys'] as const,
	},
	tenants: {
		all: ['tenants'] as const,
		list: (params?: unknown) => ['tenants', 'list', { params }] as const,
		detail: (id: string) => ['tenants', id] as const,
	},
	departments: {
		all: (tenantId: string) => ['departments', tenantId] as const,
	},
	members: {
		all: (tenantId: string) => ['members', tenantId] as const,
		pending: (tenantId: string) => ['members', 'pending', tenantId] as const,
	},
	featureGates: (tenantId: string) => ['feature-gates', tenantId] as const,
	applications: {
		all: (tenantId: string) => ['applications', tenantId] as const,
	},
	webhooks: {
		all: (tenantId: string) => ['webhooks', tenantId] as const,
	},
	branding: {
		all: (tenantId: string) => ['branding', tenantId] as const,
	},
	sessions: {
		all: ['sessions'] as const,
		activeCount: ['sessions', 'active-count'] as const,
	},
	auditLogs: {
		all: (params?: unknown) => ['audit-logs', { params }] as const,
		detail: (id: string) => ['audit-logs', id] as const,
		stats: ['audit-stats'] as const,
	},
	auditAlerts: {
		all: (params?: unknown) => ['audit-alerts', { params }] as const,
		detail: (id: string) => ['audit-alerts', id] as const,
	},
	auditAnomalies: {
		all: (params?: unknown) => ['audit-anomalies', { params }] as const,
		detail: (id: string) => ['audit-anomalies', id] as const,
		timeline: (id: string) => ['audit-anomalies', id, 'timeline'] as const,
		related: (id: string) => ['audit-anomalies', id, 'related'] as const,
	},
	siemConnectors: {
		all: (params?: unknown) => ['siem-connectors', { params }] as const,
	},
	retentionPolicy: ['audit-retention-policy'] as const,
	identityProviders: {
		all: ['identity-providers'] as const,
	},
	notifications: {
		all: ['notification-templates'] as const,
		stats: ['notification-stats'] as const,
		trend: (days: number) => ['notification-trend', days] as const,
		eventMappings: ['event-mappings'] as const,
		globalVariables: ['global-variables'] as const,
		readReport: ['notifications', 'read-report'] as const,
	},
	platform: {
		communicationStats: ['platform-communication-stats'] as const,
		notificationStats: ['platform-notification-stats'] as const,
		envVars: () => ['platform', 'env-vars'] as const,
		infraCredentials: () => ['platform', 'infra-credentials'] as const,
		featureFlags: () => ['platform', 'feature-flags'] as const,
	},
	communication: {
		dashboard: ['communication-dashboard'] as const,
		logs: ['message-logs'] as const,
		stats: ['channel-stats'] as const,
		providers: ['communication', 'providers'] as const,
		templates: (params?: unknown) => ['communication', 'templates', { params }] as const,
		templateStats: ['communication', 'template-stats'] as const,
	},
	announcements: {
		all: ['announcements'] as const,
	},
	settings: {
		all: ['settings'] as const,
	},
	points: {
		rules: ['point-rules'] as const,
		accounts: ['point-accounts'] as const,
		transactions: (userId: string) => ['point-transactions', userId] as const,
		riskScore: (userId: string) => ['point-risk-score', userId] as const,
		config: ['point-tenant-config'] as const,
	},
	wallets: {
		all: (tenantId?: string) =>
			tenantId ? (['wallets', tenantId] as const) : (['wallets'] as const),
		summary: (tenantId: string) => ['wallets', 'summary', tenantId] as const,
		transactions: (tenantId: string, params?: unknown) =>
			['wallets', 'transactions', tenantId, { params }] as const,
		disputes: (tenantId: string) => ['wallets', 'disputes', tenantId] as const,
		coupons: ['wallets', 'coupons'] as const,
		fraudRules: ['wallets', 'fraud-rules'] as const,
		reconciliation: (params?: unknown) => ['wallets', 'reconciliation', { params }] as const,
	},
	storage: {
		files: (params?: unknown) => ['files', { params }] as const,
		quota: ['storage', 'quota'] as const,
		stats: ['storage', 'stats'] as const,
		trash: ['storage', 'trash'] as const,
	},
	billing: {
		all: (tenantId: string) => ['billing', tenantId] as const,
		subscription: (tenantId: string) => ['billing', 'subscription', tenantId] as const,
		usage: (tenantId: string) => ['billing', 'usage', tenantId] as const,
		statistics: (tenantId: string) => ['billing', 'statistics', tenantId] as const,
		records: (tenantId: string) => ['billing', 'records', tenantId] as const,
		plans: ['billing', 'plans'] as const,
		paymentGateways: ['billing', 'payment-gateways'] as const,
		refundApprovals: ['billing', 'refund-approvals'] as const,
		dunningSettings: (tenantId: string) => ['billing', 'dunning-settings', tenantId] as const,
	},
	compliance: {
		status: ['compliance', 'status'] as const,
		dsars: ['compliance', 'dsars'] as const,
		retentionPolicies: ['compliance', 'retention-policies'] as const,
		sodRules: ['compliance', 'sod-rules'] as const,
		isoControls: ['compliance', 'iso-controls'] as const,
		consents: ['compliance', 'consents'] as const,
	},
	ops: {
		status: ['ops', 'status'] as const,
		health: ['ops', 'health'] as const,
		metrics: (serviceName?: string) =>
			['ops', 'metrics', ...(serviceName ? [serviceName] : [])] as const,
	},
	security: {
		passwordPolicy: ['security', 'password-policy'] as const,
		mfaPolicy: ['security', 'mfa-policy'] as const,
		tenantPolicy: (tenantId: string) => ['security', 'policy', tenantId] as const,
		authConfig: ['security', 'auth-config'] as const,
		dataClassification: (tenantId: string) =>
			['security', 'data-classification', tenantId] as const,
	},
	pay: {
		all: ['pay'] as const,
		channels: (tenantId: string) => ['pay', 'channels', tenantId] as const,
		payments: (params?: unknown) => ['pay', 'payments', { params }] as const,
		paymentDetail: (id: string) => ['pay', 'payments', id] as const,
		refunds: (params?: unknown) => ['pay', 'refunds', { params }] as const,
		reconciliation: (tenantId: string, params?: unknown) =>
			['pay', 'reconciliation', tenantId, { params }] as const,
	},
	walletAdmin: {
		all: ['wallet-admin'] as const,
		list: (params?: unknown) => ['wallet-admin', 'list', { params }] as const,
		coupons: ['wallet-admin', 'coupons'] as const,
		fraudRules: ['wallet-admin', 'fraud-rules'] as const,
		withdrawals: (params?: unknown) => ['wallet-admin', 'withdrawals', { params }] as const,
		policy: (tenantId: string, appId: string) =>
			['wallet-admin', 'policy', tenantId, appId] as const,
	},
	billingAdmin: {
		all: ['billing-admin'] as const,
		plans: ['billing-admin', 'plans'] as const,
		subscriptions: (params?: unknown) => ['billing-admin', 'subscriptions', { params }] as const,
		refunds: (params?: unknown) => ['billing-admin', 'refunds', { params }] as const,
		revenue: (params?: unknown) => ['billing-admin', 'revenue', { params }] as const,
		dunning: (tenantId: string) => ['billing-admin', 'dunning', tenantId] as const,
		taxExport: (params?: unknown) => ['billing-admin', 'tax-export', { params }] as const,
		alerts: (params?: unknown) => ['billing-admin', 'alerts', { params }] as const,
		creditNote: (number: string) => ['billing-admin', 'credit-notes', number] as const,
		creditNotes: ['billing-admin', 'credit-notes'] as const,
		creditBalance: (tenantId: string) => ['billing-admin', 'credit-balance', tenantId] as const,
		creditTransactions: (tenantId: string, params?: unknown) =>
			['billing-admin', 'credit-transactions', tenantId, { params }] as const,
	},
	status: {
		incidents: {
			all: ['status', 'incidents'] as const,
			detail: (id: string) => ['status', 'incidents', id] as const,
		},
		maintenances: {
			all: ['status', 'maintenances'] as const,
			detail: (id: string) => ['status', 'maintenances', id] as const,
		},
		overview: ['status', 'overview'] as const,
		subscribers: ['status', 'subscribers'] as const,
	},
	apiKeys: {
		all: (tenantId: string) => ['api-keys', tenantId] as const,
	},
	abacPolicies: {
		all: ['abac-policies'] as const,
	},
	roleActivations: {
		all: ['role-activations'] as const,
	},
	agents: {
		all: ['agents'] as const,
		list: (params?: unknown) => ['agents', { params }] as const,
		detail: (id: string) => ['agents', id] as const,
		credentials: (id: string) => ['agents', id, 'credentials'] as const,
		activity: (id: string) => ['agents', id, 'activity'] as const,
		permissions: (id: string) => ['agents', id, 'permissions'] as const,
	},
	robots: {
		all: ['robots'] as const,
		list: (params?: unknown) => ['robots', { params }] as const,
		detail: (id: string) => ['robots', id] as const,
	},
	devices: {
		all: ['devices'] as const,
		list: (params?: unknown) => ['devices', { params }] as const,
		detail: (id: string) => ['devices', id] as const,
	},
	nhiPolicy: {
		all: ['nhi-policy'] as const,
	},
	reverseLookup: {
		roleUsers: (roleId: string) => ['reverse-lookup', 'roles', roleId, 'users'] as const,
		permissionUsers: (permissionId: string) =>
			['reverse-lookup', 'permissions', permissionId, 'users'] as const,
		permissionRoles: (permissionId: string) =>
			['reverse-lookup', 'permissions', permissionId, 'roles'] as const,
	},
	systemOverview: {
		services: ['system-overview', 'services'] as const,
		tenants: ['system-overview', 'tenants'] as const,
	},
	systemConfig: {
		runtime: (serviceKey: string) => ['system-config', 'runtime', serviceKey] as const,
		all: ['system-config'] as const,
		envVars: ['system-config', 'env-vars'] as const,
		featureFlags: ['system-config', 'feature-flags'] as const,
		infraCredentials: ['system-config', 'infra-credentials'] as const,
	},
	schedulers: {
		all: ['schedulers'] as const,
	},
	gdprErasure: {
		all: ['gdpr-erasure'] as const,
	},
} as const;
