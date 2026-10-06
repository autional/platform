'use client';

import { useQuery } from '@tanstack/react-query';
import { extractList } from '@autional/shared';
import { adminSchedulers } from '@autional/shared/generated/api';
import { queryKeys } from '@/lib/query-keys';

export type SchedulerStatus = 'running' | 'paused' | 'failed' | 'disabled';

export interface SchedulerItem {
	id: string;
	name: string;
	service: string;
	interval: string;
	status: SchedulerStatus;
	lastRun: string;
	lastError: string | null;
	enabled: boolean;
}

interface SchedulerDetail {
	name?: string;
	enabled?: boolean;
	running?: boolean;
	interval?: string;
	lastRun?: string;
	lastError?: string;
	lastCount?: number;
}

interface ServiceSchedulerInfo {
	serviceName?: string;
	servicePort?: number;
	schedulers?: SchedulerDetail[] | null;
}

export function deriveStatus(sch: SchedulerDetail): SchedulerStatus {
	if (!sch.enabled) return 'disabled';
	if (sch.running) return 'running';
	if (sch.lastError) return 'failed';
	return 'paused';
}

export function flattenSchedulers(services: ServiceSchedulerInfo[]): SchedulerItem[] {
	const rows: SchedulerItem[] = [];
	for (const svc of services) {
		const svcName = svc.serviceName ?? '';
		for (const sch of svc.schedulers ?? []) {
			const name = sch.name ?? `${svcName}-scheduler`;
			rows.push({
				id: `${svcName}/${name}`,
				name,
				service: svcName,
				interval: sch.interval ?? '',
				status: deriveStatus(sch),
				lastRun: sch.lastRun ?? '',
				lastError: sch.lastError ?? null,
				enabled: sch.enabled ?? false,
			});
		}
	}
	return rows;
}

export function useSchedulers() {
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: queryKeys.schedulers.all,
		queryFn: async () => {
			const res = await adminSchedulers();
			return flattenSchedulers(extractList<ServiceSchedulerInfo>(res));
		},
		staleTime: 30000,
	});

	return { data: data ?? [], isLoading, error, refetch };
}
