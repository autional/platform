import { describe, it, expect } from 'vitest';

import {
	actionsApiPath,
	classifyOpsActionError,
	buildOpsActionCreateBody,
	consentDeepLink,
	isTerminalStatus,
	loadRecentActions,
	normalizeAction,
	normalizeCatalog,
	previewResult,
	rememberAction,
	saveRecentActions,
	type OpsActionRecord,
} from '../ops-actions';

/** 内存 SessionStorage 桩（jsdom 默认没有 sessionStorage 语义差异）。 */
function memoryStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key: string) => map.get(key) ?? null,
		key: (index: number) => Array.from(map.keys())[index] ?? null,
		removeItem: (key: string) => {
			map.delete(key);
		},
		setItem: (key: string, value: string) => {
			map.set(key, value);
		},
	} as Storage;
}

const record: OpsActionRecord = {
	actionId: '01ACTION',
	action: 'ops.tenant.suspend',
	risk: 'R1',
	status: 'pending_consent',
	consentId: '01CONSENT',
	createdAt: '2026-11-12T00:00:00Z',
};

describe('ops-actions 形状归一', () => {
	it('目录：{items:[...]} → 数组，未知风险回落 unknown', () => {
		const items = normalizeCatalog({
			items: [
				{ action: 'ops.echo', risk: 'R0', description: 'echo', required_factor: 'sms_otp' },
				{ action: 'ops.x' },
				{ nope: true },
			],
		});
		expect(items).toHaveLength(2);
		expect(items[0]).toEqual({
			action: 'ops.echo',
			risk: 'R0',
			description: 'echo',
			requiredScope: undefined,
			requiredFactor: 'sms_otp',
		});
		expect(items[1].risk).toBe('unknown');
	});

	it('目录：非对象/非数组 → 空数组（不抛错）', () => {
		expect(normalizeCatalog(null)).toEqual([]);
		expect(normalizeCatalog('nope')).toEqual([]);
	});

	it('单条：snake_case 后端字段 → 前端形状；params 永不出现', () => {
		const got = normalizeAction({
			action_id: '01ACTION',
			action: 'ops.echo',
			risk: 'R0',
			status: 'SUCCEEDED',
			summary: 'echo',
			consent_id: '01CONSENT',
			result: '{"ok":true}',
			params: '{"secret":"x"}',
		});
		expect(got.actionId).toBe('01ACTION');
		expect(got.status).toBe('succeeded');
		expect(got.consentId).toBe('01CONSENT');
		expect(got.result).toBe('{"ok":true}');
		expect(JSON.stringify(got)).not.toContain('secret');
	});

	it('单条：camelCase 也能读（防上游统一换形）', () => {
		const got = normalizeAction({ actionId: 'A', action: 'ops.echo', status: 'pendingConsent' });
		expect(got.actionId).toBe('A');
		expect(got.status).toBe('pendingconsent');
	});
});

describe('ops-actions 状态与深链', () => {
	it('终态判定：未识别状态不算终态', () => {
		expect(isTerminalStatus('succeeded')).toBe(true);
		expect(isTerminalStatus('pending_consent')).toBe(false);
		expect(isTerminalStatus('weird')).toBe(false);
		expect(isTerminalStatus('')).toBe(false);
	});

	it('路径：详情 id 必须编码', () => {
		expect(actionsApiPath()).toBe('/ops-action/api/v1/admin/actions');
		expect(actionsApiPath('a/b')).toBe('/ops-action/api/v1/admin/actions/a%2Fb');
	});

	it('创建 body：targetTenantId 必须映射为 target_tenant_id', () => {
		const body = buildOpsActionCreateBody({
			action: 'ops.tenant.suspend',
			targetTenantId: '01TARGET',
			summary: 'suspend',
			params: { tenant_id: '01TARGET' },
		});
		expect(body.target_tenant_id).toBe('01TARGET');
		expect(body).not.toHaveProperty('targetTenantId');
		expect(body.action).toBe('ops.tenant.suspend');
	});

	it('结果预览：短结果直出，长结果截断', () => {
		expect(previewResult(undefined)).toBeNull();
		expect(previewResult('{"ok":true}')).toEqual({ text: '{"ok":true}', truncated: false });
		const long = 'x'.repeat(5000);
		const got = previewResult(long);
		expect(got?.truncated).toBe(true);
		expect(got?.text.length).toBe(4001);
	});

	it('错误分类：429/配额、401/403、400、409、5xx、网络', () => {
		expect(classifyOpsActionError({ response: { status: 429, data: {} } })).toBe('quota');
		expect(
			classifyOpsActionError({ response: { status: 500, data: { error: 'auto_quota_exceeded' } } }),
		).toBe('quota');
		expect(classifyOpsActionError({ response: { status: 401 } })).toBe('unauthorized');
		expect(classifyOpsActionError({ response: { status: 403 } })).toBe('forbidden');
		expect(classifyOpsActionError({ response: { status: 400 } })).toBe('invalid');
		expect(classifyOpsActionError({ response: { status: 409 } })).toBe('conflict');
		expect(classifyOpsActionError({ response: { status: 503 } })).toBe('unavailable');
		expect(classifyOpsActionError(new Error('network'))).toBe('unavailable');
		expect(classifyOpsActionError({ response: { status: 418 } })).toBe('unknown');
	});

	it('Consent 深链：仅 http(s) 基址才给链接', () => {
		expect(consentDeepLink('01C', 'https://consent.autional.cn')).toBe(
			'https://consent.autional.cn/c/01C',
		);
		expect(consentDeepLink('01C', 'https://consent.autional.cn/')).toBe(
			'https://consent.autional.cn/c/01C',
		);
		expect(consentDeepLink('01C', '')).toBeNull();
		expect(consentDeepLink(undefined, 'https://consent.autional.cn')).toBeNull();
		expect(consentDeepLink('01C', 'javascript:alert(1)')).toBeNull();
		// getPortalUrl 退化值（当前源 + /consent）不得变成假深链
		expect(consentDeepLink('01C', 'https://platform.autional.cn/consent')).toBeNull();
		expect(consentDeepLink('01C', 'http://localhost:13113')).toBe('http://localhost:13113/c/01C');
	});
});

describe('ops-actions 本次会话列表', () => {
	it('记住动作：去重 + 置顶 + 只存展示字段', () => {
		const storage = memoryStorage();
		rememberAction(record, storage);
		const next = rememberAction({ ...record, status: 'succeeded', summary: 'changed' }, storage);
		expect(next).toHaveLength(1);
		expect(next[0].status).toBe('succeeded');
		expect(JSON.stringify(next)).not.toContain('summary');

		const reloaded = loadRecentActions(storage);
		expect(reloaded[0].actionId).toBe('01ACTION');
	});

	it('存储损坏 → 空列表，不抛错', () => {
		const storage = memoryStorage();
		storage.setItem('platform-console.ops-actions.recent', '{not json');
		expect(loadRecentActions(storage)).toEqual([]);
	});

	it('保存后再读取一致', () => {
		const storage = memoryStorage();
		saveRecentActions([{ actionId: 'A', action: 'ops.echo', status: 'unknown' }], storage);
		expect(loadRecentActions(storage)).toEqual([
			{ actionId: 'A', action: 'ops.echo', status: 'unknown' },
		]);
	});
});
