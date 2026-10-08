'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, Statistic, Tag, Badge, Input, Select, Row, Col, Tabs, Modal, Typography, Space, Button, Descriptions, Tooltip, Popconfirm } from 'antd';
import { message, modal } from '@/lib/antd-app';
import {
	SearchOutlined,
	EyeOutlined,
	SyncOutlined,
	StopOutlined,
	DeleteOutlined,
	CheckCircleOutlined,
	ClockCircleOutlined,
	ExclamationCircleOutlined,
	LockOutlined,
	KeyOutlined,
	ApiOutlined,
	GlobalOutlined,
	CodeOutlined,
	SafetyOutlined,
	CloudServerOutlined,
	LoadingOutlined,
	CopyOutlined,
} from '@ant-design/icons';
import { PageLoading, PageError, DataTable } from '@autional/ui/antd';
import { Alert, AppPageHeader } from '@autional/ui';
import {
	useSecretsInventoryOverview,
	useSecretsInventoryKV,
	useSecretsInventoryEncryptionKeys,
	useSecretsInventoryJwtKeys,
	useSecretsInventoryInfrastructure,
	useSecretsInventoryApiKeys,
	useSecretsInventoryOAuth,
	useRotateOAuthClientSecret,
	type SecretKVRecord,
	type EncryptionKeyRecord,
	type JwtKeyRecord,
	type InfrastructureRecord,
	type ApiKeySummaryRecord,
	type OAuthSecretRecord,
} from '@/hooks/use-secrets-inventory';
import { handleApiError } from '@/lib/error-handler';
import {
	useRotateSecret,
	useRevokeSecret,
	useDeleteSecret,
	useSecretVersionValue,
} from '@/hooks/use-secrets';

const { Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
	active: 'green',
	expired: 'orange',
	revoked: 'red',
	current: 'green',
	fallback: 'gold',
	rotated: 'blue',
};

