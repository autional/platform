'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from '@autional/ui/antd';
import {
	Card,
	Form,
	InputNumber,
	Switch,
	Button,
	message,
	Spin,
	TimePicker,
	Space,
	Statistic,
	Row,
	Col,
	Tabs,
	Tag,
	Popconfirm,
} from 'antd';
import {
	SafetyCertificateOutlined,
	SaveOutlined,
	ReloadOutlined,
	UserOutlined,
} from '@ant-design/icons';
import { handleApiError } from '@/lib/error-handler';
import { AuthService, fromPageResult, toPageParams } from '@autional/shared';
import {
	adminTenantsMinorsProtectionByTenants,
	adminTenantsMinorsProtectionByTenantsPut,
	adminUsers,
	adminConsents,
} from '@autional/shared/generated/api';
import type { UpdateMinorsProtectionConfigRequest } from '@autional/shared/generated/types';
import { ConsolePageHeader, SectionCard } from '@autional/ui';
import { ApiErrorState } from '@/components/ApiErrorState';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

// 响应经 shared client interceptor 统一 camelCase 化（api/client.ts），字段一律读 camelCase
interface MinorsProtectionConfig {
	dailyUsageLimitMin: number;
	monthlySpendLimit: number;
	nightModeEnabled: boolean;
	nightModeStart: string;
	nightModeEnd: string;
	liveStreamBlockedUnder16: boolean;
	contentFilterEnabled: boolean;
	childDefaultMaxPrivacy: boolean;
	minorDataRetentionDays: number;
}

interface MinorsFormValues {
	daily_usage_limit_min?: number;
	monthly_spend_limit?: number;
	night_mode_enabled?: boolean;
	night_mode_start?: dayjs.Dayjs;
	night_mode_end?: dayjs.Dayjs;
	live_stream_blocked_under16?: boolean;
	content_filter_enabled?: boolean;
	child_default_max_privacy?: boolean;
	minor_data_retention_days?: number;
}

interface MinorUser {
	id: string;
	tenant_id: string;
	email: string;
	phone: string;
	username: string;
	status: string;
	is_minor: boolean;
	age_group: string;
	birth_date: string;
	pending_parental_consent: boolean;
	created_at: string;
}

interface ConsentRecord {
	id: string;
	user_id: string;
	parent_email: string;
	parent_phone: string;
	status: string;
	verified: boolean;
	method: string;
	recorded_at: string;
	verified_at?: string;
}

const AGE_GROUP_LABELS: Record<string, string> = {
	'under-14': '14岁以下',
	'14-16': '14-16岁',
	'16-18': '16-18岁',
	adult: '成人',
};

const STATUS_COLORS: Record<string, string> = {
	pending: 'orange',
	verified: 'green',
	expired: 'default',
	denied: 'red',
};

