import { message } from '@/lib/antd-app';
import { extractApiError } from '@autional/shared';
import i18n from '@/i18n';

const notify = (msg: string) => message.error(msg);

export type ApiErrorKind =
	| 'realname'
	| 'entry-plane'
	| 'forbidden'
	| 'not-found'
	| 'network'
	| 'server'
	| 'unknown';

export interface ApiErrorCopy {
	title: string;
	description: string;
}

// 后端 RFC 7807 信封：code=40000503 有实名门与入口平面两处生产者，靠 i18n_key 区分
// （micro-middleware/auth/realname_gate.go 与 entry_plane_guard.go）
const REALNAME_I18N_KEY = 'error.realname_verification_required';
const ENTRY_PLANE_I18N_KEY = 'error.auth.entry_plane_forbidden';
const FORBIDDEN_CODE = 40000503;

// 文案存 i18n 键（模块级无组件作用域）：apiErrorCopy() 调用时经 i18n.t 求值，
// 不冻结语言（切换语言后新取文案即为新语言；旧版在模块初始化时冻结中文）。
const COPY_KEYS: Record<Exclude<ApiErrorKind, 'unknown'>, ApiErrorCopy> = {
	realname: {
		title: 'errorHandler.realname.title',
		description: 'errorHandler.realname.description',
	},
	'entry-plane': {
		title: 'errorHandler.entryPlane.title',
		description: 'errorHandler.entryPlane.description',
	},
	forbidden: {
		title: 'errorHandler.forbidden.title',
		description: 'errorHandler.forbidden.description',
	},
	'not-found': {
		title: 'errorHandler.notFound.title',
		description: 'errorHandler.notFound.description',
	},
	network: {
		title: 'errorHandler.network.title',
		description: 'errorHandler.network.description',
	},
	server: {
		title: 'errorHandler.server.title',
		description: 'errorHandler.server.description',
	},
};

interface ErrorBody {
	// 错误路径响应不经拦截器 camelCase 转换，信封键保持后端 wire 形状（snake）
	code?: number | string;
	i18n_key?: string;
	title?: string;
	detail?: string;
}

function responseOf(err: unknown): { status?: number; data?: ErrorBody } | undefined {
	return (err as { response?: { status?: number; data?: ErrorBody } } | null | undefined)?.response;
}

function isAxiosLike(err: unknown): boolean {
	if (err === null || typeof err !== 'object') return false;
	const e = err as { isAxiosError?: boolean; config?: unknown };
	return e.isAxiosError === true || e.config !== undefined;
}

export function classifyApiError(err: unknown): ApiErrorKind {
	const resp = responseOf(err);
	if (!resp) {
		// 仅确诊「HTTP 请求发出但未收到响应」（网络错误/超时）；普通 Error 保持 unknown
		return isAxiosLike(err) ? 'network' : 'unknown';
	}
	const data = resp.data;
	const i18nKey = typeof data?.i18n_key === 'string' ? data.i18n_key : '';
	if (i18nKey === REALNAME_I18N_KEY) return 'realname';
	if (i18nKey === ENTRY_PLANE_I18N_KEY) return 'entry-plane';
	const code = data?.code !== undefined ? Number(data.code) : undefined;
	if (resp.status === 403 || code === FORBIDDEN_CODE) return 'forbidden';
	if (resp.status === 404) return 'not-found';
	if (typeof resp.status === 'number' && resp.status >= 500) return 'server';
	return 'unknown';
}

export function apiErrorCopy(kind: ApiErrorKind): ApiErrorCopy | null {
	if (kind === 'unknown') return null;
	const keys = COPY_KEYS[kind];
	return { title: i18n.t(keys.title), description: i18n.t(keys.description) };
}

export function extractApiErrorMessage(
	err: unknown,
	defaultMsg = 'An unexpected error occurred',
): string {
	// 字符串错误保留原样；其余形状统一走 shared 单点
	// （response.data.message → title → detail → err.message → defaultMsg）
	if (typeof err === 'string') return err;
	return extractApiError(err, defaultMsg).message;
}

export function handleApiError(err: unknown, fallback?: string): void {
	const copy = apiErrorCopy(classifyApiError(err));
	if (copy) {
		notify(copy.description);
		return;
	}
	notify(fallback || extractApiErrorMessage(err));
}
