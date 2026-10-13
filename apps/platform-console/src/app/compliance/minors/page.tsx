'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from '@autional/ui/antd';
import {
	Card,
	Form,
	InputNumber,
	Switch,
	Button,
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
	BadgeCheck,
	RefreshCw,
	Save,
	User,
} from 'lucide-react';
import { handleApiError } from '@/lib/error-handler';
import { message } from '@/lib/antd-app';
import { AuthService, fromPageResult, toPageParams, usePageTitle } from '@autional/shared';
import { useTranslation } from 'react-i18next';
import {
	adminTenantsMinorsProtectionByTenants,
	adminTenantsMinorsProtectionByTenantsPut,
	adminUsers,
	adminConsents,
} from '@autional/shared/generated/api';
import type { UpdateMinorsProtectionConfigRequest } from '@autional/shared/generated/types';
import { AppPageHeader, SectionCard } from '@autional/ui';
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
	live_stream_blocked_under_16?: boolean;
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

// 键映射 + 调用时求值（组件内渲染处用 t()）：未知值回退原始值，语义同旧版 MAP[s] || s
const AGE_GROUP_LABEL_KEYS: Record<string, string> = {
	'under-14': 'complianceMinors.age.under14',
	'14-16': 'complianceMinors.age.14to16',
	'16-18': 'complianceMinors.age.16to18',
	adult: 'complianceMinors.age.adult',
};

const STATUS_COLORS: Record<string, string> = {
	pending: 'orange',
	verified: 'green',
	expired: 'default',
	denied: 'red',
};