export default function MinorsProtectionPage() {
	const [config, setConfig] = useState<MinorsProtectionConfig | null>(null);
	const [configError, setConfigError] = useState<Error | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [users, setUsers] = useState<MinorUser[]>([]);
	const [usersLoading, setUsersLoading] = useState(false);
	const [usersError, setUsersError] = useState<Error | null>(null);
	const [userTotal, setUserTotal] = useState<number | null>(null);
	const [userPage, setUserPage] = useState(1);
	const [userPageSize, setUserPageSize] = useState(20);
	const [consents, setConsents] = useState<ConsentRecord[]>([]);
	const [consentsLoading, setConsentsLoading] = useState(false);
	const [consentsError, setConsentsError] = useState<Error | null>(null);
	const [consentPage, setConsentPage] = useState(1);
	const [consentPageSize, setConsentPageSize] = useState(20);
	const [consentTotal, setConsentTotal] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState('config');
	const [form] = Form.useForm();

	useEffect(() => {
		loadConfig();
		loadUsers();
	}, []);

	const loadConfig = async () => {
		const tenantId = AuthService.getCurrentTenantId();
		if (!tenantId) {
			setConfigError(new Error('当前会话缺少租户上下文，无法加载配置'));
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const res = (await adminTenantsMinorsProtectionByTenants(
				tenantId,
			)) as MinorsProtectionConfig;
			setConfigError(null);
			setConfig(res);
			form.setFieldsValue({
				daily_usage_limit_min: res.dailyUsageLimitMin,
				monthly_spend_limit: res.monthlySpendLimit,
				night_mode_enabled: res.nightModeEnabled,
				night_mode_start: res.nightModeStart
					? dayjs(res.nightModeStart, 'HH:mm')
					: dayjs('22:00', 'HH:mm'),
				night_mode_end: res.nightModeEnd
					? dayjs(res.nightModeEnd, 'HH:mm')
					: dayjs('06:00', 'HH:mm'),
				live_stream_blocked_under16: res.liveStreamBlockedUnder16,
				content_filter_enabled: res.contentFilterEnabled,
				child_default_max_privacy: res.childDefaultMaxPrivacy,
				minor_data_retention_days: res.minorDataRetentionDays,
			});
		} catch (err) {
			setConfig(null);
			setConfigError(err instanceof Error ? err : new Error('加载未成年人保护配置失败'));
		} finally {
			setLoading(false);
		}
	};

	const loadUsers = async (page: number = userPage, pageSize: number = userPageSize) => {
		setUsersLoading(true);
		try {
			// generated adminUsers 签名缺 is_minor/page_size（后端 UserListRequest 实收，契约漂移待对齐）
			// 服务端分页：total 用后端真值，分页器不再切本地 100 条切片
			const data = await adminUsers({ page, page_size: pageSize, is_minor: true } as any);
			setUsersError(null);
			const result = fromPageResult<MinorUser>(data);
			setUsers(result.items);
			setUserTotal(result.total);
		} catch (err) {
			setUsersError(err instanceof Error ? err : new Error('加载未成年用户列表失败'));
		} finally {
			setUsersLoading(false);
		}
	};

	const loadConsents = async (page: number = consentPage, pageSize: number = consentPageSize) => {
		setConsentsLoading(true);
		try {
			const data = await adminConsents(toPageParams({ page, pageSize }));
			setConsentsError(null);
			const result = fromPageResult<ConsentRecord>(data);
			setConsents(result.items);
			setConsentTotal(result.total);
		} catch (err) {
			setConsentsError(err instanceof Error ? err : new Error('加载家长同意记录失败'));
		} finally {
			setConsentsLoading(false);
		}
	};

	const handleTabChange = (key: string) => {
		setActiveTab(key);
		if (key === 'users' && users.length === 0 && !usersError) loadUsers();
		if (key === 'consents' && consents.length === 0 && !consentsError) loadConsents();
	};

	const handleSave = async () => {
		const tenantId = AuthService.getCurrentTenantId();
		if (!tenantId) {
			message.error('当前会话缺少租户上下文，无法保存配置');
			return;
		}
		let values: MinorsFormValues;
		try {
			values = (await form.validateFields()) as MinorsFormValues;
		} catch {
			return;
		}
		setSaving(true);
		try {
			const payload: UpdateMinorsProtectionConfigRequest = {
				dailyUsageLimitMin: values.daily_usage_limit_min,
				monthlySpendLimit: values.monthly_spend_limit,
				nightModeEnabled: values.night_mode_enabled,
				liveStreamBlockedUnder16: values.live_stream_blocked_under16,
				contentFilterEnabled: values.content_filter_enabled,
				childDefaultMaxPrivacy: values.child_default_max_privacy,
				minorDataRetentionDays: values.minor_data_retention_days,
			};
			if (values.night_mode_start) payload.nightModeStart = values.night_mode_start.format('HH:mm');
			if (values.night_mode_end) payload.nightModeEnd = values.night_mode_end.format('HH:mm');
			await adminTenantsMinorsProtectionByTenantsPut(tenantId, payload);
			message.success('未成年人保护配置已更新');
			loadConfig();
		} catch (err) {
			handleApiError(err, '保存配置失败');
		} finally {
			setSaving(false);
		}
	};

	const userColumns = [
		{ title: '用户ID', dataIndex: 'id', key: 'id', width: 200, ellipsis: true },
		{ title: '邮箱', dataIndex: 'email', key: 'email' },
		{ title: '手机', dataIndex: 'phone', key: 'phone' },
		{
			title: '年龄组',
			key: 'age_group',
			render: (_: unknown, r: any) => {
				const v = (r.ageGroup as string) ?? (r.age_group as string) ?? '';
				return (
					<Tag color={v === 'under-14' ? 'red' : v === '14-16' ? 'orange' : 'blue'}>
						{AGE_GROUP_LABELS[v] || v}
					</Tag>
				);
			},
		},
		{
			title: '家长同意',
			key: 'pending_parental_consent',
			render: (_: unknown, r: any) => {
				const v = (r.pendingParentalConsent as boolean) ?? (r.pending_parental_consent as boolean);
				return v ? <Tag color="orange">待验证</Tag> : <Tag color="green">已通过</Tag>;
			},
		},
		{ title: '状态', dataIndex: 'status', key: 'status' },
		{
			title: '注册时间',
			key: 'created_at',
			width: 180,
			render: (_: unknown, r: any) =>
				(r.createdAt as string) ?? (r.created_at as string) ?? '-',
		},
	];

	if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

	return (
		<div style={{ padding: 24 }}>
			<ConsolePageHeader title="未成年人保护" description="配置防沉迷策略、查看未成年用户、管理家长同意" />

			<Row gutter={16} style={{ marginBottom: 24 }}>
				<Col span={8}>
					<Card>
						<Statistic
							title="未成年用户数"
							value={userTotal ?? '—'}
							prefix={<UserOutlined />}
						/>
					</Card>
				</Col>
				<Col span={8}>
					<Card>
						<Statistic
							title="每日时长限制"
							value={config ? config.dailyUsageLimitMin : '—'}
							suffix={config ? '分钟' : undefined}
						/>
					</Card>
				</Col>
				<Col span={8}>
					<Card>
						<Statistic
							title="宵禁"
							value={
								config
									? config.nightModeEnabled
										? `${config.nightModeStart}-${config.nightModeEnd}`
										: '关闭'
									: '—'
							}
							prefix={<SafetyCertificateOutlined />}
						/>
					</Card>
				</Col>
			</Row>

			<Tabs
				activeKey={activeTab}
				onChange={handleTabChange}
				items={[
					{
						key: 'config',
						label: '策略配置',
						children: configError ? (
							<ApiErrorState
								error={configError}
								title="加载未成年人保护配置失败"
								onRetry={loadConfig}
							/>
						) : (
							<>
								<SectionCard title="防沉迷与宵禁">
									<Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
										<Form.Item
											name="daily_usage_limit_min"
											label="每日使用时长上限 (分钟)"
											tooltip="0 表示不限制"
										>
											<InputNumber min={0} max={1440} style={{ width: '100%' }} />
										</Form.Item>
										<Form.Item
											name="night_mode_enabled"
											label="启用宵禁"
											valuePropName="checked"
										>
											<Switch />
										</Form.Item>
										<Form.Item
											shouldUpdate={(prev, cur) =>
												prev.night_mode_enabled !== cur.night_mode_enabled
											}
										>
											{({ getFieldValue }) =>
												getFieldValue('night_mode_enabled') ? (
													<Space>
														<Form.Item name="night_mode_start" label="宵禁开始">
															<TimePicker format="HH:mm" />
														</Form.Item>
														<Form.Item name="night_mode_end" label="宵禁结束">
															<TimePicker format="HH:mm" />
														</Form.Item>
													</Space>
												) : null
											}
										</Form.Item>
									</Form>
								</SectionCard>

								<div style={{ marginTop: 16 }}>
									<SectionCard title="消费与功能限制">
										<Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
											<Form.Item
												name="monthly_spend_limit"
												label="每月消费上限 (分)"
												tooltip="0 表示不限制"
											>
												<InputNumber min={0} style={{ width: '100%' }} />
											</Form.Item>
											<Form.Item
												name="live_stream_blocked_under_16"
												label="禁止16岁以下直播"
												valuePropName="checked"
											>
												<Switch />
											</Form.Item>
											<Form.Item
												name="content_filter_enabled"
												label="启用内容过滤"
												valuePropName="checked"
											>
												<Switch />
											</Form.Item>
										</Form>
									</SectionCard>
								</div>

								<div style={{ marginTop: 16 }}>
									<SectionCard title="数据隐私">
										<Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
											<Form.Item
												name="child_default_max_privacy"
												label="未成年人默认最高隐私设置"
												valuePropName="checked"
											>
												<Switch />
											</Form.Item>
											<Form.Item
												name="minor_data_retention_days"
												label="未成年人数据保留天数"
											>
												<InputNumber min={30} max={3650} style={{ width: '100%' }} />
											</Form.Item>
										</Form>
									</SectionCard>
								</div>

								<div style={{ marginTop: 24, textAlign: 'right' }}>
									<Button
										onClick={loadConfig}
										icon={<ReloadOutlined />}
										style={{ marginRight: 8 }}
									>
										重置
									</Button>
									<Popconfirm
										title="确认保存配置？"
										description="保存后将对当前租户立即生效。"
										okText="确认保存"
										onConfirm={handleSave}
									>
										<Button
											type="primary"
											loading={saving}
											icon={<SaveOutlined />}
										>
											保存配置
										</Button>
									</Popconfirm>
								</div>
							</>
						),
					},
					{
						key: 'users',
						label: `未成年用户 (${userTotal ?? '—'})`,
						children: usersError ? (
							<ApiErrorState
								error={usersError}
								title="加载未成年用户列表失败"
								onRetry={() => loadUsers()}
							/>
						) : (
							<DataTable
								columns={userColumns}
								dataSource={users}
								rowKey="id"
								loading={usersLoading}
								pagination={{
									current: userPage,
									pageSize: userPageSize,
									total: userTotal ?? users.length,
									showSizeChanger: true,
									showTotal: (t) => `共 ${t} 人`,
									onChange: (p: number, ps: number) => {
										setUserPage(p);
										setUserPageSize(ps);
										loadUsers(p, ps);
									},
								}}
								scroll={{ x: 800 }}
							/>
						),
					},
					{
						key: 'consents',
						label: '家长同意管理',
						children: consentsError ? (
							<ApiErrorState
								error={consentsError}
								title="加载家长同意记录失败"
								onRetry={() => loadConsents()}
							/>
						) : (
							<DataTable
								columns={[
									{
										title: '用户ID',
										key: 'user_id',
										width: 200,
										ellipsis: true,
										render: (_: unknown, r: any) =>
											(r.userId as string) ?? (r.user_id as string) ?? '-',
									},
									{
										title: '家长邮箱',
										key: 'parent_email',
										render: (_: unknown, r: any) =>
											(r.parentEmail as string) ?? (r.parent_email as string) ?? '-',
									},
									{ title: '验证方式', dataIndex: 'method', key: 'method' },
									{
										title: '状态',
										dataIndex: 'status',
										key: 'status',
										render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
									},
									{
										title: '已验证',
										dataIndex: 'verified',
										key: 'verified',
										render: (v: boolean) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
									},
									{
										title: '记录时间',
										dataIndex: 'recordedAt',
										key: 'recorded_at',
										width: 180,
									},
								]}
								dataSource={consents}
								rowKey="id"
								loading={consentsLoading}
								pagination={{
									current: consentPage,
									pageSize: consentPageSize,
									total: consentTotal ?? consents.length,
									showSizeChanger: true,
									showTotal: (t) => `共 ${t} 条`,
									onChange: (p: number, ps: number) => {
										setConsentPage(p);
										setConsentPageSize(ps);
										loadConsents(p, ps);
									},
								}}
							/>
						),
					},
				]}
			/>
		</div>
	);
}