export default function SystemSecretsInventoryPage() {
	const [activeTab, setActiveTab] = useState('overview');
	const [kvKeyword, setKvKeyword] = useState('');
	const [kvStatusFilter, setKvStatusFilter] = useState('all');
	const [kvExpandedRows, setKvExpandedRows] = useState<string[]>([]);
	const [revealModalVisible, setRevealModalVisible] = useState(false);
	const [revealTarget, setRevealTarget] = useState<SecretKVRecord | null>(null);
	const [revealReason, setRevealReason] = useState('');
	const [revealedValue, setRevealedValue] = useState<string | null>(null);
	const [revealing, setRevealing] = useState(false);
	const [apiKeysExpanded, setApiKeysExpanded] = useState<string[]>([]);
	const [rotateModalVisible, setRotateModalVisible] = useState(false);
	const [rotateTarget, setRotateTarget] = useState<SecretKVRecord | null>(null);
	const [rotateNewValue, setRotateNewValue] = useState('');
	const [oauthRotateTarget, setOauthRotateTarget] = useState<OAuthSecretRecord | null>(null);
	const [oauthNewSecret, setOauthNewSecret] = useState<string | null>(null);

	const {
		data: overview,
		isLoading: overviewLoading,
		error: overviewError,
		refetch: refetchOverview,
	} = useSecretsInventoryOverview();
	const {
		data: kvData = [],
		isLoading: kvLoading,
		error: kvError,
		refetch: refetchKv,
	} = useSecretsInventoryKV();
	const {
		data: encKeys = [],
		isLoading: encKeysLoading,
		error: encKeysError,
		refetch: refetchEncKeys,
	} = useSecretsInventoryEncryptionKeys();
	const {
		data: jwtKeys = [],
		isLoading: jwtLoading,
		error: jwtError,
		refetch: refetchJwt,
	} = useSecretsInventoryJwtKeys();
	const {
		data: infra = [],
		isLoading: infraLoading,
		error: infraError,
		refetch: refetchInfra,
	} = useSecretsInventoryInfrastructure();
	const {
		data: apiKeys = [],
		isLoading: apiKeysLoading,
		error: apiKeysError,
		refetch: refetchApiKeys,
	} = useSecretsInventoryApiKeys();
	const {
		data: oauth = [],
		isLoading: oauthLoading,
		error: oauthError,
		refetch: refetchOauth,
	} = useSecretsInventoryOAuth();

	const rotateMutation = useRotateSecret();
	const revokeMutation = useRevokeSecret();
	const deleteMutation = useDeleteSecret();
	const revealValueMutation = useSecretVersionValue();
	const rotateOAuthMutation = useRotateOAuthClientSecret();

	const filteredKv = useMemo(() => {
		let result = kvData;
		if (kvStatusFilter !== 'all') {
			result = result.filter((s) => s.status === kvStatusFilter);
		}
		if (kvKeyword) {
			const kw = kvKeyword.toLowerCase();
			result = result.filter(
				(s) => s.key.toLowerCase().includes(kw) || s.description.toLowerCase().includes(kw),
			);
		}
		return result;
	}, [kvData, kvStatusFilter, kvKeyword]);

	const handleRevealValue = (record: SecretKVRecord) => {
		setRevealTarget(record);
		setRevealReason('');
		setRevealedValue(null);
		setRevealModalVisible(true);
	};

	const handleConfirmReveal = useCallback(async () => {
		if (!revealTarget) return;
		if (!revealReason.trim()) {
			message.warning('请填写操作原因，以便审计。');
			return;
		}
		setRevealing(true);
		try {
			const result = await revealValueMutation.mutateAsync({
				key: revealTarget.key,
				version: revealTarget.version,
			});
			setRevealedValue(result?.value ?? '[值不可用]');
			setTimeout(() => {
				setRevealedValue(null);
				message.info('值的显示时间已结束。');
			}, 30000);
		} catch (err: any) {
			message.error(
				err?.response?.data?.message || err?.message || '获取密钥值失败',
			);
		} finally {
			setRevealing(false);
		}
	}, [revealTarget, revealReason, revealValueMutation]);

	const handleRotate = (record: SecretKVRecord) => {
		setRotateTarget(record);
		setRotateNewValue('');
		setRotateModalVisible(true);
	};

	const handleRevoke = useCallback(
		(record: SecretKVRecord) => {
			modal.confirm({
				title: `确认吊销「${record.key}」？`,
				content: '已吊销的密钥不能再用于新操作，现有调用方将失败。',
				okText: '吊销',
				okType: 'danger',
				onOk: async () => {
					try {
						await revokeMutation.mutateAsync(record.key);
						message.success(`已吊销 ${record.key}`);
						refetchKv();
					} catch (err: any) {
						message.error(
							err?.response?.data?.message || err?.message || `吊销 ${record.key} 失败`,
						);
					}
				},
			});
		},
		[revokeMutation, refetchKv],
	);

	const handleDelete = useCallback(
		(record: SecretKVRecord) => {
			modal.confirm({
				title: `确认删除「${record.key}」？`,
				content: '此操作不可撤销，所有版本将被永久删除。',
				okText: '删除',
				okType: 'danger',
				okButtonProps: { disabled: record.isSystem },
				onOk: async () => {
					try {
						await deleteMutation.mutateAsync(record.key);
						message.success(`已删除 ${record.key}`);
						refetchKv();
					} catch (err: any) {
						message.error(
							err?.response?.data?.message || err?.message || `删除 ${record.key} 失败`,
						);
					}
				},
			});
		},
		[deleteMutation, refetchKv],
	);

	const handleConfirmRotate = useCallback(async () => {
		if (!rotateTarget) return;
		if (!rotateNewValue.trim()) {
			message.warning('请填写新的密钥值。');
			return;
		}
		try {
			await rotateMutation.mutateAsync({
				key: rotateTarget.key,
				data: { value: rotateNewValue },
			});
			message.success(`已轮换 ${rotateTarget.key}`);
			setRotateModalVisible(false);
			setRotateTarget(null);
			setRotateNewValue('');
			refetchKv();
		} catch (err: any) {
			message.error(
				err?.response?.data?.message || err?.message || `轮换 ${rotateTarget.key} 失败`,
			);
		}
	}, [rotateTarget, rotateNewValue, rotateMutation, refetchKv]);

	// PL-63：OAuth 客户端密钥轮换（新密钥仅此一次返回；失败走统一错误处理）
	const handleRotateOAuth = useCallback(
		async (record: OAuthSecretRecord) => {
			setOauthRotateTarget(record);
			setOauthNewSecret(null);
			try {
				const result = await rotateOAuthMutation.mutateAsync(record.clientId);
				setOauthNewSecret(result?.newSecret ?? '');
				message.success('OAuth 客户端密钥已轮换，请立即保存新密钥');
			} catch (err) {
				handleApiError(err, `轮换 ${record.clientId} 密钥失败`);
			}
		},
		[rotateOAuthMutation],
	);

	const handleCopyOAuthSecret = useCallback(async () => {
		if (!oauthNewSecret) return;
		try {
			await navigator.clipboard.writeText(oauthNewSecret);
			message.success('已复制到剪贴板');
		} catch {
			message.error('复制失败，请手动选择并复制');
		}
	}, [oauthNewSecret]);

	const kvColumns = [
		{
			title: '键',
			dataIndex: 'key',
			key: 'key',
			render: (v: string) => (
				<code className="text-xs bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded">{v}</code>
			),
		},
		{
			title: '租户',
			dataIndex: 'tenantId',
			key: 'tenantId',
			width: 130,
			render: (v: string) => <Tag>{v}</Tag>,
		},
		{ title: '版本', dataIndex: 'version', key: 'version', width: 80, align: 'center' as const },
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (v: string) => (
				<Badge
					status={
						STATUS_COLORS[v] === 'green'
							? 'success'
							: STATUS_COLORS[v] === 'orange'
								? 'warning'
								: 'error'
					}
					text={v}
				/>
			),
		},
		{
			title: '过期时间',
			dataIndex: 'expires',
			key: 'expires',
			width: 130,
			render: (v: string | null) =>
				v ? new Date(v).toLocaleDateString() : <Text type="secondary">永不过期</Text>,
		},
		{
			title: '操作',
			key: 'actions',
			width: 260,
			render: (_: unknown, record: SecretKVRecord) => (
				<Space size="small">
					<Button
						type="link"
						size="small"
						icon={<EyeOutlined />}
						onClick={() => handleRevealValue(record)}
					>
						显示
					</Button>
					<Button
						type="link"
						size="small"
						icon={<SyncOutlined />}
						onClick={() => handleRotate(record)}
					>
						轮换
					</Button>
					<Button
						type="link"
						size="small"
						danger
						icon={<StopOutlined />}
						disabled={record.status === 'revoked'}
						onClick={() => handleRevoke(record)}
					>
						吊销
					</Button>
					<Tooltip title={record.isSystem ? '系统密钥不可删除' : ''}>
						<Button
							type="link"
							size="small"
							danger
							icon={<DeleteOutlined />}
							disabled={record.isSystem}
							onClick={() => handleDelete(record)}
						>
							删除
						</Button>
					</Tooltip>
				</Space>
			),
		},
	];

	const kvExpandedRender = (record: SecretKVRecord) => (
		<Descriptions bordered size="small" column={2} className="p-4">
			<Descriptions.Item label="描述">{record.description}</Descriptions.Item>
			<Descriptions.Item label="分类">{record.category}</Descriptions.Item>
			<Descriptions.Item label="创建时间">
				{record.created ? new Date(record.created).toLocaleString() : '—'}
			</Descriptions.Item>
			<Descriptions.Item label="最后修改">
				{record.lastModified ? new Date(record.lastModified).toLocaleString() : '—'}
			</Descriptions.Item>
			<Descriptions.Item label="系统密钥">
				{record.isSystem ? <Tag color="red">是</Tag> : '否'}
			</Descriptions.Item>
			<Descriptions.Item label="版本历史">
				<Button type="link" size="small">
					查看 {record.version} 个版本
				</Button>
			</Descriptions.Item>
		</Descriptions>
	);

	const encKeyColumns = [
		{
			title: '密钥 ID',
			dataIndex: 'keyId',
			key: 'keyId',
			render: (v: string) => (
				<code className="text-xs bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded">{v}</code>
			),
		},
		{ title: '算法', dataIndex: 'algorithm', key: 'algorithm' },
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
		},
		{
			title: '使用服务',
			dataIndex: 'servicesUsing',
			key: 'servicesUsing',
			render: (v: string[]) =>
				v.length > 0 ? (
					v.map((s) => (
						<Tag key={s} color="blue">
							{s}
						</Tag>
					))
				) : (
					<Text type="secondary">无</Text>
				),
		},
	];

	const jwtKeyColumns = [
		{ title: '密钥名称', dataIndex: 'keyName', key: 'keyName' },
		{ title: '算法', dataIndex: 'algorithm', key: 'algorithm', width: 100 },
		{
			title: '密钥 ID',
			dataIndex: 'keyId',
			key: 'keyId',
			render: (v: string) => <code className="text-xs">{v}</code>,
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
		},
		{
			title: '上次轮换',
			dataIndex: 'lastRotated',
			key: 'lastRotated',
			render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
		},
		{
			title: '备注',
			dataIndex: 'inMemoryOnly',
			key: 'inMemoryOnly',
			width: 200,
			render: (v: boolean) =>
				v ? (
					<Tag icon={<LockOutlined />} color="processing">
						仅存于内存（RSA 2048）
					</Tag>
				) : null,
		},
	];

	const infraColumns = [
		{
			title: '凭证名称',
			dataIndex: 'credentialName',
			key: 'credentialName',
			render: (v: string) => (
				<code className="text-xs bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded">{v}</code>
			),
		},
		{
			title: '位置',
			dataIndex: 'location',
			key: 'location',
			render: (v: string) => <Tag color="default">{v}</Tag>,
		},
		{
			title: '类型',
			dataIndex: 'type',
			key: 'type',
			width: 100,
			render: (v: string) => {
				const iconMap: Record<string, React.ReactNode> = {
					DB: <CodeOutlined />,
					Redis: <CodeOutlined />,
					MQ: <ApiOutlined />,
					MinIO: <CloudServerOutlined />,
					API: <GlobalOutlined />,
				};
				return <Tag icon={iconMap[v]}>{v}</Tag>;
			},
		},
		{
			title: '由密钥服务托管',
			dataIndex: 'managedBySecretService',
			key: 'managedBySecretService',
			width: 180,
			render: (v: boolean) =>
				v ? (
					<Tag icon={<CheckCircleOutlined />} color="success">
						是
					</Tag>
				) : (
					<Tag icon={<ExclamationCircleOutlined />} color="warning">
						否
					</Tag>
				),
		},
	];

	const apiKeyColumns = [
		{
			title: '前缀',
			dataIndex: 'prefix',
			key: 'prefix',
			render: (v: string) => <code className="text-xs">{v}</code>,
		},
		{
			title: '租户',
			dataIndex: 'tenantId',
			key: 'tenantId',
			render: (v: string) => <Tag>{v}</Tag>,
		},
		{
			title: '类型',
			dataIndex: 'type',
			key: 'type',
			width: 90,
			render: (v: string) => (
				<Tag color={v === 'system' ? 'purple' : v === 'service' ? 'blue' : 'default'}>{v}</Tag>
			),
		},
		{
			title: '创建时间',
			dataIndex: 'created',
			key: 'created',
			render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (v: string) => (
				<Badge
					status={
						STATUS_COLORS[v] === 'green'
							? 'success'
							: STATUS_COLORS[v] === 'orange'
								? 'warning'
								: 'error'
					}
					text={v}
				/>
			),
		},
	];

	const apiKeyExpandedRender = (record: ApiKeySummaryRecord) => (
		<Descriptions bordered size="small" column={2} className="p-4">
			<Descriptions.Item label="最后使用">
				{record.lastUsed ? new Date(record.lastUsed).toLocaleString() : '-'}
			</Descriptions.Item>
			<Descriptions.Item label="授权范围">
				{record.scopes.map((s) => (
					<Tag key={s}>{s}</Tag>
				))}
			</Descriptions.Item>
		</Descriptions>
	);

	const oauthColumns = [
		{ title: '提供方', dataIndex: 'provider', key: 'provider' },
		{
			title: '客户端 ID',
			dataIndex: 'clientId',
			key: 'clientId',
			render: (v: string) => (
				<Space>
					<code className="text-xs bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded max-w-[200px] truncate inline-block">
						{v}
					</code>
					<LockOutlined className="text-neutral-500" />
				</Space>
			),
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
		},
		{
			title: '最后使用',
			dataIndex: 'lastUsed',
			key: 'lastUsed',
			render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
		},
		{
			title: '操作',
			key: 'actions',
			width: 140,
			render: (_: unknown, record: OAuthSecretRecord) => (
				<Popconfirm
					title={`确认轮换「${record.clientId}」的密钥？`}
					description="旧密钥立即失效（历史密钥 4 小时内仍可用于校验）；新密钥仅显示一次，请立即保存。"
					okText="确认轮换"
					okButtonProps={{ danger: true }}
					onConfirm={() => handleRotateOAuth(record)}
				>
					<Button
						type="link"
						size="small"
						icon={<SyncOutlined />}
						loading={rotateOAuthMutation.isPending}
					>
						轮换密钥
					</Button>
				</Popconfirm>
			),
		},
	];

	const tabItems = [
		{
			key: 'overview',
			label: (
				<span>
					<CheckCircleOutlined /> 概览
				</span>
			),
			children: (
				<OverviewTab
					overview={overview}
					loading={overviewLoading}
					error={overviewError}
					retry={refetchOverview}
				/>
			),
		},
		{
			key: 'kv',
			label: (
				<span>
					<KeyOutlined /> 密钥 KV（{kvData.length}）
				</span>
			),
			children: (
				<div>
					{kvError && (
						<PageError message="加载密钥 KV 数据失败" retry={refetchKv} className="mb-4" />
					)}
					<div className="flex gap-4 mb-4 flex-wrap">
						<Input.Search
							placeholder="搜索密钥…"
							allowClear
							value={kvKeyword}
							onChange={(e) => setKvKeyword(e.target.value)}
							className="max-w-md"
							prefix={<SearchOutlined />}
						/>
						<Select
							value={kvStatusFilter}
							onChange={setKvStatusFilter}
							className="w-36"
							options={[
								{ label: '全部', value: 'all' },
								{ label: '活跃', value: 'active' },
								{ label: '已过期', value: 'expired' },
								{ label: '已吊销', value: 'revoked' },
							]}
						/>
					</div>
					<DataTable
						rowKey="key"
						columns={kvColumns}
						dataSource={filteredKv}
						loading={kvLoading}
						pagination={{ pageSize: 15 }}
						expandable={{
							expandedRowRender: kvExpandedRender,
							expandedRowKeys: kvExpandedRows,
							onExpandedRowsChange: (keys) => setKvExpandedRows(keys as string[]),
						}}
					/>
				</div>
			),
		},
		{
			key: 'encryption-keys',
			label: (
				<span>
					<SafetyOutlined /> 加密密钥（{encKeys.length}）
				</span>
			),
			children: (
				<div>
					{encKeysError && (
						<PageError
							message="加载加密密钥失败"
							retry={refetchEncKeys}
							className="mb-4"
						/>
					)}
					<Alert
						variant="info"
						title="密钥值仅通过环境变量管理"
						className="mb-4"
					 />
					<DataTable
						rowKey="keyId"
						columns={encKeyColumns}
						dataSource={encKeys}
						loading={encKeysLoading}
						pagination={false}
					/>
				</div>
			),
		},
		{
			key: 'jwt-keys',
			label: (
				<span>
					<LockOutlined /> JWT 密钥（{jwtKeys.length}）
				</span>
			),
			children: (
				<div>
					{jwtError && (
						<PageError message="加载 JWT 密钥失败" retry={refetchJwt} className="mb-4" />
					)}
					<Alert
						variant="info"
						title="JWT 私钥仅保存在内存中，公钥通过 JWKS 端点分发。"
						className="mb-4"
					 />
					<DataTable
						rowKey="keyId"
						columns={jwtKeyColumns}
						dataSource={jwtKeys}
						loading={jwtLoading}
						pagination={false}
					/>
				</div>
			),
		},
		{
			key: 'infrastructure',
			label: (
				<span>
					<CloudServerOutlined /> 基础设施（{infra.length}）
				</span>
			),
			children: (
				<div>
					{infraError && (
						<PageError
							message="加载基础设施数据失败"
							retry={refetchInfra}
							className="mb-4"
						/>
					)}
					<Alert
						variant="warning"
						title="这些凭证在密钥服务之外管理，建议迁移。"
						className="mb-4"
					 />
					<DataTable
						rowKey="credentialName"
						columns={infraColumns}
						dataSource={infra}
						loading={infraLoading}
						pagination={{ pageSize: 20 }}
					/>
				</div>
			),
		},
		{
			key: 'api-keys',
			label: (
				<span>
					<ApiOutlined /> API 密钥（{apiKeys.length}）
				</span>
			),
			children: (
				<div>
					{apiKeysError && (
						<PageError message="加载 API 密钥失败" retry={refetchApiKeys} className="mb-4" />
					)}
					<DataTable
						rowKey="prefix"
						columns={apiKeyColumns}
						dataSource={apiKeys}
						loading={apiKeysLoading}
						pagination={{ pageSize: 15 }}
						expandable={{
							expandedRowRender: apiKeyExpandedRender,
							expandedRowKeys: apiKeysExpanded,
							onExpandedRowsChange: (keys) => setApiKeysExpanded(keys as string[]),
						}}
					/>
				</div>
			),
		},
		{
			key: 'oauth',
			label: (
				<span>
					<GlobalOutlined /> OAuth（{oauth.length}）
				</span>
			),
			children: (
				<div>
					{oauthError && (
						<PageError
							message="加载 OAuth 密钥失败"
							retry={refetchOauth}
							className="mb-4"
						/>
					)}
					<Alert
						variant="info"
						title="密钥值已脱敏、不在列表展示；如需更换密钥，可在下方「轮换密钥」直接操作（新密钥仅显示一次）。"
						className="mb-4"
					 />
					<DataTable
						rowKey="clientId"
						columns={oauthColumns}
						dataSource={oauth}
						loading={oauthLoading}
						pagination={false}
					/>
				</div>
			),
		},
	];

	return (
		<div>
			<AppPageHeader
				title="密钥清单"
				description="平台级密钥总览与管理"
			/>

			{overviewLoading ? (
				<PageLoading tip="正在加载密钥清单…" />
			) : (
				<Tabs
					activeKey={activeTab}
					onChange={setActiveTab}
					items={tabItems}
					size="large"
					className="secrets-inventory-tabs"
				/>
			)}

			<Modal
				title={`显示值 — ${revealTarget?.key ?? ''}`}
				open={revealModalVisible}
				onCancel={() => {
					setRevealModalVisible(false);
					setRevealTarget(null);
					setRevealedValue(null);
				}}
				footer={
					revealedValue ? (
						<Button
							onClick={() => {
								setRevealModalVisible(false);
								setRevealTarget(null);
								setRevealedValue(null);
							}}
						>
							关闭
						</Button>
					) : null
				}
				destroyOnHidden
				width={560}
			>
				{!revealedValue ? (
					<div>
						<Alert
							variant="warning"
							title="此操作将被审计，请填写原因。"
							className="mb-4"
						 />
						<Input.TextArea
							placeholder="查看密钥值的原因…"
							value={revealReason}
							onChange={(e) => setRevealReason(e.target.value)}
							rows={3}
							className="mb-4"
						/>
						<Button
							type="primary"
							danger
							icon={<EyeOutlined />}
							onClick={handleConfirmReveal}
							loading={revealing}
						>
							显示值（记录审计）
						</Button>
					</div>
				) : (
					<div>
						<Alert
							variant="success"
							title="值已显示，将在 30 秒后自动隐藏。"
							className="mb-4"
						 />
						<Input.TextArea value={revealedValue} readOnly rows={4} className="font-mono" />
						<div className="mt-2 text-right">
							<Text type="secondary">
								<ClockCircleOutlined className="mr-1" />
								30 秒后自动隐藏
							</Text>
						</div>
					</div>
				)}
			</Modal>

			<Modal
				title={`轮换密钥 — ${rotateTarget?.key ?? ''}`}
				open={rotateModalVisible}
				onCancel={() => {
					setRotateModalVisible(false);
					setRotateTarget(null);
					setRotateNewValue('');
				}}
				footer={null}
				destroyOnHidden
				width={560}
			>
				<Alert
					variant="info"
					title="这将创建该密钥的新版本；现有引用仍可继续使用当前版本。"
					className="mb-4"
				 />
				<Input.TextArea
					placeholder="请输入新的密钥值…"
					value={rotateNewValue}
					onChange={(e) => setRotateNewValue(e.target.value)}
					rows={4}
					className="mb-4 font-mono"
				/>
				<Space>
					<Button
						type="primary"
						icon={<SyncOutlined />}
						onClick={handleConfirmRotate}
						loading={rotateMutation.isPending}
					>
						轮换
					</Button>
					<Button
						onClick={() => {
							setRotateModalVisible(false);
							setRotateTarget(null);
							setRotateNewValue('');
						}}
					>
						取消
					</Button>
				</Space>
			</Modal>

			<Modal
				title={`OAuth 密钥已轮换 — ${oauthRotateTarget?.clientId ?? ''}`}
				open={oauthNewSecret !== null}
				onCancel={() => {
					setOauthNewSecret(null);
					setOauthRotateTarget(null);
				}}
				footer={
					<Button
						onClick={() => {
							setOauthNewSecret(null);
							setOauthRotateTarget(null);
						}}
					>
						关闭
					</Button>
				}
				destroyOnHidden
				width={560}
			>
				<Alert
					variant="warning"
					title="旧密钥已立即失效（历史密钥 4 小时内仍可用于校验）；新密钥仅显示一次，请立即复制并妥善保存。"
					className="mb-4"
				 />
				<Input.TextArea value={oauthNewSecret ?? ''} readOnly rows={3} className="font-mono" />
				<div className="mt-3 text-right">
					<Button type="primary" icon={<CopyOutlined />} onClick={handleCopyOAuthSecret}>
						复制新密钥
					</Button>
				</div>
			</Modal>
		</div>
	);
}

