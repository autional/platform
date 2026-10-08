'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, Select, Space, Typography } from 'antd';
import { WarningOutlined, ExportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMutation } from '@tanstack/react-query';
import {
	extractListResult,
	getPortalUrl,
	usePageTitle,
	useTenantSlug,
} from '@autional/shared';
import { adminUsersImpersonateByUsersPost } from '@autional/shared/generated/api';
import { Alert, AppPageHeader, Result, SectionCard } from '@autional/ui';
import { getUsers } from '@/lib/api.generated';
import { message, modal } from '@/lib/antd-app';
import { handleApiError } from '@/lib/error-handler';

const { TextArea } = Input;
const { Text } = Typography;

interface ImpersonateFormValues {
	userId: string;
	reason: string;
}

interface ImpersonateSession {
	impersonationToken: string;
	expiresAt: string;
}

interface PlatformUser {
	id: string;
	username?: string;
	email?: string;
}

const userLabel = (u: PlatformUser) => u.username || u.email || u.id;

const formatExpiresAt = (value: string) => {
	const d = dayjs(value);
	return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : value;
};

export default function ImpersonatePage() {
	usePageTitle('管理员模拟登录');
	const tenantSlug = useTenantSlug();
	const [form] = Form.useForm<ImpersonateFormValues>();
	const [users, setUsers] = useState<PlatformUser[]>([]);
	const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
	const [searching, setSearching] = useState(false);
	const [target, setTarget] = useState<{ userId: string; label: string } | null>(null);
	const [session, setSession] = useState<ImpersonateSession | null>(null);
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const searchSeq = useRef(0);

	useEffect(
		() => () => {
			if (searchTimer.current) clearTimeout(searchTimer.current);
		},
		[],
	);

	// 远程搜索用户（300ms 防抖 + 序号栅栏丢弃过期响应）
	const handleUserSearch = (keyword: string) => {
		if (searchTimer.current) clearTimeout(searchTimer.current);
		const q = keyword.trim();
		if (!q) {
			searchSeq.current += 1;
			setUsers([]);
			setSearching(false);
			return;
		}
		searchTimer.current = setTimeout(async () => {
			const seq = ++searchSeq.current;
			setSearching(true);
			try {
				const res = await getUsers({ search: q, limit: 20 });
				if (seq !== searchSeq.current) return;
				setUsers(extractListResult<PlatformUser>(res).items);
			} catch {
				if (seq === searchSeq.current) setUsers([]);
			} finally {
				if (seq === searchSeq.current) setSearching(false);
			}
		}, 300);
	};

	const impersonateMut = useMutation({
		mutationFn: (values: ImpersonateFormValues) =>
			adminUsersImpersonateByUsersPost(values.userId, {
				reason: values.reason,
			}) as Promise<ImpersonateSession>,
		onSuccess: (payload) => {
			setSession(payload);
			message.success('模拟会话已创建');
		},
		onError: (err) => {
			handleApiError(err, '模拟登录失败');
		},
	});

	const handleSubmit = (values: ImpersonateFormValues) => {
		const selected = selectedUser?.id === values.userId ? selectedUser : users.find((u) => u.id === values.userId);
		const label = selected ? userLabel(selected) : values.userId;
		// 旧「我确认」checkbox 由提交前二次确认替代（见下方 modal.confirm）
		modal.confirm({
			title: '确认发起模拟会话？',
			content: `将以「${label}」的身份进入管理控制台。模拟会话 1 小时内有效、全程审计。`,
			okText: '确认模拟',
			cancelText: '取消',
			onOk: () => {
				setTarget({ userId: values.userId, label });
				impersonateMut.mutate(values);
			},
		});
	};

	const handleBack = () => {
		setSession(null);
		setTarget(null);
		setSelectedUser(null);
		setUsers([]);
		form.resetFields();
	};

	// token 只经 hash fragment 交接（fragment 不进服务端日志 / Referer），不渲染明文
	const openAdminConsole = () => {
		if (!session) return;
		const base = getPortalUrl('admin', tenantSlug) || `${window.location.origin}/admin`;
		window.open(`${base}#impersonate=${session.impersonationToken}`, '_blank', 'noopener');
	};

	if (session && target) {
		return (
			<div>
				<div className="mb-6">
					<AppPageHeader title="管理员模拟登录" description="模拟其他用户登录系统" />
				</div>
				<SectionCard padding="lg">
					<Result
						variant="success"
						surface="tinted"
						title="模拟会话已就绪"
						description={
							<Space orientation="vertical" size="small">
								<Text>
									目标用户：{target.label}（{target.userId}）
								</Text>
								<Text>
									会话有效期至 {formatExpiresAt(session.expiresAt)}（1 小时后自动过期）
								</Text>
								<Text type="secondary">
									模拟会话将在新窗口生效，可在该窗口顶部横幅随时终止。
								</Text>
							</Space>
						}
						action={[
							<Button
								key="open"
								type="primary"
								icon={<ExportOutlined />}
								onClick={openAdminConsole}
							>
								打开管理控制台（模拟会话）
							</Button>,
							<Button key="back" onClick={handleBack}>
								返回
							</Button>,
						]}
					/>
				</SectionCard>
			</div>
		);
	}

	const userOptions = (
		selectedUser && !users.some((u) => u.id === selectedUser.id)
			? [selectedUser, ...users]
			: users
	).map((u) => ({ value: u.id, label: userLabel(u), user: u }));

	return (
		<div>
			<div className="mb-6">
				<AppPageHeader title="管理员模拟登录" description="以其他用户身份登录系统进行操作" />
			</div>

			<Alert
				variant="warning"
				title="模拟用户操作将被完整审计。请谨慎使用。"
				className="mb-6"
				icon={<WarningOutlined />}
			/>

			<SectionCard title="模拟登录表单" padding="lg">
				<Form form={form} layout="vertical" onFinish={handleSubmit}>
					<Form.Item
						name="userId"
						label="目标用户"
						rules={[{ required: true, message: '请搜索并选择目标用户' }]}
					>
						<Select
							placeholder="输入用户名或邮箱搜索"
							showSearch={{ filterOption: false, onSearch: handleUserSearch }}
							loading={searching}
							notFoundContent={searching ? '搜索中…' : '输入用户名或邮箱搜索'}
							options={userOptions}
							onSelect={(_value: string, option: Record<string, unknown>) =>
								setSelectedUser((option?.user as PlatformUser) ?? null)
							}
							optionRender={(option) => {
								const u = option.data.user as PlatformUser;
								return (
									<div className="flex flex-col">
										<span>{userLabel(u)}</span>
										<span className="text-xs text-[var(--color-text-secondary)]">
											{u.email && u.email !== userLabel(u) ? `${u.email} · ` : ''}
											{u.id}
										</span>
									</div>
								);
							}}
						/>
					</Form.Item>

					<Form.Item
						name="reason"
						label="模拟原因"
						rules={[{ required: true, message: '请输入模拟原因' }]}
					>
						<TextArea rows={3} placeholder="请详细说明模拟该用户的原因" />
					</Form.Item>

					<Form.Item>
						<Button
							type="primary"
							htmlType="submit"
							loading={impersonateMut.isPending}
							size="large"
						>
							开始模拟
						</Button>
					</Form.Item>
				</Form>
			</SectionCard>
		</div>
	);
}
