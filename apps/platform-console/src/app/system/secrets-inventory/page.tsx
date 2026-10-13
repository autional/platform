'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, Statistic, Tag, Badge, Input, Select, Row, Col, Tabs, Typography, Space, Button, Descriptions, Tooltip, Popconfirm } from 'antd';
import { message, modal } from '@/lib/antd-app';
import {
	AlertCircle,
	Ban,
	CheckCircle2,
	Clock,
	Cloud,
	Code,
	Copy,
	Eye,
	Globe,
	KeyRound,
	Lock,
	Plug,
	RefreshCw,
	Search,
	ShieldCheck,
	Trash2,
} from 'lucide-react';
import { PageLoading, PageError, DataTable, Modal } from '@autional/ui/antd';
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
import { ApiErrorState } from '@/components/ApiErrorState';
import { usePageTitle } from '@autional/shared';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation();
	usePageTitle(t('secretsInventory.title', '密钥清单'));
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
			message.warning(t('secretsInventory.reasonRequired', '请填写操作原因，以便审计。'));
			return;
		}
		setRevealing(true);
		try {
			const result = await revealValueMutation.mutateAsync({
				key: revealTarget.key,
				version: revealTarget.version,
			});
			setRevealedValue(result?.value ?? t('secretsInventory.valueUnavailable', '[值不可用]'));
			setTimeout(() => {
				setRevealedValue(null);
				message.info(t('secretsInventory.revealExpired', '值的显示时间已结束。'));
			}, 30000);
		} catch (err: any) {
			message.error(
				err?.response?.data?.message || err?.message || t('secretsInventory.revealFailed', '获取密钥值失败'),
			);
		} finally {
			setRevealing(false);
		}
	}, [revealTarget, revealReason, revealValueMutation, t]);

	const handleRotate = (record: SecretKVRecord) => {
		setRotateTarget(record);
		setRotateNewValue('');
		setRotateModalVisible(true);
	};

	const handleRevoke = useCallback(
		(record: SecretKVRecord) => {
			modal.confirm({
				title: t('secretsInventory.revokeConfirmTitle', { name: record.key }),
				content: t('secretsInventory.revokeConfirmContent'),
				okText: t('secretsInventory.actionRevoke', '吊销'),
				okType: 'danger',
				onOk: async () => {
					try {
						await revokeMutation.mutateAsync(record.key);
						message.success(t('secretsInventory.revokedSuccess', { name: record.key }));
						refetchKv();
					} catch (err: any) {
						message.error(
							err?.response?.data?.message || err?.message || t('secretsInventory.revokeFailed', { name: record.key }),
						);
					}
				},
			});
		},
		[revokeMutation, refetchKv, t],
	);

	const handleDelete = useCallback(
		(record: SecretKVRecord) => {
			modal.confirm({
				title: t('secretsInventory.deleteConfirmTitle', { name: record.key }),
				content: t('secretsInventory.deleteConfirmContent'),
				okText: t('common.delete', '删除'),
				okType: 'danger',
				okButtonProps: { disabled: record.isSystem },
				onOk: async () => {
					try {
						await deleteMutation.mutateAsync(record.key);
						message.success(t('secretsInventory.deletedSuccess', { name: record.key }));
						refetchKv();
					} catch (err: any) {
						message.error(
							err?.response?.data?.message || err?.message || t('secretsInventory.deleteFailed', { name: record.key }),
						);
					}
				},
			});
		},
		[deleteMutation, refetchKv, t],
	);

	const handleConfirmRotate = useCallback(async () => {
		if (!rotateTarget) return;
		if (!rotateNewValue.trim()) {
			message.warning(t('secretsInventory.newValueRequired', '请填写新的密钥值。'));
			return;
		}
		try {
			await rotateMutation.mutateAsync({
				key: rotateTarget.key,
				data: { value: rotateNewValue },
			});
			message.success(t('secretsInventory.rotatedSuccess', { name: rotateTarget.key }));
			setRotateModalVisible(false);
			setRotateTarget(null);
			setRotateNewValue('');
			refetchKv();
		} catch (err: any) {
			message.error(
				err?.response?.data?.message || err?.message || t('secretsInventory.rotateFailed', { name: rotateTarget.key }),
			);
		}
	}, [rotateTarget, rotateNewValue, rotateMutation, refetchKv, t]);

	// PL-63：OAuth 客户端密钥轮换（新密钥仅此一次返回；失败走统一错误处理）
	const handleRotateOAuth = useCallback(
		async (record: OAuthSecretRecord) => {
			setOauthRotateTarget(record);
			setOauthNewSecret(null);
			try {
				const result = await rotateOAuthMutation.mutateAsync(record.clientId);
				setOauthNewSecret(result?.newSecret ?? '');
				message.success(t('secretsInventory.oauthRotatedSuccess', 'OAuth 客户端密钥已轮换，请立即保存新密钥'));
			} catch (err) {
				handleApiError(err, t('secretsInventory.oauthRotateFailed', { id: record.clientId }));
			}
		},
		[rotateOAuthMutation, t],
	);

	const handleCopyOAuthSecret = useCallback(async () => {
		if (!oauthNewSecret) return;
		try {
			await navigator.clipboard.writeText(oauthNewSecret);
			message.success(t('secretsInventory.copiedToClipboard', '已复制到剪贴板'));
		} catch {
			message.error(t('secretsInventory.copyFailed', '复制失败，请手动选择并复制'));
		}
	}, [oauthNewSecret, t]);

	const kvColumns = [
		{
			title: t('secretsInventory.colKey', '键'),
			dataIndex: 'key',
			key: 'key',
			render: (v: string) => (
				<code className="text-xs bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded-xs">{v}</code>
			),
		},
		{
			title: t('secretsInventory.colTenant', '租户'),
			dataIndex: 'tenantId',
			key: 'tenantId',
			width: 130,
			render: (v: string) => <Tag>{v}</Tag>,
		},
		{ title: t('secretsInventory.colVersion', '版本'), dataIndex: 'version', key: 'version', width: 80, align: 'center' as const },
		{
			title: t('common.status', '状态'),
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
			title: t('secretsInventory.colExpires', '过期时间'),
			dataIndex: 'expires',
			key: 'expires',
			width: 130,
			render: (v: string | null) =>
				v ? new Date(v).toLocaleDateString() : <Text type="secondary">{t('secretsInventory.neverExpires', '永不过期')}</Text>,
		},
		{
			title: t('common.actions', '操作'),
			key: 'actions',
			width: 260,
			render: (_: unknown, record: SecretKVRecord) => (
				<Space size="small">
					<Button
						type="link"
						size="small"
						icon={<Eye size="1em" />}
						onClick={() => handleRevealValue(record)}
					>
						{t('secretsInventory.actionReveal', '显示')}
					</Button>
					<Button
						type="link"
						size="small"
						icon={<RefreshCw size="1em" />}
						onClick={() => handleRotate(record)}
					>
						{t('secretsInventory.actionRotate', '轮换')}
					</Button>
					<Button
						type="link"
						size="small"
						danger
						icon={<Ban size="1em" />}
						disabled={record.status === 'revoked'}
						onClick={() => handleRevoke(record)}
					>
						{t('secretsInventory.actionRevoke', '吊销')}
					</Button>
					<Tooltip title={record.isSystem ? t('secretsInventory.systemKeyNotDeletable', '系统密钥不可删除') : ''}>
						<Button
							type="link"
							size="small"
							danger
							icon={<Trash2 size="1em" />}
							disabled={record.isSystem}
							onClick={() => handleDelete(record)}
						>
							{t('common.delete', '删除')}
						</Button>
					</Tooltip>
				</Space>
			),
		},
	];

	const kvExpandedRender = (record: SecretKVRecord) => (
		<Descriptions bordered size="small" column={2} className="p-4">
			<Descriptions.Item label={t('secretsInventory.detailDescription', '描述')}>{record.description}</Descriptions.Item>
			<Descriptions.Item label={t('secretsInventory.detailCategory', '分类')}>{record.category}</Descriptions.Item>
			<Descriptions.Item label={t('secretsInventory.colCreated', '创建时间')}>
				{record.created ? new Date(record.created).toLocaleString() : '—'}
			</Descriptions.Item>
			<Descriptions.Item label={t('secretsInventory.detailLastModified', '最后修改')}>
				{record.lastModified ? new Date(record.lastModified).toLocaleString() : '—'}
			</Descriptions.Item>
			<Descriptions.Item label={t('secretsInventory.detailIsSystem', '系统密钥')}>
				{record.isSystem ? <Tag color="red">{t('common.yes', '是')}</Tag> : t('common.no', '否')}
			</Descriptions.Item>
			<Descriptions.Item label={t('secretsInventory.detailVersionHistory', '版本历史')}>
				<Button type="link" size="small">
					{t('secretsInventory.viewVersions', { n: record.version })}
				</Button>
			</Descriptions.Item>
		</Descriptions>
	);

	const encKeyColumns = [
		{
			title: t('secretsInventory.colKeyId', '密钥 ID'),
			dataIndex: 'keyId',
			key: 'keyId',
			render: (v: string) => (
				<code className="text-xs bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded-xs">{v}</code>
			),
		},
		{ title: t('secretsInventory.colAlgorithm', '算法'), dataIndex: 'algorithm', key: 'algorithm' },
		{
			title: t('common.status', '状态'),
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
		},
		{
			title: t('secretsInventory.colServicesUsing', '使用服务'),
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
					<Text type="secondary">{t('secretsInventory.none', '无')}</Text>
				),
		},
	];

	const jwtKeyColumns = [
		{ title: t('secretsInventory.colKeyName', '密钥名称'), dataIndex: 'keyName', key: 'keyName' },
		{ title: t('secretsInventory.colAlgorithm', '算法'), dataIndex: 'algorithm', key: 'algorithm', width: 100 },
		{
			title: t('secretsInventory.colKeyId', '密钥 ID'),
			dataIndex: 'keyId',
			key: 'keyId',
			render: (v: string) => <code className="text-xs">{v}</code>,
		},
		{
			title: t('common.status', '状态'),
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
		},
		{
			title: t('secretsInventory.colLastRotated', '上次轮换'),
			dataIndex: 'lastRotated',
			key: 'lastRotated',
			render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
		},
		{
			title: t('secretsInventory.colNote', '备注'),
			dataIndex: 'inMemoryOnly',
			key: 'inMemoryOnly',
			width: 200,
			render: (v: boolean) =>
				v ? (
					<Tag icon={<Lock size="1em" />} color="processing">
						{t('secretsInventory.inMemoryOnly', '仅存于内存（RSA 2048）')}
					</Tag>
				) : null,
		},
	];

	const infraColumns = [
		{
			title: t('secretsInventory.colCredentialName', '凭证名称'),
			dataIndex: 'credentialName',
			key: 'credentialName',
			render: (v: string) => (
				<code className="text-xs bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded-xs">{v}</code>
			),
		},
		{
			title: t('secretsInventory.colLocation', '位置'),
			dataIndex: 'location',
			key: 'location',
			render: (v: string) => <Tag color="default">{v}</Tag>,
		},
		{
			title: t('secretsInventory.colType', '类型'),
			dataIndex: 'type',
			key: 'type',
			width: 100,
			render: (v: string) => {
				const iconMap: Record<string, React.ReactNode> = {
					DB: <Code size="1em" />,
					Redis: <Code size="1em" />,
					MQ: <Plug size="1em" />,
					MinIO: <Cloud size="1em" />,
					API: <Globe size="1em" />,
				};
				return <Tag icon={iconMap[v]}>{v}</Tag>;
			},
		},
		{
			title: t('secretsInventory.colManagedBySecretService', '由密钥服务托管'),
			dataIndex: 'managedBySecretService',
			key: 'managedBySecretService',
			width: 180,
			render: (v: boolean) =>
				v ? (
					<Tag icon={<CheckCircle2 size="1em" />} color="success">
						{t('common.yes', '是')}
					</Tag>
				) : (
					<Tag icon={<AlertCircle size="1em" />} color="warning">
						{t('common.no', '否')}
					</Tag>
				),
		},
	];

	const apiKeyColumns = [
		{
			title: t('secretsInventory.colPrefix', '前缀'),
			dataIndex: 'prefix',
			key: 'prefix',
			render: (v: string) => (v ? <code className="text-xs">{v}</code> : '—'),
		},
		{
			title: t('secretsInventory.colTenant', '租户'),
			dataIndex: 'tenantId',
			key: 'tenantId',
			render: (v: string) => <Tag>{v}</Tag>,
		},
		{
			title: t('secretsInventory.colType', '类型'),
			dataIndex: 'type',
			key: 'type',
			width: 90,
			render: (v: string) => (
				<Tag color={v === 'system' ? 'purple' : v === 'service' ? 'blue' : 'default'}>{v}</Tag>
			),
		},
		{
			title: t('secretsInventory.colCreated', '创建时间'),
			dataIndex: 'created',
			key: 'created',
			render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
		},
		{
			title: t('common.status', '状态'),
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
			<Descriptions.Item label={t('secretsInventory.colLastUsed', '最后使用')}>
				{record.lastUsed ? new Date(record.lastUsed).toLocaleString() : '-'}
			</Descriptions.Item>
			<Descriptions.Item label={t('secretsInventory.detailScopes', '授权范围')}>
				{record.scopes.map((s) => (
					<Tag key={s}>{s}</Tag>
				))}
			</Descriptions.Item>
		</Descriptions>
	);

	const oauthColumns = [
		{ title: t('secretsInventory.colProvider', '提供方'), dataIndex: 'provider', key: 'provider' },
		{
			title: t('secretsInventory.colClientId', '客户端 ID'),
			dataIndex: 'clientId',
			key: 'clientId',
			render: (v: string) => (
				<Space>
					<code className="text-xs bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded-xs max-w-[200px] truncate inline-block">
						{v}
					</code>
					<Lock size="1em" className="text-neutral-500" />
				</Space>
			),
		},
		{
			title: t('common.status', '状态'),
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
		},
		{
			title: t('secretsInventory.colLastUsed', '最后使用'),
			dataIndex: 'lastUsed',
			key: 'lastUsed',
			render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
		},
		{
			title: t('common.actions', '操作'),
			key: 'actions',
			width: 140,
			render: (_: unknown, record: OAuthSecretRecord) => (
				<Popconfirm
					title={t('secretsInventory.oauthRotateConfirmTitle', { id: record.clientId })}
					description={t('secretsInventory.oauthRotateConfirmDesc')}
					okText={t('secretsInventory.oauthRotateConfirmOk', '确认轮换')}
					okButtonProps={{ danger: true }}
					onConfirm={() => handleRotateOAuth(record)}
				>
					<Button
						type="link"
						size="small"
						icon={<RefreshCw size="1em" />}
						loading={rotateOAuthMutation.isPending}
					>
						{t('secretsInventory.rotateKeyButton', '轮换密钥')}
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
					<CheckCircle2 size="1em" /> {t('secretsInventory.tabOverview', '概览')}
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
					<KeyRound size="1em" /> {t('secretsInventory.tabKv', { n: kvData.length })}
				</span>
			),
			children: (
				<div>
					{kvError && (
						<PageError message={t('secretsInventory.kvLoadError', '加载密钥 KV 数据失败')} retry={refetchKv} className="mb-4" />
					)}
					<div className="flex gap-4 mb-4 flex-wrap">
						<Input.Search
							placeholder={t('secretsInventory.searchPlaceholder', '搜索密钥…')}
							allowClear
							value={kvKeyword}
							onChange={(e) => setKvKeyword(e.target.value)}
							className="max-w-md"
							prefix={<Search size="1em" />}
						/>
						<Select
							value={kvStatusFilter}
							onChange={setKvStatusFilter}
							className="w-36"
							options={[
								{ label: t('secretsInventory.filterAll', '全部'), value: 'all' },
								{ label: t('secretsInventory.active', '活跃'), value: 'active' },
								{ label: t('secretsInventory.expired', '已过期'), value: 'expired' },
								{ label: t('secretsInventory.revoked', '已吊销'), value: 'revoked' },
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
					<ShieldCheck size="1em" /> {t('secretsInventory.tabEncryptionKeys', { n: encKeys.length })}
				</span>
			),
			children: (
				<div>
					{encKeysError && (
						<PageError
							message={t('secretsInventory.encKeysLoadError', '加载加密密钥失败')}
							retry={refetchEncKeys}
							className="mb-4"
						/>
					)}
					<Alert
						variant="info"
						title={t('secretsInventory.envOnlyAlert', '密钥值仅通过环境变量管理')}
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
					<Lock size="1em" /> {t('secretsInventory.tabJwtKeys', { n: jwtKeys.length })}
				</span>
			),
			children: (
				<div>
					{jwtError && (
						<PageError message={t('secretsInventory.jwtLoadError', '加载 JWT 密钥失败')} retry={refetchJwt} className="mb-4" />
					)}
					<Alert
						variant="info"
						title={t('secretsInventory.jwtMemoryAlert')}
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
					<Cloud size="1em" /> {t('secretsInventory.tabInfrastructure', { n: infra.length })}
				</span>
			),
			children: (
				<div>
					{infraError && (
						<PageError
							message={t('secretsInventory.infraLoadError', '加载基础设施数据失败')}
							retry={refetchInfra}
							className="mb-4"
						/>
					)}
					<Alert
						variant="warning"
						title={t('secretsInventory.infraWarning', '这些凭证在密钥服务之外管理，建议迁移。')}
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
					<Plug size="1em" /> {t('secretsInventory.tabApiKeys', { n: apiKeys.length })}
				</span>
			),
			children: (
				<div>
					{apiKeysError && (
						<PageError message={t('secretsInventory.apiKeysLoadError', '加载 API 密钥失败')} retry={refetchApiKeys} className="mb-4" />
					)}
					<DataTable
						rowKey="id"
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
					<Globe size="1em" /> {t('secretsInventory.tabOauth', { n: oauth.length })}
				</span>
			),
			children: (
				<div>
					{oauthError && (
						<PageError
							message={t('secretsInventory.oauthLoadError', '加载 OAuth 密钥失败')}
							retry={refetchOauth}
							className="mb-4"
						/>
					)}
					<Alert
						variant="info"
						title={t('secretsInventory.oauthMaskedAlert')}
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
				title={t('secretsInventory.title', '密钥清单')}
				description={t('secretsInventory.description', '平台级密钥总览与管理')}
			/>

			{overviewLoading ? (
				<PageLoading tip={t('secretsInventory.loading', '正在加载密钥清单…')} />
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
				title={t('secretsInventory.revealModalTitle', { name: revealTarget?.key ?? '' })}
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
							{t('common.close', '关闭')}
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
							title={t('secretsInventory.revealAuditWarning', '此操作将被审计，请填写原因。')}
							className="mb-4"
						 />
						<Input.TextArea
							placeholder={t('secretsInventory.revealReasonPlaceholder', '查看密钥值的原因…')}
							value={revealReason}
							onChange={(e) => setRevealReason(e.target.value)}
							rows={3}
							className="mb-4"
						/>
						<Button
							type="primary"
							danger
							icon={<Eye size="1em" />}
							onClick={handleConfirmReveal}
							loading={revealing}
						>
							{t('secretsInventory.revealSubmit', '显示值（记录审计）')}
						</Button>
					</div>
				) : (
					<div>
						<Alert
							variant="success"
							title={t('secretsInventory.revealShownAlert', '值已显示，将在 30 秒后自动隐藏。')}
							className="mb-4"
						 />
						<Input.TextArea value={revealedValue} readOnly rows={4} className="font-mono" />
						<div className="mt-2 text-right">
							<Text type="secondary">
								<Clock size="1em" className="mr-1" />
								{t('secretsInventory.revealAutoHide', '30 秒后自动隐藏')}
							</Text>
						</div>
					</div>
				)}
			</Modal>

			<Modal
				title={t('secretsInventory.rotateModalTitle', { name: rotateTarget?.key ?? '' })}
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
					title={t('secretsInventory.rotateModalAlert', '这将创建该密钥的新版本；现有引用仍可继续使用当前版本。')}
					className="mb-4"
				 />
				<Input.TextArea
					placeholder={t('secretsInventory.rotateValuePlaceholder', '请输入新的密钥值…')}
					value={rotateNewValue}
					onChange={(e) => setRotateNewValue(e.target.value)}
					rows={4}
					className="mb-4 font-mono"
				/>
				<Space>
					<Button
						type="primary"
						icon={<RefreshCw size="1em" />}
						onClick={handleConfirmRotate}
						loading={rotateMutation.isPending}
					>
						{t('secretsInventory.actionRotate', '轮换')}
					</Button>
					<Button
						onClick={() => {
							setRotateModalVisible(false);
							setRotateTarget(null);
							setRotateNewValue('');
						}}
					>
						{t('common.cancel', '取消')}
					</Button>
				</Space>
			</Modal>

			<Modal
				title={t('secretsInventory.oauthRotatedModalTitle', { id: oauthRotateTarget?.clientId ?? '' })}
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
						{t('common.close', '关闭')}
					</Button>
				}
				destroyOnHidden
				width={560}
			>
				<Alert
					variant="warning"
					title={t('secretsInventory.oauthRotatedAlert')}
					className="mb-4"
				 />
				<Input.TextArea value={oauthNewSecret ?? ''} readOnly rows={3} className="font-mono" />
				<div className="mt-3 text-right">
					<Button type="primary" icon={<Copy size="1em" />} onClick={handleCopyOAuthSecret}>
						{t('secretsInventory.copyNewSecret', '复制新密钥')}
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
	const { t } = useTranslation();
	if (error) return <ApiErrorState error={error} title={t('secretsInventory.overviewLoadError', '加载总览失败')} onRetry={retry} />;
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
							title={t('secretsInventory.totalSecrets', '密钥总数')}
							value={overview.totalSecrets}
							prefix={<KeyRound size="1em" />}
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} md={6}>
					<Card hoverable styles={{ body: { borderLeft: '3px solid var(--color-success)' } }}>
						<Statistic
							title={t('secretsInventory.active', '活跃')}
							value={overview.activeCount}
							styles={{ content: { color: 'var(--color-success)' } }}
							prefix={<CheckCircle2 size="1em" />}
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} md={6}>
					<Card hoverable styles={{ body: { borderLeft: '3px solid var(--color-warning)' } }}>
						<Statistic
							title={t('secretsInventory.expired', '已过期')}
							value={overview.expiredCount}
							styles={{ content: { color: 'var(--color-warning)' } }}
							prefix={<Clock size="1em" />}
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} md={6}>
					<Card hoverable styles={{ body: { borderLeft: '3px solid var(--color-danger)' } }}>
						<Statistic
							title={t('secretsInventory.revoked', '已吊销')}
							value={overview.revokedCount}
							styles={{ content: { color: 'var(--color-danger)' } }}
							prefix={<Ban size="1em" />}
						/>
					</Card>
				</Col>
			</Row>

			<Card title={t('secretsInventory.categoryBreakdown', '分类分布')} className="mb-6">
				<Row gutter={[16, 16]}>
					{Object.entries(overview.categoryBreakdown).map(([cat, count]) => (
						<Col xs={24} sm={12} md={8} key={cat}>
							<Card size="small" hoverable>
								<div className="flex items-center justify-between">
									<div>
										<Text strong className="capitalize">
											{cat === 'kv'
												? t('secretsInventory.catKv', '密钥 KV')
												: cat === 'encryptionKeys'
													? t('secretsInventory.catEncryptionKeys', '加密密钥')
													: cat === 'jwtKeys'
														? t('secretsInventory.catJwtKeys', 'JWT 密钥')
														: cat === 'infrastructure'
															? t('secretsInventory.catInfrastructure', '基础设施')
															: cat === 'apiKeys'
																? t('secretsInventory.catApiKeys', 'API 密钥')
																: t('secretsInventory.catOauth', 'OAuth')}
										</Text>
										<div className="mt-1">
											<Text type="secondary" className="text-sm">
												{t('secretsInventory.percentOfTotal', { p: ((count / overview.totalSecrets) * 100).toFixed(1) })}
											</Text>
										</div>
									</div>
									<Statistic value={count} styles={{ content: { fontSize: 24 } }} />
								</div>
							</Card>
						</Col>
					))}
				</Row>
			</Card>

			<Alert
				variant="info"
				title={t('secretsInventory.securityChecksTitle', '安全配置检测未接入')}
				className="mb-4"
			>
				{t('secretsInventory.securityChecksDesc')}
			</Alert>
		</div>
	);
}
