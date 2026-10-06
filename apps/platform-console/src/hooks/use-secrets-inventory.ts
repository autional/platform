'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { extractList, extractItem } from '@autional/shared';
import {
	adminSecrets,
	adminSecretsEncryptionKeys,
	adminSecretsJwtKeys,
	adminInfraCredentials,
	adminAuthApiKeys,
	adminOauthClients,
	adminOauthClientsRotateSecretByClientsPost,
} from '@autional/shared/generated/api';
import { queryKeys } from '@/lib/query-keys';

export interface SecretKVRecord {
	key: string;
	tenantId: string;
	version: number;
	status: 'active' | 'expired' | 'revoked';
	description: string;
	category: string;
	expires: string | null;
	created: string;
	lastModified: string;
	isSystem: boolean;
}

export interface EncryptionKeyRecord {
	keyId: string;
	algorithm: string;
	status: 'current' | 'fallback';
	servicesUsing: string[];
}

export interface JwtKeyRecord {
	keyName: string;
	algorithm: string;
	keyId: string;
	status: string;
	lastRotated: string;
	inMemoryOnly: boolean;
}

export interface InfrastructureRecord {
	credentialName: string;
	location: string;
	type: 'DB' | 'Redis' | 'MQ' | 'MinIO' | 'API';
	managedBySecretService: boolean;
}

export interface ApiKeySummaryRecord {
	prefix: string;
	tenantId: string;
	type: 'user' | 'service' | 'system';
	created: string;
	status: 'active' | 'expired' | 'revoked';
	lastUsed: string;
	scopes: string[];
}

export interface OAuthSecretRecord {
	provider: string;
	clientId: string;
	status: 'active' | 'expired';
	lastUsed: string;
}

export interface SecretsInventoryOverview {
	totalSecrets: number;
	activeCount: number;
	expiredCount: number;
	revokedCount: number;
	categoryBreakdown: {
		kv: number;
		encryptionKeys: number;
		jwtKeys: number;
		infrastructure: number;
		apiKeys: number;
		oauth: number;
	};
}

// 响应经拦截器 camel 化；snake 兜底防契约回退（PL-61）。
function pickField<T>(item: object, camel: string, snake: string): T | undefined {
	const rec = item as Record<string, unknown>;
	return (rec[camel] as T | undefined) ?? (rec[snake] as T | undefined);
}

interface SecretApiItem {
	key: string;
	tenantId?: string;
	tenant_id?: string;
	version?: number;
	status?: string;
	description?: string;
	expires?: string | null;
	createdAt?: string;
	created_at?: string;
	updatedAt?: string;
	updated_at?: string;
	isSystem?: boolean;
	is_system?: boolean;
}

interface EncryptionKeyApiItem {
	keyId?: string;
	key_id?: string;
	algorithm?: string;
	status?: string;
	servicesUsing?: string[];
	services_using?: string[];
}

interface ApiKeyApiItem {
	keyPrefix?: string;
	key_prefix?: string;
	prefix?: string;
	tenantId?: string;
	tenant_id?: string;
	type?: string;
	createdAt?: string;
	created_at?: string;
	status?: string;
	lastUsedAt?: string;
	last_used_at?: string;
	scopes?: string[];
}

interface OAuthClientApiItem {
	provider?: string;
	clientId?: string;
	client_id?: string;
	status?: string;
	lastUsedAt?: string;
	last_used_at?: string;
}

interface JwtKeyApiItem {
	keyId?: string;
	key_id?: string;
	keyType?: string;
	key_type?: string;
	algorithm?: string;
	keySize?: number;
	key_size?: number;
	fingerprint?: string;
	hasPrivateKey?: boolean;
	has_private_key?: boolean;
	hasPublicKey?: boolean;
	has_public_key?: boolean;
	createdAt?: string;
	created_at?: string;
	updatedAt?: string;
	updated_at?: string;
	status?: string;
	version?: number;
}

interface InfraCredentialApiItem {
	name?: string;
	key?: string;
	infrastructure?: string;
	container?: string;
	sourceFile?: string;
	source_file?: string;
	consumers?: string[];
	category?: string;
}

function mapKVRecord(item: SecretApiItem): SecretKVRecord {
	return {
		key: item.key ?? '',
		tenantId: pickField<string>(item, 'tenantId', 'tenant_id') ?? 'system',
		version: item.version ?? 1,
		status: (item.status === 'active' || item.status === 'expired' || item.status === 'revoked'
			? item.status
			: 'active') as SecretKVRecord['status'],
		description: item.description ?? '',
		category: 'Secret KV',
		expires: item.expires ?? null,
		created: pickField<string>(item, 'createdAt', 'created_at') ?? '',
		lastModified:
			pickField<string>(item, 'updatedAt', 'updated_at') ??
			pickField<string>(item, 'createdAt', 'created_at') ??
			'',
		isSystem: pickField<boolean>(item, 'isSystem', 'is_system') ?? false,
	};
}

