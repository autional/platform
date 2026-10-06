'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type * as GeneratedTypes from '@autional/shared/generated/types';
import {
	adminSecrets,
	adminSecretsDetail,
	adminSecretsVersions,
	adminSecretsVersionsValuePost,
	adminSecretsPost,
	adminSecretsUpdatePost,
	adminSecretsItemKeyByKeyDelete,
	adminSecretsRotatePost,
	adminSecretsRevokePost,
	adminSecretsBatchRevokePost,
	adminSecretsBatchDeletePost,
	adminSecretsEncryptionKeys,
} from '@autional/shared/generated/api';
import { queryKeys } from '@/lib/query-keys';

export type SecretRecord = GeneratedTypes.SecretResponse;

export function useSecrets(params?: {
	prefix?: string;
	status?: string;
	page?: number;
	page_size?: number;
}) {
	return useQuery({
		queryKey: queryKeys.secrets.list(params),
		staleTime: 300000,
		queryFn: async () => {
			const data = await adminSecrets(params);
			if (data?.items) return data.items as SecretRecord[];
			if (Array.isArray(data)) return data as SecretRecord[];
			return [];
		},
	});
}

export function useSecretDetail(key: string) {
	return useQuery({
		queryKey: queryKeys.secrets.detail(key),
		queryFn: async () => {
			const data = await adminSecretsDetail({ key });
			return (
				(data?.data as GeneratedTypes.SecretDetailResponse) ??
				(data as GeneratedTypes.SecretDetailResponse)
			);
		},
		enabled: !!key,
	});
}

export function useSecretVersions(key: string) {
	return useQuery({
		queryKey: queryKeys.secrets.versions(key),
		queryFn: async () => {
			const data = await adminSecretsVersions({ key });
			return (
				(data?.data as GeneratedTypes.SecretVersionResponse[]) ??
				(data as GeneratedTypes.SecretVersionResponse[])
			);
		},
		enabled: !!key,
	});
}

export function useSecretVersionValue() {
	return useMutation({
		mutationFn: async ({ key, version }: { key: string; version: number }) => {
			const data = await adminSecretsVersionsValuePost({ version } as any, { key });
			return (
				(data?.data as GeneratedTypes.SecretValueResponse) ??
				(data as GeneratedTypes.SecretValueResponse)
			);
		},
	});
}

export function useCreateSecret() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: { key: string; value: string; description?: string }) => {
			return adminSecretsPost(data as any);
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets.all }),
	});
}

export function useUpdateSecret() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ key, data }: { key: string; data: { description?: string } }) => {
			return adminSecretsUpdatePost(data as any, { key });
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets.all }),
	});
}

export function useDeleteSecret() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (key: string) => {
			await adminSecretsItemKeyByKeyDelete(key);
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets.all }),
	});
}

export function useRotateSecret() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ key, data }: { key: string; data: { value: string } }) => {
			return adminSecretsRotatePost(data as any, { key });
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets.all }),
	});
}

export function useRevokeSecret() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (key: string) => {
			await adminSecretsRevokePost({ key });
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets.all }),
	});
}

export function useBatchRevoke() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (keys: string[]) => {
			const data = await adminSecretsBatchRevokePost({ keys } as any);
			return (
				(data?.data as { succeeded: string[]; errors: { key: string; error: string }[] }) ??
				(data as any)
			);
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets.all }),
	});
}

export function useBatchDelete() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (keys: string[]) => {
			const data = await adminSecretsBatchDeletePost({ keys } as any);
			return (
				(data?.data as { succeeded: string[]; errors: { key: string; error: string }[] }) ??
				(data as any)
			);
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets.all }),
	});
}

export function useEncryptionKeys() {
	return useQuery({
		queryKey: queryKeys.secrets.encryptionKeys,
		queryFn: async () => {
			const data = await adminSecretsEncryptionKeys();
			return (data?.data as { current: string; available: string[] }) ?? (data as any);
		},
	});
}
