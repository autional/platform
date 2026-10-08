/**
 * PL-70 回归：管理员模拟登录页全链贯通。
 *
 * 判据：① 弃用旧 adminImpersonatePost（长效 token 对），改调
 * adminUsersImpersonateByUsersPost（单 access token + 生命周期）；② 提交前
 * modal.confirm 二次确认，取消不发请求；③ 成功态无 token 明文（不进 DOM），
 * 交接走 admin 门户 hash fragment；④ 失败沿 handleApiError。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';

const TOKEN = 'imp-token-9f2c1a4b7e8d';
const EXPIRES_AT = '2026-10-04T12:00:00Z';
const USER_ID = 'usr-42';
const USERNAME = 'alice';
const REASON = '排查用户反馈的登录问题';

const mocks = vi.hoisted(() => ({
	impersonatePost: vi.fn(),
	getUsers: vi.fn(),
	modalConfirm: vi.fn(),
	confirmConfig: { current: null as any },
	messageSuccess: vi.fn(),
	messageError: vi.fn(),
	handleApiError: vi.fn(),
}));

vi.mock('@autional/shared/generated/api', () => ({
	adminUsersImpersonateByUsersPost: (...args: unknown[]) => mocks.impersonatePost(...args),
}));

vi.mock('@/lib/api.generated', () => ({
	getUsers: (...args: unknown[]) => mocks.getUsers(...args),
}));

vi.mock('@autional/shared', () => ({
	usePageTitle: vi.fn(),
	useTenantSlug: () => 'that-slug',
	getPortalUrl: () => 'https://admin.example.test/that-slug',
	extractListResult: (res: { items?: unknown[] }) => ({
		items: res?.items ?? [],
		pagination: { page: 1, pageSize: 20, total: 0 },
	}),
}));

// useMutation 以「真实执行 mutationFn → 回投 onSuccess/onError」的桩替代，
// 让「确认 → 调端点 → 成功/失败态」整条链在测试里真实走通
vi.mock('@tanstack/react-query', () => ({
	useMutation: (options: any) => ({
		mutate: (vars: any) => {
			void Promise.resolve(options.mutationFn(vars)).then(
				(payload: any) => options.onSuccess?.(payload, vars),
				(err: any) => options.onError?.(err, vars),
			);
		},
		isPending: false,
	}),
}));

vi.mock('@/lib/antd-app', () => ({
	message: { success: mocks.messageSuccess, error: mocks.messageError },
	modal: {
		confirm: (config: any) => {
			mocks.confirmConfig.current = config;
			mocks.modalConfirm(config);
		},
	},
}));

vi.mock('@/lib/error-handler', () => ({
	handleApiError: (...args: unknown[]) => mocks.handleApiError(...args),
}));

vi.mock('@autional/ui', () => ({
	AppPageHeader: ({ title, description }: { title: string; description?: string }) => (
		<div data-testid="page-header">
			<h3>{title}</h3>
			{description && <p>{description}</p>}
		</div>
	),
	SectionCard: ({
		title,
		children,
	}: {
		title?: string;
		children: React.ReactNode;
		padding?: string;
	}) => (
		<div data-testid="section-card">
			{title && <h4>{title}</h4>}
			{children}
		</div>
	),
	Alert: ({ title }: { title?: string; variant?: string; icon?: React.ReactNode }) => (
		<div data-testid="alert">{title}</div>
	),
	Result: ({
		title,
		description,
		action,
	}: {
		title?: React.ReactNode;
		description?: React.ReactNode;
		action?: React.ReactNode;
	}) => (
		<div data-testid="result">
			<div>{title}</div>
			<div>{description}</div>
			<div>{action}</div>
		</div>
	),
}));

import ImpersonatePage from '@/app/impersonate/page';

let openSpy: ReturnType<typeof vi.fn>;

/** 选择器远程搜索候选（防抖 300ms 后出现），点选目标用户 */
async function selectTargetUser(user: ReturnType<typeof userEvent.setup>) {
	const combobox = screen.getByRole('combobox');
	await user.click(combobox);
	await user.type(combobox, USERNAME);
	const option = await screen.findByText(USERNAME, undefined, { timeout: 3000 });
	await user.click(option);
}

/** 填表并提交，等到二次确认弹窗（modal.confirm）被调用 */
async function fillFormAndSubmit(user: ReturnType<typeof userEvent.setup>) {
	render(<ImpersonatePage />);
	await selectTargetUser(user);
	await user.type(screen.getByLabelText('模拟原因'), REASON);
	// 直接触发 form submit：避开 jsdom 按钮隐式提交与弹窗本地化差异
	const formEl = screen.getByLabelText('模拟原因').closest('form');
	expect(formEl).not.toBeNull();
	fireEvent.submit(formEl!);
	await waitFor(() => expect(mocks.modalConfirm).toHaveBeenCalledTimes(1));
}

