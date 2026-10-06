import { message } from '@/lib/antd-app';
import { extractApiError } from '@autional/shared';

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

const COPY: Record<Exclude<ApiErrorKind, 'unknown'>, ApiErrorCopy> = {
	realname: {
		title: '需要实名认证',
		description: '该功能要求账号完成实名认证。请联系平台管理员为账号补充认证后重试。',
	},
	'entry-plane': {
		title: '入口受限',
		description: '当前登录入口无权访问该功能，请从对应门户重新登录。',
	},
	forbidden: {
		title: '无权限访问',
		description: '当前账号没有该功能的访问权限。如需使用，请联系平台管理员调整授权。',
	},
	'not-found': {
		title: '资源不存在',
		description: '请求的资源不存在或已被移除。',
	},
	network: {
		title: '网络连接失败',
		description: '无法连接到服务器，请检查网络连接后重试。',
	},
	server: {
		title: '服务异常',
		description: '服务器处理请求时出错，请稍后重试或联系平台运维。',
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
	return kind === 'unknown' ? null : COPY[kind];
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
