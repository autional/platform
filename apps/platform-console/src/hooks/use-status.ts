'use client';

import { extractItem, extractList } from '@autional/shared';
import { queryKeys } from '@/lib/query-keys';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	getIncidents,
	getIncident,
	createIncident,
	updateIncident,
	deleteIncident,
	addIncidentUpdate,
	getMaintenances,
	getMaintenance,
	createMaintenance,
	updateMaintenance,
	deleteMaintenance,
	getOverview,
	getSubscribers,
} from '@/lib/api.generated';

export interface IncidentRecord {
	id: string;
	title: string;
	description?: string;
	severity: string;
	status: string;
	affectedServices?: string[];
	updates?: IncidentUpdateRecord[];
	createdAt?: string;
	resolvedAt?: string;
	updatedAt?: string;
}

export interface IncidentUpdateRecord {
	id: string;
	message: string;
	status: string;
	createdAt?: string;
}

export interface MaintenanceRecord {
	id: string;
	title: string;
	description?: string;
	status: string;
	scheduledStartAt?: string;
	scheduledEndAt?: string;
	affectedServices?: string[];
	createdAt?: string;
	updatedAt?: string;
}

export interface OverviewRecord {
	overallStatus?: string;
	activeIncidents?: number;
	servicesHealthy?: number;
	servicesTotal?: number;
	lastUpdated?: string;
}

export interface SubscriberRecord {
	id: string;
	email: string;
	name?: string;
	company?: string;
	subscribedAt?: string;
}

export function useIncidents(params?: Record<string, unknown>) {
	return useQuery({
		queryKey: [...queryKeys.status.incidents.all, params],
		staleTime: 60000,
		queryFn: async () => {
			const res = await getIncidents(params as Parameters<typeof getIncidents>[0]);
			return extractList<IncidentRecord>(res);
		},
	});
}

export function useIncident(id: string) {
	return useQuery({
		queryKey: queryKeys.status.incidents.detail(id),
		enabled: !!id,
		queryFn: async () => {
			const res = await getIncident(id);
			return extractItem<IncidentRecord>(res);
		},
	});
}

export function useCreateIncident() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createIncident,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.status.incidents.all }),
	});
}

export function useUpdateIncident() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
			updateIncident(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.status.incidents.all }),
	});
}

export function useDeleteIncident() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteIncident,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.status.incidents.all }),
	});
}

export function useAddIncidentUpdate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
			addIncidentUpdate(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.status.incidents.all }),
	});
}

export function useMaintenances(params?: Record<string, unknown>) {
	return useQuery({
		queryKey: [...queryKeys.status.maintenances.all, params],
		staleTime: 60000,
		queryFn: async () => {
			const res = await getMaintenances(params as Parameters<typeof getMaintenances>[0]);
			return extractList<MaintenanceRecord>(res);
		},
	});
}

export function useMaintenance(id: string) {
	return useQuery({
		queryKey: queryKeys.status.maintenances.detail(id),
		enabled: !!id,
		queryFn: async () => {
			const res = await getMaintenance(id);
			return extractItem<MaintenanceRecord>(res);
		},
	});
}

export function useCreateMaintenance() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createMaintenance,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.status.maintenances.all }),
	});
}

export function useUpdateMaintenance() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
			updateMaintenance(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.status.maintenances.all }),
	});
}

export function useDeleteMaintenance() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteMaintenance,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.status.maintenances.all }),
	});
}

export function useOverview() {
	return useQuery({
		queryKey: queryKeys.status.overview,
		staleTime: 30000,
		queryFn: async () => {
			const res = await getOverview();
			return extractItem<OverviewRecord>(res);
		},
	});
}

export function useSubscribers(params?: Record<string, unknown>) {
	return useQuery({
		queryKey: [...queryKeys.status.subscribers, params],
		staleTime: 60000,
		queryFn: async () => {
			const res = await getSubscribers(params);
			return extractList<SubscriberRecord>(res);
		},
	});
}
