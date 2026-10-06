'use client';

import {
	extractItem,
	fromPageResult,
	toPageParams,
	type PageResult,
} from '@autional/shared';
import { queryKeys } from '@/lib/query-keys';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	getAllTenants,
	getTenantDetail,
	createTenant,
	updateTenant,
	deleteTenant,
	activateTenant,
	suspendTenant,
} from '@/lib/api.generated';

// 列表响应经拦截器 camel 化后的形状（service-tenant TenantResponse）。
export interface TenantRecord {
	id: string;
	name?: string;
	displayName?: string;
	domain?: string;
	status?: string;
	plan?: string;
	ownerId?: string;
	memberCount?: number;
	createdAt?: string;
	updatedAt?: string;
	[key: string]: unknown;
}

export type TenantDetail = Record<string, unknown>;

export interface TenantListParams {
	page?: number;
	pageSize?: number;
	search?: string;
	status?: string;
	plan?: string;
}

// 服务端检索参数真名 = keyword（swagger/generated 里写成 search 是契约漂移）。
export function useTenants(params?: TenantListParams) {
	return useQuery<PageResult<TenantRecord>>({
		queryKey: queryKeys.tenants.list(params),
		staleTime: 60000,
		queryFn: async () => {
			const res = await getAllTenants({
				...toPageParams({ page: params?.page, pageSize: params?.pageSize }),
				...(params?.search ? { keyword: params.search } : {}),
				...(params?.status ? { status: params.status } : {}),
				...(params?.plan ? { plan: params.plan } : {}),
			} as any);
			return fromPageResult<TenantRecord>(res);
		},
	});
}

export function useTenant(id: string) {
	return useQuery({
		queryKey: queryKeys.tenants.detail(id),
		staleTime: 60000,
		queryFn: async () => {
			const res = await getTenantDetail(id);
			return extractItem<TenantDetail>(res) ?? res;
		},
		enabled: !!id,
	});
}

export function useCreateTenant() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createTenant,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all }),
	});
}

export function useUpdateTenant() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
			updateTenant(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all }),
	});
}

export function useDeleteTenant() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteTenant,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all }),
	});
}

export function useActivateTenant() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: activateTenant,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all }),
	});
}

export function useSuspendTenant() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: suspendTenant,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all }),
	});
}