/** 走完「确认 → 请求 → 成功态」 */
async function confirmAndAwaitSuccess(user: ReturnType<typeof userEvent.setup>) {
	await fillFormAndSubmit(user);
	await act(async () => {
		mocks.confirmConfig.current.onOk();
	});
	await screen.findByText(/模拟会话已就绪/);
}

describe('ImpersonatePage (PL-70)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.confirmConfig.current = null;
		mocks.getUsers.mockResolvedValue({
			items: [{ id: USER_ID, username: USERNAME, email: 'alice@example.test' }],
			total: 1,
		});
		mocks.impersonatePost.mockResolvedValue({
			impersonationToken: TOKEN,
			expiresAt: EXPIRES_AT,
		});
		openSpy = vi.fn();
		vi.stubGlobal('open', openSpy);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('① 渲染审计警示、目标用户选择器与原因字段（旧确认 checkbox 已移除）', () => {
		render(<ImpersonatePage />);
		expect(screen.getByText(/模拟用户操作将被完整审计/)).toBeInTheDocument();
		expect(screen.getByLabelText('目标用户')).toBeInTheDocument();
		expect(screen.getByLabelText('模拟原因')).toBeInTheDocument();
		expect(screen.queryByText(/我确认/)).toBeNull();
	});

	it('② 提交先弹二次确认；不确认（取消）不调用 API', async () => {
		const user = userEvent.setup();
		await fillFormAndSubmit(user);

		expect(mocks.impersonatePost).not.toHaveBeenCalled();
		const config = mocks.confirmConfig.current;
		expect(String(config.content)).toContain(USERNAME);
		expect(String(config.content)).toContain('1 小时内有效');
		expect(String(config.content)).toContain('全程审计');
	});

	it('③ 确认后调用 adminUsersImpersonateByUsersPost（userId + reason 传参）', async () => {
		const user = userEvent.setup();
		await fillFormAndSubmit(user);
		await act(async () => {
			mocks.confirmConfig.current.onOk();
		});
		await waitFor(() => {
			expect(mocks.impersonatePost).toHaveBeenCalledWith(USER_ID, { reason: REASON });
		});
	});

	it('④ 成功态显示目标用户与到期时间；文档中不存在 token 明文', async () => {
		const user = userEvent.setup();
		await confirmAndAwaitSuccess(user);

		expect(screen.getByText(/目标用户：/)).toHaveTextContent(USERNAME);
		expect(screen.getByText(/目标用户：/)).toHaveTextContent(USER_ID);
		const formatted = dayjs(EXPIRES_AT).format('YYYY-MM-DD HH:mm:ss');
		expect(screen.getByText(new RegExp(formatted))).toBeInTheDocument();
		expect(screen.getByText(/1 小时后自动过期/)).toBeInTheDocument();

		expect(screen.queryByText(TOKEN)).toBeNull();
		expect(document.body.textContent ?? '').not.toContain(TOKEN);
	});

	it('⑤「打开管理控制台」以 hash fragment 交接 token（新窗口）', async () => {
		const user = userEvent.setup();
		await confirmAndAwaitSuccess(user);

		await user.click(screen.getByRole('button', { name: /打开管理控制台/ }));
		expect(openSpy).toHaveBeenCalledWith(
			`https://admin.example.test/that-slug#impersonate=${TOKEN}`,
			'_blank',
			'noopener',
		);
	});

	it('⑥ 失败时调用 handleApiError（模拟登录失败）', async () => {
		const err = new Error('impersonate failed');
		mocks.impersonatePost.mockRejectedValue(err);

		const user = userEvent.setup();
		await fillFormAndSubmit(user);
		await act(async () => {
			mocks.confirmConfig.current.onOk();
		});
		await waitFor(() => {
			expect(mocks.handleApiError).toHaveBeenCalledWith(err, '模拟登录失败');
		});
		expect(mocks.messageSuccess).not.toHaveBeenCalled();
	});

	it('⑦ 选择器远程搜索：防抖窗口内不发请求，随后按 search+limit 拉取候选', async () => {
		const user = userEvent.setup();
		render(<ImpersonatePage />);

		const combobox = screen.getByRole('combobox');
		await user.click(combobox);
		await user.type(combobox, USERNAME);
		expect(mocks.getUsers).not.toHaveBeenCalled();

		await screen.findByText(USERNAME, undefined, { timeout: 3000 });
		expect(mocks.getUsers).toHaveBeenCalledWith({ search: USERNAME, limit: 20 });
	});
});