export default function MinorsProtectionPage() {
	const { t } = useTranslation();
	usePageTitle(t('complianceMinors.title', '未成年人保护'));
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

	// U412①：首屏 loading 早退期间 Form 尚未挂载，原 loadConfig 内的同步 setFieldsValue
	// 会触发「useForm 未挂载」告警；改为配置到位且表单挂载后再回填。
	useEffect(() => {
		if (!config || loading) return;
		form.setFieldsValue({
			daily_usage_limit_min: config.dailyUsageLimitMin,
			monthly_spend_limit: config.monthlySpendLimit,
			night_mode_enabled: config.nightModeEnabled,
			night_mode_start: config.nightModeStart
				? dayjs(config.nightModeStart, 'HH:mm')
				: dayjs('22:00', 'HH:mm'),
			night_mode_end: config.nightModeEnd
				? dayjs(config.nightModeEnd, 'HH:mm')
				: dayjs('06:00', 'HH:mm'),
			live_stream_blocked_under_16: config.liveStreamBlockedUnder16,
			content_filter_enabled: config.contentFilterEnabled,
			child_default_max_privacy: config.childDefaultMaxPrivacy,
			minor_data_retention_days: config.minorDataRetentionDays,
		});
	}, [config, loading, form]);

	const loadConfig = async () => {
		const tenantId = AuthService.getCurrentTenantId();
		if (!tenantId) {
			setConfigError(new Error(t('complianceMinors.missingTenantLoad')));
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
		} catch (err) {
			setConfig(null);
			setConfigError(err instanceof Error ? err : new Error(t('complianceMinors.loadConfigFailed')));
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
			setUsersError(err instanceof Error ? err : new Error(t('complianceMinors.loadUsersFailed')));
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
			setConsentsError(err instanceof Error ? err : new Error(t('complianceMinors.loadConsentsFailed')));
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
			message.error(t('complianceMinors.missingTenantSave'));
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
				liveStreamBlockedUnder16: values.live_stream_blocked_under_16,
				contentFilterEnabled: values.content_filter_enabled,
				childDefaultMaxPrivacy: values.child_default_max_privacy,
				minorDataRetentionDays: values.minor_data_retention_days,
			};
			if (values.night_mode_start) payload.nightModeStart = values.night_mode_start.format('HH:mm');
			if (values.night_mode_end) payload.nightModeEnd = values.night_mode_end.format('HH:mm');
			await adminTenantsMinorsProtectionByTenantsPut(tenantId, payload);
			message.success(t('complianceMinors.configUpdated'));
			loadConfig();
		} catch (err) {
			handleApiError(err, t('complianceMinors.saveConfigFailed'));
		} finally {
			setSaving(false);
		}
	};

	const userColumns = [
		{ title: t('complianceMinors.colUserId'), dataIndex: 'id', key: 'id', width: 200, ellipsis: true },
		{ title: t('complianceMinors.colEmail'), dataIndex: 'email', key: 'email' },
		{ title: t('complianceMinors.colPhone'), dataIndex: 'phone', key: 'phone' },
		{
			title: t('complianceMinors.colAgeGroup'),
			key: 'age_group',
			render: (_: unknown, r: any) => {
				const v = (r.ageGroup as string) ?? (r.age_group as string) ?? '';
				return (
					<Tag color={v === 'under-14' ? 'red' : v === '14-16' ? 'orange' : 'blue'}>
						{AGE_GROUP_LABEL_KEYS[v] ? t(AGE_GROUP_LABEL_KEYS[v]) : v}
					</Tag>
				);
			},
		},
		{
			title: t('complianceMinors.colParentalConsent'),
			key: 'pending_parental_consent',
			render: (_: unknown, r: any) => {
				const v = (r.pendingParentalConsent as boolean) ?? (r.pending_parental_consent as boolean);
				return v ? (
					<Tag color="orange">{t('complianceMinors.pendingVerification')}</Tag>
				) : (
					<Tag color="green">{t('complianceMinors.passed')}</Tag>
				);
			},
		},
		{ title: t('common.status'), dataIndex: 'status', key: 'status' },
		{
			title: t('complianceMinors.colCreatedAt'),
			key: 'created_at',
			width: 180,
			render: (_: unknown, r: any) =>
				(r.createdAt as string) ?? (r.created_at as string) ?? '-',
		},
	];

	if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

	return (
		<div style={{ padding: 24 }}>
			<AppPageHeader
				title={t('complianceMinors.title', '未成年人保护')}
				description={t('complianceMinors.description', '配置防沉迷策略、查看未成年用户、管理家长同意')}
			/>

			<Row gutter={16} style={{ marginBottom: 24 }}>
				<Col span={8}>
					<Card>
						<Statistic
							title={t('complianceMinors.statMinorUsers')}
							value={userTotal ?? '—'}
							prefix={<User size="1em" />}
						/>
					</Card>
				</Col>
				<Col span={8}>
					<Card>
						<Statistic
							title={t('complianceMinors.statDailyLimit')}
							value={config ? config.dailyUsageLimitMin : '—'}
							suffix={config ? t('complianceMinors.minutesUnit') : undefined}
						/>
					</Card>
				</Col>
				<Col span={8}>
					<Card>
						<Statistic
							title={t('complianceMinors.statNightMode')}
							value={
								config
									? config.nightModeEnabled
										? `${config.nightModeStart}-${config.nightModeEnd}`
										: t('complianceMinors.nightModeOff')
									: '—'
							}
							prefix={<BadgeCheck size="1em" />}
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
						label: t('complianceMinors.tabConfig'),
						children: configError ? (
							<ApiErrorState
								error={configError}
								title={t('complianceMinors.loadConfigFailed')}
								onRetry={loadConfig}
							/>
						) : (
							<>
								<SectionCard title={t('complianceMinors.sectionAntiAddiction')}>
									<Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
										<Form.Item
											name="daily_usage_limit_min"
											label={t('complianceMinors.dailyLimitLabel')}
											tooltip={t('complianceMinors.zeroUnlimited')}
										>
											<InputNumber min={0} max={1440} style={{ width: '100%' }} />
										</Form.Item>
										<Form.Item
											name="night_mode_enabled"
											label={t('complianceMinors.enableNightMode')}
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
														<Form.Item
															name="night_mode_start"
															label={t('complianceMinors.nightModeStart')}
														>
															<TimePicker format="HH:mm" />
														</Form.Item>
														<Form.Item
															name="night_mode_end"
															label={t('complianceMinors.nightModeEnd')}
														>
															<TimePicker format="HH:mm" />
														</Form.Item>
													</Space>
												) : null
											}
										</Form.Item>
									</Form>
								</SectionCard>

								<div style={{ marginTop: 16 }}>
									<SectionCard title={t('complianceMinors.sectionSpendLimits')}>
										<Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
											<Form.Item
												name="monthly_spend_limit"
												label={t('complianceMinors.monthlySpendLimit')}
												tooltip={t('complianceMinors.zeroUnlimited')}
											>
												<InputNumber min={0} style={{ width: '100%' }} />
											</Form.Item>
											<Form.Item
												name="live_stream_blocked_under_16"
												label={t('complianceMinors.blockLiveUnder16')}
												valuePropName="checked"
											>
												<Switch />
											</Form.Item>
											<Form.Item
												name="content_filter_enabled"
												label={t('complianceMinors.contentFilter')}
												valuePropName="checked"
											>
												<Switch />
											</Form.Item>
										</Form>
									</SectionCard>
								</div>

								<div style={{ marginTop: 16 }}>
									<SectionCard title={t('complianceMinors.sectionDataPrivacy')}>
										<Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
											<Form.Item
												name="child_default_max_privacy"
												label={t('complianceMinors.maxPrivacy')}
												valuePropName="checked"
											>
												<Switch />
											</Form.Item>
											<Form.Item
												name="minor_data_retention_days"
												label={t('complianceMinors.retentionDays')}
											>
												<InputNumber min={30} max={3650} style={{ width: '100%' }} />
											</Form.Item>
										</Form>
									</SectionCard>
								</div>

								<div style={{ marginTop: 24, textAlign: 'right' }}>
									<Button
										onClick={loadConfig}
										icon={<RefreshCw size="1em" />}
										style={{ marginRight: 8 }}
									>
										{t('common.reset')}
									</Button>
									<Popconfirm
										title={t('complianceMinors.confirmSaveTitle')}
										description={t('complianceMinors.confirmSaveDesc')}
										okText={t('complianceMinors.confirmSaveOk')}
										onConfirm={handleSave}
									>
										<Button
											type="primary"
											loading={saving}
											icon={<Save size="1em" />}
										>
											{t('complianceMinors.saveConfig')}
										</Button>
									</Popconfirm>
								</div>
							</>
						),
					},
					{
						key: 'users',
						label: t('complianceMinors.tabUsers', { n: userTotal ?? '—' }),
						children: usersError ? (
							<ApiErrorState
								error={usersError}
								title={t('complianceMinors.loadUsersFailed')}
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
									showTotal: (n) => t('complianceMinors.usersTotal', { n }),
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
						label: t('complianceMinors.tabConsents'),
						children: consentsError ? (
							<ApiErrorState
								error={consentsError}
								title={t('complianceMinors.loadConsentsFailed')}
								onRetry={() => loadConsents()}
							/>
						) : (
							<DataTable
								columns={[
									{
										title: t('complianceMinors.colUserId'),
										key: 'user_id',
										width: 200,
										ellipsis: true,
										render: (_: unknown, r: any) =>
											(r.userId as string) ?? (r.user_id as string) ?? '-',
									},
									{
										title: t('complianceMinors.colParentEmail'),
										key: 'parent_email',
										render: (_: unknown, r: any) =>
											(r.parentEmail as string) ?? (r.parent_email as string) ?? '-',
									},
									{ title: t('complianceMinors.colMethod'), dataIndex: 'method', key: 'method' },
									{
										title: t('common.status'),
										dataIndex: 'status',
										key: 'status',
										render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
									},
									{
										title: t('complianceMinors.colVerified'),
										dataIndex: 'verified',
										key: 'verified',
										render: (v: boolean) =>
											v ? <Tag color="green">{t('common.yes')}</Tag> : <Tag>{t('common.no')}</Tag>,
									},
									{
										title: t('complianceMinors.colRecordedAt'),
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
									showTotal: (n) => t('complianceMinors.consentsTotal', { n }),
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
