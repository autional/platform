import { describe, it, expect, vi } from 'vitest';

const mockMessageError = vi.fn();

vi.mock('@/lib/antd-app', () => ({
	message: {
		get error() {
			return mockMessageError;
		},
	},
}));

import {
	handleApiError,
	extractApiErrorMessage,
	classifyApiError,
	apiErrorCopy,
} from '@/lib/error-handler';

describe('extractApiErrorMessage', () => {
	it('extracts message from Error instances', () => {
		const err = new Error('Something broke');
		expect(extractApiErrorMessage(err)).toBe('Something broke');
	});

	it('returns the string as-is for string errors', () => {
		expect(extractApiErrorMessage('Network timeout')).toBe('Network timeout');
	});

	it('extracts message from axios-like error objects', () => {
		const err = { message: 'Request failed with status code 500', code: 500 };
		expect(extractApiErrorMessage(err)).toBe('Request failed with status code 500');
	});

	it('returns fallback message for null input', () => {
		expect(extractApiErrorMessage(null)).toBe('An unexpected error occurred');
	});

	it('returns fallback message for undefined input', () => {
		expect(extractApiErrorMessage(undefined)).toBe('An unexpected error occurred');
	});

	it('returns fallback message for objects without message property', () => {
		expect(extractApiErrorMessage({ code: 500 })).toBe('An unexpected error occurred');
	});

	it('returns fallback message for numbers', () => {
		expect(extractApiErrorMessage(42)).toBe('An unexpected error occurred');
	});

	it('reads the RFC 7807 problem detail from error responses', () => {
		const err = {
			isAxiosError: true,
			response: { status: 403, data: { code: 40000503, detail: 'real-name verification required' } },
		};
		expect(extractApiErrorMessage(err)).toBe('real-name verification required');
	});

	// U380: key chain is message → detail → title, matching Problem.GetMessage (detail-first).
	it('prefers the problem detail over title', () => {
		const err = {
			isAxiosError: true,
			response: { status: 400, data: { title: 'Invalid Request', detail: 'field email is required' } },
		};
		expect(extractApiErrorMessage(err)).toBe('field email is required');
	});

	it('falls back to the problem title when detail is absent', () => {
		const err = {
			isAxiosError: true,
			response: { status: 400, data: { title: 'Invalid Request' } },
		};
		expect(extractApiErrorMessage(err)).toBe('Invalid Request');
	});

	it('honours a custom default message', () => {
		expect(extractApiErrorMessage(null, '请稍后重试')).toBe('请稍后重试');
	});
});

describe('classifyApiError', () => {
	it('classifies the realname gate (40000503 + i18n_key)', () => {
		const err = {
			isAxiosError: true,
			response: {
				status: 403,
				data: { code: 40000503, i18n_key: 'error.realname_verification_required' },
			},
		};
		expect(classifyApiError(err)).toBe('realname');
	});

	it('classifies the entry plane guard by its i18n_key', () => {
		const err = {
			isAxiosError: true,
			response: {
				status: 403,
				data: { code: 40000503, i18n_key: 'error.auth.entry_plane_forbidden' },
			},
		};
		expect(classifyApiError(err)).toBe('entry-plane');
	});

	it('classifies 40000503 without a known i18n_key as forbidden', () => {
		const err = { isAxiosError: true, response: { status: 403, data: { code: 40000503 } } };
		expect(classifyApiError(err)).toBe('forbidden');
	});

	it('accepts string business codes', () => {
		const err = { isAxiosError: true, response: { status: 403, data: { code: '40000503' } } };
		expect(classifyApiError(err)).toBe('forbidden');
	});

	it('classifies other 403 responses as forbidden', () => {
		const err = { isAxiosError: true, response: { status: 403, data: { title: 'Forbidden' } } };
		expect(classifyApiError(err)).toBe('forbidden');
	});

	it('classifies 404 responses as not-found', () => {
		const err = { isAxiosError: true, response: { status: 404, data: {} } };
		expect(classifyApiError(err)).toBe('not-found');
	});

	it('classifies 5xx responses as server', () => {
		const err = { isAxiosError: true, response: { status: 502, data: {} } };
		expect(classifyApiError(err)).toBe('server');
	});

	it('classifies network failures (axios error without response)', () => {
		expect(classifyApiError({ isAxiosError: true, message: 'Network Error' })).toBe('network');
		expect(classifyApiError({ message: 'timeout of 30000ms exceeded', config: {} })).toBe('network');
	});

	it('keeps plain errors and non-HTTP shapes as unknown', () => {
		expect(classifyApiError(new Error('Login failed'))).toBe('unknown');
		expect(classifyApiError({ message: 'Server error', status: 503 })).toBe('unknown');
		expect(classifyApiError(null)).toBe('unknown');
		expect(classifyApiError('boom')).toBe('unknown');
	});

	it('classifies 400 business failures as unknown', () => {
		const err = {
			isAxiosError: true,
			response: { status: 400, data: { code: 40000101, detail: 'bad payload' } },
		};
		expect(classifyApiError(err)).toBe('unknown');
	});
});

