/**
 * Ops Action 写面（P2-4）——纯逻辑与形状归一。
 *
 * 上游：ops-action-service 平台运维面
 *   GET  /ops-action/api/v1/admin/actions       动作目录
 *   POST /ops-action/api/v1/admin/actions       创建动作（R1+ 需 Consent 审批）
 *   GET  /ops-action/api/v1/admin/actions/{id}  动作记录
 *
 * 纪律：
 *   - 参数（params）只上行、不回显：上游 Action 的 params 字段本身就是 `json:"-"`。
 *   - 本页只发起请求；批准/拒绝仍在 Consent PWA（/c/<consent_id>）。
 *   - 状态归一：未知状态不得渲染成「已批准」。
 */

/** 平台运维面路径（apiClient 的 baseURL 已含 /bff）。 */
export const OPS_ACTIONS_API = '/ops-action/api/v1/admin/actions';

export interface OpsActionCatalogItem {
	action: string;
	description?: string;
	risk: string;
	requiredScope?: string;
	requiredFactor?: string;
}

export interface OpsActionRecord {
	actionId: string;
	action: string;
	risk: string;
	status: string;
	summary?: string;
	target?: string;
	targetTenantId?: string;
	consentId?: string;
	errorCode?: string;
	result?: string;
	createdAt?: string;
	updatedAt?: string;
}

/** 创建请求的 wire body：上游 JSON 是 snake_case，不能直接 spread camelCase。 */
export function buildOpsActionCreateBody(input: {
	action: string;
	target?: string;
	targetTenantId?: string;
	params?: Record<string, unknown>;
	summary: string;
	reason?: string;
}): Record<string, unknown> {
	return {
		action: input.action,
		target: input.target,
		target_tenant_id: input.targetTenantId,
		params: input.params ?? {},
		summary: input.summary,
		reason: input.reason,
	};
}

/** 终态：不再轮询。 */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
	'succeeded',
	'failed',
	'rejected',
	'denied',
	'expired',
	'canceled',
	'request_failed',
	'unknown',
]);

export function isTerminalStatus(status: string): boolean {
	return TERMINAL_STATUSES.has(normalizeStatus(status));
}

export function normalizeStatus(status: unknown): string {
	return typeof status === 'string' ? status.trim().toLowerCase() : 'unknown';
}

