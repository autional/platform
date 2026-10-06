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

const SERVICE_DESCRIPTIONS: Record<string, string> = {
	'identity-service': '身份认证与用户管理',
	'profile-service': '用户资料管理',
	'tenant-service': '多租户管理',
	'session-service': '会话管理',
	'mfa-service': '多因素认证',
	'oauth-service': 'OAuth 2.0 / OIDC 认证',
	'wallet-service': '钱包与余额管理',
	'point-service': '积分管理',
	'audit-service': '审计日志与合规',
	'notification-service': '通知推送中心',
	'communication-service': '邮件/短信发送',
	'storage-service': '文件存储管理',
	'billing-service': '计费与订阅',
	'compliance-service': '合规框架管理',
	'status-service': '服务状态页',
	'secret-service': '密钥管理',
	'pay-service': '支付处理',
	'saml-service': 'SAML 2.0 联合认证',
};

export const INFRA_TYPE_LABELS: Record<InfraType, string> = {
	database: '数据库',
	cache: '缓存',
	message_queue: '消息队列',
	object_storage: '对象存储',
	document_db: '文档数据库',
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
	healthy: '健康',
	unhealthy: '异常',
	unknown: '未知',
};

const FEATURE_LABELS: Record<FeatureStatus, string> = {
	enabled: '✅',
	disabled: '❌',
	not_applicable: '—',
};

// 静态配置参考：中间件健康探针未接入（无数据源），状态一律不在表中呈现
export const infraComponents: InfraComponent[] = [
	{
		key: 'postgres',
		name: 'PostgreSQL',
		hostPort: 'postgres:5432',
		credentialLocation: '.env / POSTGRES_PASSWORD',
		type: 'database',
		typeLabel: '数据库',
		description: '关系型数据库，PgBouncer 连接池 :6432',
	},
	{
		key: 'redis',
		name: 'Redis',
		hostPort: 'redis:6379',
		credentialLocation: '.env / REDIS_PASSWORD',
		type: 'cache',
		typeLabel: '缓存',
		description: '缓存与会话存储',
	},
	{
		key: 'rabbitmq',
		name: 'RabbitMQ',
		hostPort: 'rabbitmq:5672 / :15672 (管理)',
		credentialLocation: '.env / RABBITMQ_PASSWORD',
		type: 'message_queue',
		typeLabel: '消息队列',
		description: '事件总线与消息队列',
	},
	{
		key: 'mongodb',
		name: 'MongoDB',
		hostPort: 'mongodb:27018',
		credentialLocation: '.env / MONGO_PASSWORD',
		type: 'document_db',
		typeLabel: '文档数据库',
		description: '审计日志存储',
	},
	{
		key: 'minio',
		name: 'MinIO',
		hostPort: 'minio:9000 / :9001 (控制台)',
		credentialLocation: '.env / MINIO_ROOT_PASSWORD',
		type: 'object_storage',
		typeLabel: '对象存储',
		description: 'S3 兼容对象存储',
	},
];

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
				description: SERVICE_DESCRIPTIONS[svc.name] ?? '',
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
				throw new Error('环境变量数据缺失');
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
				throw new Error('功能标志数据缺失');
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
	return STATUS_LABELS[status];
}

export function getFeatureLabel(status: FeatureStatus): string {
	return FEATURE_LABELS[status];
}
