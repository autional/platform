'use client';

import { useQuery } from '@tanstack/react-query';
import { extractItem } from '@autional/shared';
import { adminSystemRuntime, developerStatus } from '@autional/shared/generated/api';
import { getTenantStats } from '@/lib/api.generated';
import { queryKeys } from '@/lib/query-keys';
import i18n from '@/i18n';

export type ServiceCategory =
	| 'authentication'
	| 'user-data'
	| 'business-platform'
	| 'operations'
	| 'access-control'
	| 'infrastructure';
export type ServiceStatus = 'healthy' | 'unhealthy' | 'unknown';

// 键映射 + 调用时求值（模块级无组件作用域）：消费方（system/overview 页）按 CATEGORY_LABELS[cat]
// 索引取展示文案，故以访问器（getter）承载 —— 取值时才 i18n.t，语言切换随渲染刷新。
export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
	get authentication() {
		return i18n.t('systemOverview.category.authentication');
	},
	get 'user-data'() {
		return i18n.t('systemOverview.category.userData');
	},
	get 'business-platform'() {
		return i18n.t('systemOverview.category.businessPlatform');
	},
	get operations() {
		return i18n.t('systemOverview.category.operations');
	},
	get 'access-control'() {
		return i18n.t('systemOverview.category.accessControl');
	},
	get infrastructure() {
		return i18n.t('systemOverview.category.infrastructure');
	},
};

export interface ServiceInfo {
	name: string;
	port: number;
	grpcPort: number;
	status: ServiceStatus;
	category: ServiceCategory;
}

export interface TenantOverview {
	total: number;
	active: number;
	suspended: number;
	planDistribution: { plan: string; count: number }[];
}

export interface ServicesOverview {
	services: ServiceInfo[];
	healthAvailable: boolean;
}

interface RuntimeService {
	name: string;
	port: number;
	grpcPort?: number;
	category: string;
}

interface RuntimeResponse {
	services: RuntimeService[];
}

interface HealthItem {
	name: string;
	status: string;
	port: number;
}

const VALID_CATEGORIES: Set<string> = new Set([
	'authentication',
	'user-data',
	'business-platform',
	'operations',
	'access-control',
	'infrastructure',
]);

function mapHealthStatus(raw: string): ServiceStatus {
	if (raw === 'healthy' || raw === 'up' || raw === 'ok') return 'healthy';
	if (raw === 'unhealthy' || raw === 'down' || raw === 'error') return 'unhealthy';
	return 'unknown';
}

function normalizeCategory(raw: string | undefined): ServiceCategory {
	if (raw && VALID_CATEGORIES.has(raw)) return raw as ServiceCategory;
	if (raw === 'core' || raw === 'auth') return 'authentication';
	if (raw === 'business') return 'business-platform';
	if (raw === 'infra') return 'infrastructure';
	return 'infrastructure';
}

export function useSystemServices() {
	return useQuery<ServicesOverview>({
		queryKey: queryKeys.systemOverview.services,
		staleTime: 30000,
		queryFn: async () => {
			const runtimeData = await adminSystemRuntime();
			const extracted = extractItem<RuntimeResponse>(runtimeData);
			if (!extracted || !Array.isArray(extracted.services)) {
				throw new Error(i18n.t('systemOverview.runtimeDataMissing'));
			}

			const healthMap: Record<string, string> = {};
			let healthAvailable = true;
			try {
				const healthRes = await developerStatus();
				const healthData = extractItem<{ services?: HealthItem[] }>(healthRes);
				if (healthData?.services && Array.isArray(healthData.services)) {
					for (const svc of healthData.services) {
						healthMap[svc.name] = svc.status;
					}
				} else {
					healthAvailable = false;
				}
			} catch {
				healthAvailable = false;
			}

			return {
				services: extracted.services.map((svc) => ({
					name: svc.name,
					port: svc.port,
					grpcPort: svc.grpcPort ?? 0,
					status: healthMap[svc.name] ? mapHealthStatus(healthMap[svc.name]) : 'unknown',
					category: normalizeCategory(svc.category),
				})),
				healthAvailable,
			};
		},
	});
}

export function useSystemTenants() {
	return useQuery<TenantOverview>({
		queryKey: queryKeys.systemOverview.tenants,
		staleTime: 30000,
		queryFn: async () => {
			const statsRes = await getTenantStats();
			const data = extractItem<{ stats: TenantOverview }>(statsRes);
			if (!data?.stats) {
				throw new Error(i18n.t('systemOverview.tenantStatsMissing'));
			}

			const tenants: TenantOverview = {
				...data.stats,
				planDistribution: [],
			};
			// API 返回 by_plan 对象 {free:12, platform:1}，页面期望 planDistribution 数组
			const statsObj = data.stats as unknown as Record<string, unknown>;
			const byPlan =
				(statsObj.byPlan as Record<string, number> | undefined) ??
				(statsObj.by_plan as Record<string, number> | undefined);
			if (byPlan && typeof byPlan === 'object') {
				tenants.planDistribution = Object.entries(byPlan).map(([plan, count]) => ({
					plan,
					count,
				}));
			}
			return tenants;
		},
	});
}