export function actionsApiPath(actionId?: string): string {
	if (!actionId) return OPS_ACTIONS_API;
	return `${OPS_ACTIONS_API}/${encodeURIComponent(actionId)}`;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
	for (const key of keys) {
		const value = obj[key];
		if (value !== undefined && value !== null && value !== '') return value;
	}
	return undefined;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

/** 目录响应：`{items:[...]}`（也容忍裸数组 / camelCase）。 */
export function normalizeCatalog(payload: unknown): OpsActionCatalogItem[] {
	const root = asRecord(payload);
	const rawItems = Array.isArray(payload) ? payload : root?.items;
	if (!Array.isArray(rawItems)) return [];
	const items: OpsActionCatalogItem[] = [];
	for (const raw of rawItems) {
		const item = asRecord(raw);
		const action = item ? asString(item.action) : undefined;
		if (!item || !action) continue;
		items.push({
			action,
			description: asString(item.description),
			risk: asString(item.risk) ?? 'unknown',
			requiredScope: asString(pick(item, 'required_scope', 'requiredScope')),
			requiredFactor: asString(pick(item, 'required_factor', 'requiredFactor')),
		});
	}
	return items;
}

/** 单条记录：上游返回裸对象（无 code 信封），键名是 snake_case。 */
export function normalizeAction(payload: unknown): OpsActionRecord {
	const item = asRecord(payload) ?? {};
	const actionId = asString(pick(item, 'action_id', 'actionId', 'id')) ?? '';
	return {
		actionId,
		action: asString(item.action) ?? '',
		risk: asString(item.risk) ?? 'unknown',
		status: normalizeStatus(item.status),
		summary: asString(item.summary),
		target: asString(item.target),
		targetTenantId: asString(pick(item, 'target_tenant_id', 'targetTenantId')),
		consentId: asString(pick(item, 'consent_id', 'consentId')),
		errorCode: asString(pick(item, 'error_code', 'errorCode')),
		result: asString(item.result),
		createdAt: asString(pick(item, 'created_at', 'createdAt')),
		updatedAt: asString(pick(item, 'updated_at', 'updatedAt')),
	};
}

/**
 * Consent PWA 深链。baseUrl 由 `getPortalUrl('consent')` 提供；
 * 未拿到 http(s) 基址时返回 null（页面只显示 consent_id，不给假链接）。
 */
export function consentDeepLink(consentId: string | undefined, baseUrl: string | undefined): string | null {
	if (!consentId || !baseUrl) return null;
	const trimmed = baseUrl.replace(/\/+$/, '');
	if (!/^https?:\/\//i.test(trimmed)) return null;
	// env.js 缺 consent 门户时 getPortalUrl 会退化为「当前源 + /consent」——
	// 那不是 Consent PWA，宁可只显示 consent_id，也不给假链接。
	let host: string;
	try {
		host = new URL(trimmed).hostname;
	} catch {
		return null;
	}
	if (!host.startsWith('consent.') && host !== 'localhost' && host !== '127.0.0.1') return null;
	return `${trimmed}/c/${encodeURIComponent(consentId)}`;
}

/** 执行结果预览上限：结果可能很大（例如 tenant.get 的整行），页面只展示前 N 字符。 */
export const RESULT_PREVIEW_LIMIT = 4000;

export function previewResult(
	result: string | undefined,
	limit = RESULT_PREVIEW_LIMIT,
): { text: string; truncated: boolean } | null {
	if (!result) return null;
	if (result.length <= limit) return { text: result, truncated: false };
	return { text: `${result.slice(0, limit)}…`, truncated: true };
}

export type OpsActionErrorKind =
	| 'unauthorized'
	| 'forbidden'
	| 'invalid'
	| 'quota'
	| 'conflict'
	| 'unavailable'
	| 'unknown';

/**
 * 创建失败分类（页面据此给出可操作提示）。
 * 上游错误体是 `{"error":"..."}`（不经 code 信封，拦截器不改形）。
 */
export function classifyOpsActionError(error: unknown): OpsActionErrorKind {
	const resp = (error as { response?: { status?: number; data?: unknown } } | undefined)?.response;
	const status = typeof resp?.status === 'number' ? resp.status : undefined;
	const data = resp?.data;
	const code =
		data && typeof data === 'object' ? asString((data as Record<string, unknown>).error) : undefined;

	if (status === 429 || code === 'auto_quota_exceeded') return 'quota';
	if (status === 401) return 'unauthorized';
	if (status === 403) return 'forbidden';
	if (status === 409) return 'conflict';
	if (status === 400) return 'invalid';
	if (status === undefined || status >= 500) return 'unavailable';
	return 'unknown';
}

/** 幂等键：同一次点击重试不应生成第二个动作。 */
export function newIdempotencyKey(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `console-${crypto.randomUUID()}`;
	}
	return `console-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 本次会话记住的动作（不含 params，只存展示字段）。 */
export interface RecentOpsAction {
	actionId: string;
	action: string;
	status: string;
	createdAt?: string;
	consentId?: string;
}

const RECENT_STORAGE_KEY = 'platform-console.ops-actions.recent';
const RECENT_LIMIT = 20;

export function loadRecentActions(storage?: Storage | null): RecentOpsAction[] {
	const store = storage ?? safeSessionStorage();
	if (!store) return [];
	try {
		const raw = store.getItem(RECENT_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(item): item is RecentOpsAction =>
				!!item && typeof item === 'object' && typeof (item as RecentOpsAction).actionId === 'string',
		);
	} catch {
		return [];
	}
}

export function rememberAction(record: OpsActionRecord, storage?: Storage | null): RecentOpsAction[] {
	const store = storage ?? safeSessionStorage();
	const entry: RecentOpsAction = {
		actionId: record.actionId,
		action: record.action,
		status: record.status,
		createdAt: record.createdAt,
		consentId: record.consentId,
	};
	const next = [entry, ...loadRecentActions(store).filter((item) => item.actionId !== entry.actionId)].slice(
		0,
		RECENT_LIMIT,
	);
	if (store) {
		try {
			store.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
		} catch {
			// 存储不可用（隐私模式/配额满）不应阻断创建流程
		}
	}
	return next;
}

/** 覆写本次会话的动作列表（用于轮询后同步状态）。 */
export function saveRecentActions(items: RecentOpsAction[], storage?: Storage | null): RecentOpsAction[] {
	const next = items.slice(0, RECENT_LIMIT);
	const store = storage ?? safeSessionStorage();
	if (store) {
		try {
			store.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
		} catch {
			// 忽略存储失败：页面仍显示内存态
		}
	}
	return next;
}

function safeSessionStorage(): Storage | null {
	try {
		if (typeof window === 'undefined' || !window.sessionStorage) return null;
		return window.sessionStorage;
	} catch {
		return null;
	}
}
