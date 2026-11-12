'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@autional/shared';

import {
	actionsApiPath,
	buildOpsActionCreateBody,
	isTerminalStatus,
	normalizeAction,
	normalizeCatalog,
	type OpsActionCatalogItem,
	type OpsActionRecord,
} from '@/lib/ops-actions';

/** 状态轮询间隔（执行/待审批期间）；终态立即停止。 */
const POLL_INTERVAL_MS = 4000;

export const opsActionQueryKeys = {
	catalog: ['ops-actions', 'catalog'] as const,
	detail: (actionId: string) => ['ops-actions', 'detail', actionId] as const,
};

export function useOpsActionCatalog() {
	return useQuery<OpsActionCatalogItem[]>({
		queryKey: opsActionQueryKeys.catalog,
		staleTime: 60_000,
		queryFn: async () => {
			const res = await apiClient.get(actionsApiPath());
			return normalizeCatalog(res.data);
		},
	});
}

export interface CreateOpsActionInput {
	action: string;
	target?: string;
	targetTenantId?: string;
	params?: Record<string, unknown>;
	summary: string;
	reason?: string;
	idempotencyKey: string;
}

export function useCreateOpsAction() {
	return useMutation<OpsActionRecord, unknown, CreateOpsActionInput>({
		mutationFn: async (input) => {
			const res = await apiClient.post(
				actionsApiPath(),
				// 上游 JSON 是 snake_case；集中构造，避免 camelCase 被静默丢弃。
				buildOpsActionCreateBody(input),
				{ headers: { 'Idempotency-Key': input.idempotencyKey } },
			);
			return normalizeAction(res.data);
		},
	});
}

export function useOpsActionRecord(actionId?: string) {
	return useQuery<OpsActionRecord>({
		queryKey: opsActionQueryKeys.detail(actionId ?? ''),
		enabled: !!actionId,
		queryFn: async () => {
			const res = await apiClient.get(actionsApiPath(actionId));
			return normalizeAction(res.data);
		},
		refetchInterval: (query) => {
			const data = query.state.data;
			if (!data || isTerminalStatus(data.status)) return false;
			return POLL_INTERVAL_MS;
		},
	});
}