function OverviewTab({
	overview,
	loading,
	error,
	retry,
}: {
	overview: ReturnType<typeof useSecretsInventoryOverview>['data'] | undefined;
	loading: boolean;
	error: Error | null;
	retry: () => void;
}) {
	if (error) return <PageError message="加载总览失败" retry={retry} />;
	if (!overview) return <PageLoading />;

	const statusColors: Record<string, string> = {
		active: 'green',
		expired: 'orange',
		revoked: 'red',
	};

	return (
		<div>
			<Row gutter={[16, 16]} className="mb-6">
				<Col xs={24} sm={12} md={6}>
					<Card hoverable>
						<Statistic
							title="密钥总数"
							value={overview.totalSecrets}
							prefix={<KeyOutlined />}
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} md={6}>
					<Card hoverable styles={{ body: { borderLeft: '3px solid var(--color-success)' } }}>
						<Statistic
							title="活跃"
							value={overview.activeCount}
							valueStyle={{ color: 'var(--color-success)' }}
							prefix={<CheckCircleOutlined />}
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} md={6}>
					<Card hoverable styles={{ body: { borderLeft: '3px solid var(--color-warning)' } }}>
						<Statistic
							title="已过期"
							value={overview.expiredCount}
							valueStyle={{ color: 'var(--color-warning)' }}
							prefix={<ClockCircleOutlined />}
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} md={6}>
					<Card hoverable styles={{ body: { borderLeft: '3px solid var(--color-danger)' } }}>
						<Statistic
							title="已吊销"
							value={overview.revokedCount}
							valueStyle={{ color: 'var(--color-danger)' }}
							prefix={<StopOutlined />}
						/>
					</Card>
				</Col>
			</Row>

			<Card title="分类分布" className="mb-6">
				<Row gutter={[16, 16]}>
					{Object.entries(overview.categoryBreakdown).map(([cat, count]) => (
						<Col xs={24} sm={12} md={8} key={cat}>
							<Card size="small" hoverable>
								<div className="flex items-center justify-between">
									<div>
										<Text strong className="capitalize">
											{cat === 'kv'
												? '密钥 KV'
												: cat === 'encryptionKeys'
													? '加密密钥'
													: cat === 'jwtKeys'
														? 'JWT 密钥'
														: cat === 'infrastructure'
															? '基础设施'
															: cat === 'apiKeys'
																? 'API 密钥'
																: 'OAuth'}
										</Text>
										<div className="mt-1">
											<Text type="secondary" className="text-sm">
												{((count / overview.totalSecrets) * 100).toFixed(1)}%（占总数）
											</Text>
										</div>
									</div>
									<Statistic value={count} valueStyle={{ fontSize: 24 }} />
								</div>
							</Card>
						</Col>
					))}
				</Row>
			</Card>

			<Alert
				variant="info"
				title="安全配置检测未接入"
				className="mb-4"
			>
				"PASSWORD_PEPPER 与 HIBP 的启用状态暂无平台侧数据源；接入后将在此展示。"
			</Alert>
		</div>
	);
}
