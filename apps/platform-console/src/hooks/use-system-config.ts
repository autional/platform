'use client';

import { useQuery } from '@tanstack/react-query';
import { extractItem } from '@autional/shared';
import { adminEnvVars, adminFeatureFlags } from '@autional/shared/generated/api';
import {
	CATEGORY_LABELS,
	useSystemServices,
	type ServiceCategory,
	type ServiceStatus,
} from '@/hooks/use-system-overview';
import i18n from '@/i18n';

export type { ServiceCategory, ServiceStatus };

export type FeatureStatus = 'enabled' | 'disabled' | 'not_applicable';
export type InfraType = 'database' | 'cache' | 'message_queue' | 'object_storage' | 'document_db';

export interface ServiceInfo {
	key: string;
	name: string;
	httpPort: number;
	grpcPort: number;
	category: ServiceCategory;
	categoryLabel: string;
	status: ServiceStatus;
	description: string;
}

export interface InfraComponent {
	key: string;
	name: string;
	hostPort: string;
	credentialLocation: string;
	type: InfraType;
	typeLabel: string;
	description: string;
}

export interface EnvVarItem {
	key: string;
	name: string;
	value: string;
	masked: boolean;
	category: string;
	source: string;
}

export interface FeatureFlagItem {
	key: string;
	name: string;
	description: string;
	services: Record<string, FeatureStatus>;
}

// 键映射 + 调用时求值（模块级无组件作用域）：映射表存 i18n 键名，调用点在函数体内 i18n.t。
const SERVICE_DESCRIPTION_KEYS: Record<string, string> = {
	'identity-service': 'systemConfig.serviceDesc.identityService',
	'profile-service': 'systemConfig.serviceDesc.profileService',
	'tenant-service': 'systemConfig.serviceDesc.tenantService',
	'session-service': 'systemConfig.serviceDesc.sessionService',
	'mfa-service': 'systemConfig.serviceDesc.mfaService',
	'oauth-service': 'systemConfig.serviceDesc.oauthService',
	'wallet-service': 'systemConfig.serviceDesc.walletService',
	'point-service': 'systemConfig.serviceDesc.pointService',
	'audit-service': 'systemConfig.serviceDesc.auditService',
	'notification-service': 'systemConfig.serviceDesc.notificationService',
	'communication-service': 'systemConfig.serviceDesc.communicationService',
	'storage-service': 'systemConfig.serviceDesc.storageService',
	'billing-service': 'systemConfig.serviceDesc.billingService',
	'compliance-service': 'systemConfig.serviceDesc.complianceService',
	'status-service': 'systemConfig.serviceDesc.statusService',
	'secret-service': 'systemConfig.serviceDesc.secretService',
	'pay-service': 'systemConfig.serviceDesc.payService',
	'saml-service': 'systemConfig.serviceDesc.samlService',
};

export const INFRA_TYPE_LABELS: Record<InfraType, string> = {
	get database() {
		return i18n.t('systemConfig.infraType.database');
	},
	get cache() {
		return i18n.t('systemConfig.infraType.cache');
	},
	get message_queue() {
		return i18n.t('systemConfig.infraType.messageQueue');
	},
	get object_storage() {
		return i18n.t('systemConfig.infraType.objectStorage');
	},
	get document_db() {
		return i18n.t('systemConfig.infraType.documentDb');
	},
};

const STATUS_LABEL_KEYS: Record<ServiceStatus, string> = {
	healthy: 'systemConfig.status.healthy',
	unhealthy: 'systemConfig.status.unhealthy',
	unknown: 'systemConfig.status.unknown',
};

const FEATURE_LABELS: Record<FeatureStatus, string> = {
	enabled: '✅',
	disabled: '❌',
	not_applicable: '—',
};

