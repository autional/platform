'use client';

import { extractItem } from '@autional/shared';
import { queryKeys } from '@/lib/query-keys';
import { useQuery } from '@tanstack/react-query';
import { ops, statusOverview } from '@/lib/api.generated';
import {
	developerStatus,
	statusMetricsUptime,
	statusMetricsLatency,
} from '@autional/shared/generated/api';

export interface OpsStatus {
	topology?: unknown;
	metrics?: unknown;
}

export function useOpsStatus() {
	return useQuery({
		queryKey: queryKeys.ops.status,
		queryFn: async () => {
			const res = await ops.topology();
			return extractItem<OpsStatus>(res) ?? ({} as OpsStatus);
		},
	});
}

export interface ServiceHealthItem {
	name: string;
	status: string;
	latency?: string;
	port: number;
	checkedAt?: string;
	checked_at?: string;
}

export interface HealthData {
	gateway: string;
	services: Record<string, string>;
	servicesList: ServiceHealthItem[];
	updated: string;
}

export interface ServiceHealthData {
	servicesTotal: number;
	servicesHealthy: number;
	activeIncidents: number;
	overallStatus: string;
}

export function useHealth() {
	return useQuery({
		queryKey: queryKeys.ops.health,
		queryFn: async (): Promise<HealthData> => {
			try {
				const res = await developerStatus();
				const data = extractItem<any>(res);
				if (data?.services && Array.isArray(data.services)) {
					const servicesMap: Record<string, string> = {};
					const servicesList: ServiceHealthItem[] = data.services.map((svc: ServiceHealthItem) => {
						servicesMap[svc.name] = svc.status;
						return svc;
					});
					return {
						gateway: data.gateway ?? 'unknown',
						services: servicesMap,
						servicesList,
						updated: data.updated ?? '',
					};
				}
				return { gateway: 'unknown', services: {}, servicesList: [], updated: '' };
			} catch {
				return { gateway: 'unknown', services: {}, servicesList: [], updated: '' };
			}
		},
		refetchInterval: 30000,
	});
}

export function useServiceHealth() {
	return useQuery({
		queryKey: ['ops', 'service-health'],
		staleTime: 30000,
		queryFn: async () => {
			const res = await statusOverview();
			// apiClient interceptor 已把响应 camelCase（services_total→servicesTotal），
			// 用 camelCase 读取（2026-08-16 修复：原读 snake_case → 全 0）
			const data = extractItem<Record<string, unknown>>(res);
			return {
				servicesTotal: (data?.servicesTotal as number) ?? (data?.services_total as number) ?? 0,
				servicesHealthy:
					(data?.servicesHealthy as number) ?? (data?.services_healthy as number) ?? 0,
				activeIncidents:
					(data?.activeIncidents as number) ?? (data?.active_incidents as number) ?? 0,
				overallStatus: (data?.overallStatus as string) ?? (data?.overall_status as string) ?? 'unknown',
			} as ServiceHealthData;
		},
		refetchInterval: 30000,
	});
}

export interface DataPoint {
	timestamp: string;
	value: number;
}

export interface MetricsData {
	uptime: number;
	latency: number;
	uptimeData: DataPoint[];
	latencyData: DataPoint[];
}

export interface LatencyPoint {
	timestamp: number;
	value: number;
}

export interface ServiceMetrics {
	latency: { points: LatencyPoint[] };
	uptime: { points: LatencyPoint[] };
}

export function useMetrics(serviceName?: string) {
	return useQuery({
		queryKey: queryKeys.ops.metrics(serviceName),
		queryFn: async (): Promise<MetricsData> => {
			const empty = {
				uptime: 0,
				latency: 0,
				uptimeData: [] as DataPoint[],
				latencyData: [] as DataPoint[],
			};

			if (!serviceName) {
				return empty;
			}

			try {
				const [uptimeData, latencyData] = await Promise.all([
					statusMetricsUptime({ service: serviceName, range: '24h' }),
					statusMetricsLatency({ service: serviceName, range: '24h' }),
				]);

				const uptimeItem = extractItem<{ points?: DataPoint[] }>({ data: uptimeData });
				const latencyItem = extractItem<{ points?: DataPoint[] }>({ data: latencyData });

				const upPoints = uptimeItem?.points ?? [];
				const latPoints = latencyItem?.points ?? [];

				const uptime =
					upPoints.length > 0
						? Number(
								(upPoints.reduce((sum, p) => sum + (p.value ?? 0), 0) / upPoints.length).toFixed(2),
							)
						: 0;

				const latency = latPoints.length > 0 ? (latPoints[latPoints.length - 1].value ?? 0) : 0;

				return { uptime, latency, uptimeData: upPoints, latencyData: latPoints };
			} catch {
				return empty;
			}
		},
		enabled: !!serviceName,
	});
}

export function useMetricsByService(service?: string, range = '24h') {
	return useQuery({
		queryKey: queryKeys.ops.metrics(service),
		queryFn: async () => {
			const svc = service ?? '';
			const rng = range ?? '24h';
			const [latencyData, uptimeData] = await Promise.all([
				statusMetricsLatency({ service: svc, range: rng }),
				statusMetricsUptime({ service: svc, range: rng }),
			]);
			return {
				latency: extractItem<{ points: LatencyPoint[] }>({ data: latencyData }) ?? { points: [] },
				uptime: extractItem<{ points: LatencyPoint[] }>({ data: uptimeData }) ?? { points: [] },
			} as ServiceMetrics;
		},
		enabled: !!service,
	});
}