describe('apiErrorCopy', () => {
	it('returns copy for classified kinds and null for unknown', () => {
		expect(apiErrorCopy('realname')?.title).toBe('需要实名认证');
		expect(apiErrorCopy('forbidden')?.title).toBe('无权限访问');
		expect(apiErrorCopy('unknown')).toBeNull();
	});
});

describe('handleApiError', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('calls message.error with the extracted error message', () => {
		handleApiError(new Error('Login failed'));
		expect(mockMessageError).toHaveBeenCalledWith('Login failed');
	});

	it('calls message.error with fallback when provided', () => {
		handleApiError(null, 'Something went wrong');
		expect(mockMessageError).toHaveBeenCalledWith('Something went wrong');
	});

	it('uses fallback message when both error and custom fallback are provided', () => {
		handleApiError('Real error message', 'Fallback');
		expect(mockMessageError).toHaveBeenCalledWith('Fallback');
	});

	it('calls message.error with default fallback for unknown errors without custom fallback', () => {
		handleApiError(null);
		expect(mockMessageError).toHaveBeenCalledWith('An unexpected error occurred');
	});

	it('handles axios-like error objects', () => {
		handleApiError({ message: 'Server error', status: 503 });
		expect(mockMessageError).toHaveBeenCalledWith('Server error');
	});

	it('prefers the classified copy over the fallback for the realname gate', () => {
		const err = {
			isAxiosError: true,
			response: {
				status: 403,
				data: { code: 40000503, i18n_key: 'error.realname_verification_required' },
			},
		};
		handleApiError(err, '保存失败');
		expect(mockMessageError).toHaveBeenCalledWith(
			'该功能要求账号完成实名认证。请联系平台管理员为账号补充认证后重试。',
		);
	});

	it('prefers the classified copy over the fallback for plain 403', () => {
		const err = { isAxiosError: true, response: { status: 403, data: {} } };
		handleApiError(err, '保存失败');
		expect(mockMessageError).toHaveBeenCalledWith(
			'当前账号没有该功能的访问权限。如需使用，请联系平台管理员调整授权。',
		);
	});

	it('prefers the classified copy over the fallback for network failures', () => {
		handleApiError({ isAxiosError: true, message: 'Network Error' }, '保存失败');
		expect(mockMessageError).toHaveBeenCalledWith('无法连接到服务器，请检查网络连接后重试。');
	});

	it('keeps fallback priority for unknown kinds', () => {
		const err = { isAxiosError: true, response: { status: 400, data: { detail: 'bad payload' } } };
		handleApiError(err, '保存失败');
		expect(mockMessageError).toHaveBeenCalledWith('保存失败');
	});
});