// 静态配置参考：中间件健康探针未接入（无数据源），状态一律不在表中呈现
// 展示文案按调用时构造（模块级无组件作用域）：组件内调用本函数，语言切换随渲染刷新
export function getInfraComponents(): InfraComponent[] {
	return [
		{
			key: 'postgres',
			name: 'PostgreSQL',
			hostPort: 'postgres:5432',
			credentialLocation: '.env / POSTGRES_PASSWORD',
			type: 'database',
			typeLabel: INFRA_TYPE_LABELS.database,
			description: i18n.t('systemConfig.infraDesc.postgres'),
		},
		{
			key: 'redis',
			name: 'Redis',
			hostPort: 'redis:6379',
			credentialLocation: '.env / REDIS_PASSWORD',
			type: 'cache',
			typeLabel: INFRA_TYPE_LABELS.cache,
			description: i18n.t('systemConfig.infraDesc.redis'),
		},
		{
			key: 'rabbitmq',
			name: 'RabbitMQ',
			hostPort: i18n.t('systemConfig.hostPort.rabbitmq'),
			credentialLocation: '.env / RABBITMQ_PASSWORD',
			type: 'message_queue',
			typeLabel: INFRA_TYPE_LABELS.message_queue,
			description: i18n.t('systemConfig.infraDesc.rabbitmq'),
		},
		{
			key: 'mongodb',
			name: 'MongoDB',
			hostPort: 'mongodb:27018',
			credentialLocation: '.env / MONGO_PASSWORD',
			type: 'document_db',
			typeLabel: INFRA_TYPE_LABELS.document_db,
			description: i18n.t('systemConfig.infraDesc.mongodb'),
		},
		{
			key: 'minio',
			name: 'MinIO',
			hostPort: i18n.t('systemConfig.hostPort.minio'),
			credentialLocation: '.env / MINIO_ROOT_PASSWORD',
			type: 'object_storage',
			typeLabel: INFRA_TYPE_LABELS.object_storage,
			description: i18n.t('systemConfig.infraDesc.minio'),
		},
	];
}

export function useServiceList() {
	const { data, isLoading, error, refetch } = useSystemServices();
	return {
		data: data?.services.map(
			(svc): ServiceInfo => ({
				key: svc.name,
				name: svc.name,
				httpPort: svc.port,
				grpcPort: svc.grpcPort,
				category: svc.category,
				categoryLabel: CATEGORY_LABELS[svc.category],
				status: svc.status,
				description: SERVICE_DESCRIPTION_KEYS[svc.name]
					? i18n.t(SERVICE_DESCRIPTION_KEYS[svc.name])
					: '',
			}),
		),
		isLoading,
		error,
		refetch,
	};
}

interface EnvVarsPayload {
	variables?: {
		key?: string;
		value?: string;
		masked?: boolean;
		category?: string;
		source?: string;
	}[];
}

export function useEnvVars() {
	return useQuery<EnvVarItem[]>({
		queryKey: ['system-config', 'env-vars'] as const,
		staleTime: 60000,
		queryFn: async () => {
			const res = await adminEnvVars();
			const payload = extractItem<EnvVarsPayload>(res);
			if (!payload || !Array.isArray(payload.variables)) {
				throw new Error(i18n.t('systemConfig.envVarsMissing'));
			}
			return payload.variables.map((v) => ({
				key: v.key ?? '',
				name: v.key ?? '',
				value: v.masked ? '••••••••••••••••' : (v.value ?? ''),
				masked: v.masked ?? false,
				category: v.category ?? '',
				source: v.source ?? '',
			}));
		},
	});
}

interface FeatureFlagsPayload {
	services?: {
		service?: string;
		flags?: { key?: string; value?: string; description?: string }[];
	}[];
}

export function useFeatureFlags() {
	return useQuery<FeatureFlagItem[]>({
		queryKey: ['system-config', 'feature-flags'] as const,
		staleTime: 60000,
		queryFn: async () => {
			const res = await adminFeatureFlags();
			const payload = extractItem<FeatureFlagsPayload>(res);
			if (!payload || !Array.isArray(payload.services)) {
				throw new Error(i18n.t('systemConfig.flagsMissing'));
			}
			const services = payload.services;

			const allServiceKeys = new Set<string>();
			for (const svc of services) {
				if (svc.service) allServiceKeys.add(svc.service);
			}

			const flagMap = new Map<
				string,
				{ description: string; services: Record<string, FeatureStatus> }
			>();
			for (const svc of services) {
				const serviceKey = svc.service ?? '';
				for (const f of svc.flags ?? []) {
					const flagKey = f.key ?? '';
					if (!flagKey) continue;
					if (!flagMap.has(flagKey)) {
						flagMap.set(flagKey, {
							description: f.description ?? '',
							services: Object.fromEntries(
								Array.from(allServiceKeys).map((k) => [k, 'not_applicable' as FeatureStatus]),
							),
						});
					}
					// 网关 flag 值为字符串 'true'/'false'（buildFeatureFlags 单一来源）
					flagMap.get(flagKey)!.services[serviceKey] =
						f.value === 'true' ? 'enabled' : f.value === 'false' ? 'disabled' : 'not_applicable';
				}
			}

			return Array.from(flagMap.entries()).map(([key, info]) => ({
				key,
				name: key,
				description: info.description,
				services: info.services,
			}));
		},
	});
}

export function getStatusLabel(status: ServiceStatus): string {
	return i18n.t(STATUS_LABEL_KEYS[status]);
}

export function getFeatureLabel(status: FeatureStatus): string {
	return FEATURE_LABELS[status];
}