function mapEncryptionKey(item: EncryptionKeyApiItem): EncryptionKeyRecord {
	return {
		keyId: pickField<string>(item, 'keyId', 'key_id') ?? '',
		algorithm: item.algorithm ?? '',
		status: (item.status === 'current' || item.status === 'fallback'
			? item.status
			: 'current') as EncryptionKeyRecord['status'],
		servicesUsing: pickField<string[]>(item, 'servicesUsing', 'services_using') ?? [],
	};
}

function mapApiKeyRecord(item: ApiKeyApiItem): ApiKeySummaryRecord {
	return {
		prefix: pickField<string>(item, 'keyPrefix', 'key_prefix') ?? item.prefix ?? '',
		tenantId: pickField<string>(item, 'tenantId', 'tenant_id') ?? '',
		type: (item.type === 'user' || item.type === 'service' || item.type === 'system'
			? item.type
			: 'user') as ApiKeySummaryRecord['type'],
		created: pickField<string>(item, 'createdAt', 'created_at') ?? '',
		status: (item.status === 'active' || item.status === 'expired' || item.status === 'revoked'
			? item.status
			: 'active') as ApiKeySummaryRecord['status'],
		lastUsed: pickField<string>(item, 'lastUsedAt', 'last_used_at') ?? '',
		scopes: item.scopes ?? [],
	};
}

function mapOAuthRecord(item: OAuthClientApiItem): OAuthSecretRecord {
	return {
		provider: item.provider ?? '',
		clientId: pickField<string>(item, 'clientId', 'client_id') ?? '',
		status: (item.status === 'active' || item.status === 'expired'
			? item.status
			: 'active') as OAuthSecretRecord['status'],
		lastUsed: pickField<string>(item, 'lastUsedAt', 'last_used_at') ?? '',
	};
}

function mapJwtKeyRecord(item: JwtKeyApiItem): JwtKeyRecord {
	const keyType = pickField<string>(item, 'keyType', 'key_type');
	return {
		keyName: keyType ? `${keyType.toUpperCase()} Key` : 'JWT Key',
		algorithm: item.algorithm ?? '',
		keyId: pickField<string>(item, 'keyId', 'key_id') ?? '',
		status: item.status ?? 'unknown',
		lastRotated:
			pickField<string>(item, 'updatedAt', 'updated_at') ??
			pickField<string>(item, 'createdAt', 'created_at') ??
			'',
		inMemoryOnly: !pickField<boolean>(item, 'hasPublicKey', 'has_public_key'),
	};
}

const CATEGORY_TYPE_MAP: Record<string, InfrastructureRecord['type']> = {
	database: 'DB',
	cache: 'Redis',
	mq: 'MQ',
	storage: 'MinIO',
	auth: 'API',
};

function mapInfrastructureRecord(item: InfraCredentialApiItem): InfrastructureRecord {
	return {
		credentialName: item.name ?? '',
		location: pickField<string>(item, 'sourceFile', 'source_file') ?? '',
		type: CATEGORY_TYPE_MAP[item.category ?? ''] ?? 'API',
		managedBySecretService: false,
	};
}

export function useSecretsInventoryOverview() {
	const kv = useSecretsInventoryKV();
	const encKeys = useSecretsInventoryEncryptionKeys();
	const jwtKeys = useSecretsInventoryJwtKeys();
	const infra = useSecretsInventoryInfrastructure();
	const apiKeys = useSecretsInventoryApiKeys();
	const oauth = useSecretsInventoryOAuth();

	const isLoading =
		kv.isLoading ||
		encKeys.isLoading ||
		jwtKeys.isLoading ||
		infra.isLoading ||
		apiKeys.isLoading ||
		oauth.isLoading;
	const isError =
		kv.isError ||
		encKeys.isError ||
		jwtKeys.isError ||
		infra.isError ||
		apiKeys.isError ||
		oauth.isError;

	const refetch = () => {
		kv.refetch();
		encKeys.refetch();
		jwtKeys.refetch();
		infra.refetch();
		apiKeys.refetch();
		oauth.refetch();
	};

	const data = useMemo<SecretsInventoryOverview | undefined>(() => {
		const kvData = kv.data ?? [];
		const encData = encKeys.data ?? [];
		const jwtData = jwtKeys.data ?? [];
		const infraData = infra.data ?? [];
		const apiData = apiKeys.data ?? [];
		const oauthData = oauth.data ?? [];

		const allItems = [...kvData, ...encData, ...jwtData, ...infraData, ...apiData, ...oauthData];
		const totalSecrets = allItems.length;

		let activeCount = 0;
		let expiredCount = 0;
		let revokedCount = 0;

		for (const item of kvData) {
			if (item.status === 'active') activeCount++;
			else if (item.status === 'expired') expiredCount++;
			else if (item.status === 'revoked') revokedCount++;
		}

		for (const item of apiData) {
			if (item.status === 'active') activeCount++;
			else if (item.status === 'expired') expiredCount++;
			else if (item.status === 'revoked') revokedCount++;
		}

		for (const item of oauthData) {
			if (item.status === 'active') activeCount++;
			else if (item.status === 'expired') expiredCount++;
		}

		activeCount += encData.length + jwtData.length + infraData.length;

		return {
			totalSecrets,
			activeCount,
			expiredCount,
			revokedCount,
			categoryBreakdown: {
				kv: kvData.length,
				encryptionKeys: encData.length,
				jwtKeys: jwtData.length,
				infrastructure: infraData.length,
				apiKeys: apiData.length,
				oauth: oauthData.length,
			},
		};
	}, [kv.data, encKeys.data, jwtKeys.data, infra.data, apiKeys.data, oauth.data]);

	return {
		data,
		isLoading,
		error: (isError ? new Error('Failed to load overview') : null) as unknown as Error | null,
		refetch,
	};
}

