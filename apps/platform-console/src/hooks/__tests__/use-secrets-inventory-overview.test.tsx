/**
 * U413 锁：useSecretsInventoryOverview 必须透传子查询原始错误对象（含 response 信封），
 * 供 ApiErrorState 分类器识别。旧实现合成 new Error('Failed to load overview') 丢信封，
 * 密钥清单页 403 曾只显示英文原文（n21 线上复核实证）。改回合成错误即红。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({
	adminSecrets: vi.fn(),
	adminSecretsEncryptionKeys: vi.fn(),
	adminSecretsJwtKeys: vi.fn(),
	adminInfraCredentials: vi.fn(),
	adminAuthApiKeys: vi.fn(),
	adminOauthClients: vi.fn(),
	adminOauthClientsRotateSecretByClientsPost: vi.fn(),
}));

vi.mock('@autional/shared/generated/api', () => api);

// 忠实复刻真实实现（utils/response.ts，信封解包双分支），保证 mock 与生产形状一致
vi.mock('@autional/shared', () => ({
	extractList: (res: unknown) => {
		if (!res) return [];
		if (Array.isArray(res)) return res;
		const r = res as Record<string, unknown>;
		const dataObj = r.data as Record<string, unknown> | undefined;
		const items = r.items ?? dataObj?.items ?? r.data ?? [];
		return Array.isArray(items) ? items : [];
	},
	extractItem: (res: unknown) => {
		if (!res) return null;
		const r = res as Record<string, unknown>;
		return (r.data ?? r ?? null) as unknown;
	},
	extractApiError: (err: unknown, d: string) => {
		const data = (err as any)?.response?.data;
		return {
			code: data?.code || 'UNKNOWN',
			message: data?.message || data?.title || data?.detail || (err as any)?.message || d,
			i18nKey: data?.i18n_key || data?.i18nKey || undefined,
		};
	},
}));

import { useSecretsInventoryOverview } from '@/hooks/use-secrets-inventory';
import { classifyApiError } from '@/lib/error-handler';

const E403 = Object.assign(new Error('Request failed with status code 403'), {
	isAxiosError: true,
	response: {
		status: 403,
		data: { code: 40000503, i18n_key: 'error.realname_verification_required' },
	},
});

function makeWrapper() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
}

describe('useSecretsInventoryOverview 错误透传（U413）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// 生成的 API 函数返回拦截器解包后的 payload（非 axios 响应对象）
		api.adminSecretsEncryptionKeys.mockResolvedValue({ keys: [] });
		api.adminSecretsJwtKeys.mockResolvedValue({ keys: [] });
		api.adminInfraCredentials.mockResolvedValue({ credentials: [] });
		api.adminAuthApiKeys.mockResolvedValue([]);
		api.adminOauthClients.mockResolvedValue([]);
	});

	it('子查询 403 时 error 为原始错误对象（分类器可识别实名门信封）', async () => {
		api.adminSecrets.mockRejectedValue(E403);
		const { result } = renderHook(() => useSecretsInventoryOverview(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.error).not.toBeNull());
		expect(result.current.error).toBe(E403);
		expect(classifyApiError(result.current.error)).toBe('realname');
	});

	it('全部子查询成功时 error 为 null', async () => {
		api.adminSecrets.mockResolvedValue([]);
		const { result } = renderHook(() => useSecretsInventoryOverview(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.error).toBeNull();
	});
});