export function useSecretsInventoryKV() {
	return useQuery<SecretKVRecord[]>({
		queryKey: queryKeys.secretsInventory.kv,
		staleTime: 30000,
		queryFn: async () => {
			const data = await adminSecrets();
			const items = extractList<SecretApiItem>({ data });
			return items.map(mapKVRecord);
		},
	});
}

export function useSecretsInventoryEncryptionKeys() {
	return useQuery<EncryptionKeyRecord[]>({
		queryKey: queryKeys.secretsInventory.encryptionKeys,
		staleTime: 30000,
		queryFn: async () => {
			const data = await adminSecretsEncryptionKeys();
			const extracted = extractItem<any>({ data });
			if (extracted?.keys && Array.isArray(extracted.keys)) {
				return extracted.keys.map(mapEncryptionKey);
			}
			if (extracted?.available && Array.isArray(extracted.available)) {
				const current = extracted.current ?? '';
				return extracted.available.map((keyId: string, idx: number) => ({
					keyId,
					algorithm: '',
					status: keyId === current ? ('current' as const) : ('fallback' as const),
					servicesUsing: [],
				}));
			}
			return [];
		},
	});
}

export function useSecretsInventoryJwtKeys() {
	return useQuery<JwtKeyRecord[]>({
		queryKey: queryKeys.secretsInventory.jwtKeys,
		staleTime: 60000,
		queryFn: async () => {
			const res = await adminSecretsJwtKeys();
			const data = extractItem<{ keys?: JwtKeyApiItem[] }>(res);
			if (data?.keys && Array.isArray(data.keys)) {
				return data.keys.map(mapJwtKeyRecord);
			}
			return [];
		},
	});
}

export function useSecretsInventoryInfrastructure() {
	return useQuery<InfrastructureRecord[]>({
		queryKey: queryKeys.secretsInventory.infrastructure,
		staleTime: 60000,
		queryFn: async () => {
			const data = await adminInfraCredentials();
			const extracted = extractItem<{ credentials?: InfraCredentialApiItem[] }>({ data });
			if (extracted?.credentials && Array.isArray(extracted.credentials)) {
				return extracted.credentials.map(mapInfrastructureRecord);
			}
			return [];
		},
	});
}

export function useSecretsInventoryApiKeys() {
	return useQuery<ApiKeySummaryRecord[]>({
		queryKey: queryKeys.secretsInventory.apiKeys,
		staleTime: 30000,
		queryFn: async () => {
			const data = await adminAuthApiKeys();
			const items = extractList<ApiKeyApiItem>({ data });
			return items.map(mapApiKeyRecord);
		},
	});
}

export function useSecretsInventoryOAuth() {
	return useQuery<OAuthSecretRecord[]>({
		queryKey: queryKeys.secretsInventory.oauth,
		staleTime: 30000,
		queryFn: async () => {
			const data = await adminOauthClients();
			const items = extractList<OAuthClientApiItem>({ data });
			return items.map(mapOAuthRecord);
		},
	});
}

/** 轮换密钥的响应（新密钥仅此一次返回，绝不落列表）。 */
export interface OAuthClientSecretRotationResult {
	clientId?: string;
	newSecret?: string;
	rotatedAt?: string;
}

/** PL-63：轮换 OAuth 客户端密钥（旧密钥立即失效，新密钥仅显示一次）。 */
export function useRotateOAuthClientSecret() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (clientId: string) => {
			const res = await adminOauthClientsRotateSecretByClientsPost(clientId);
			return extractItem<OAuthClientSecretRotationResult>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.secretsInventory.oauth });
		},
	});
}
