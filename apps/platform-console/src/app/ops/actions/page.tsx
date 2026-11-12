'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
	Button,
	Card,
	Descriptions,
	Empty,
	Form,
	Input,
	Modal,
	Space,
	Table,
	Tag,
	Typography,
} from 'antd';
import type { TableProps } from 'antd';
import { ExternalLink, PlayCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AppPageHeader } from '@autional/ui';
import { getPortalUrl, usePageTitle } from '@autional/shared';

import { message } from '@/lib/antd-app';
import { ApiErrorState } from '@/components/ApiErrorState';
import {
	classifyOpsActionError,
	consentDeepLink,
	isTerminalStatus,
	loadRecentActions,
	newIdempotencyKey,
	previewResult,
	rememberAction,
	saveRecentActions,
	type OpsActionCatalogItem,
	type OpsActionRecord,
	type RecentOpsAction,
} from '@/lib/ops-actions';
import { useCreateOpsAction, useOpsActionCatalog, useOpsActionRecord } from '@/hooks/use-ops-actions';

const RISK_COLORS: Record<string, string> = {
	R0: 'default',
	R1: 'blue',
	R2: 'orange',
	R3: 'red',
};

const STATUS_COLORS: Record<string, string> = {
	requested: 'default',
	pending_consent: 'gold',
	executing: 'processing',
	succeeded: 'success',
	failed: 'error',
	rejected: 'error',
	denied: 'error',
	expired: 'default',
	canceled: 'default',
	cancel_requested: 'gold',
	request_failed: 'error',
	unknown: 'default',
};

/** 已知动作的参数示例（仅提示，不限制输入）。 */
const PARAM_HINTS: Record<string, string> = {
	'ops.echo': '{"hello":"world"}',
	'ops.tenant.get': '{"tenant_id":"<tenant-ulid>"}',
	'ops.tenant.create': '{"name":"acme","display_name":"Acme","plan":"free"}',
	'ops.tenant.suspend': '{"tenant_id":"<tenant-ulid>"}',
	'ops.tenant.activate': '{"tenant_id":"<tenant-ulid>"}',
	'ops.session.revoke': '{"tenant_id":"<tenant-ulid>","user_id":"<user-ulid>"}',
	'ops.user.lock': '{"tenant_id":"<tenant-ulid>","user_id":"<user-ulid>"}',
	'ops.user.unlock': '{"tenant_id":"<tenant-ulid>","user_id":"<user-ulid>"}',
	'ops.service.restart': '{"service":"<service-name>"}',
};

interface CreateFormValues {
	action: string;
	targetTenantId?: string;
	target?: string;
	summary: string;
	reason?: string;
	params?: string;
}

export default function OpsActionsPage() {
	const { t } = useTranslation();
	usePageTitle(t('opsActions.title', '动作请求'));

	const { data: catalog, isLoading: catalogLoading, error: catalogError, refetch } = useOpsActionCatalog();
	const createAction = useCreateOpsAction();

	const [form] = Form.useForm<CreateFormValues>();
	const [modalOpen, setModalOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [current, setCurrent] = useState<OpsActionRecord | null>(null);
	const [recent, setRecent] = useState<RecentOpsAction[]>([]);
	const [selectedAction, setSelectedAction] = useState<string>('');
	const [consentBase, setConsentBase] = useState<string>('');

	const detail = useOpsActionRecord(current?.actionId);
	const consentHref = consentDeepLink(current?.consentId, consentBase);
	const currentResult = previewResult(current?.result);

	useEffect(() => {
		setRecent(loadRecentActions());
		setConsentBase(getPortalUrl('consent'));
	}, []);

	// 详情轮询拿到新状态后，同步回「本次会话」列表与当前卡片。
	useEffect(() => {
		const latest = detail.data;
		if (!latest) return;
		setCurrent((prev) => (prev && prev.actionId === latest.actionId ? { ...prev, ...latest } : prev));
		setRecent((prev) =>
			saveRecentActions(
				prev.map((item) =>
					item.actionId === latest.actionId ? { ...item, status: latest.status } : item,
				),
			),
		);
	}, [detail.data]);

	const items = useMemo(() => catalog ?? [], [catalog]);
	const selectedItem = useMemo(
		() => items.find((item) => item.action === selectedAction),
		[items, selectedAction],
	);
	const catalogColumns: TableProps<OpsActionCatalogItem>['columns'] = [
		{
			title: t('opsActions.colAction', '动作'),
			dataIndex: 'action',
			key: 'action',
			render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
		},
		{
			title: t('opsActions.colRisk', '风险'),
			dataIndex: 'risk',
			key: 'risk',
			width: 90,
			render: (value: string) => <Tag color={RISK_COLORS[value] ?? 'default'}>{value}</Tag>,
		},
		{
			title: t('opsActions.colDescription', '说明'),
			dataIndex: 'description',
			key: 'description',
			render: (value?: string) => value ?? '—',
		},
		{
			title: t('opsActions.colFactor', '因子'),
			dataIndex: 'requiredFactor',
			key: 'requiredFactor',
			width: 120,
			render: (value?: string) => (value ? <Tag>{value}</Tag> : '—'),
		},
		{
			title: t('opsActions.colOperate', '操作'),
			key: 'ops',
			width: 110,
			render: (_: unknown, record) => (
				<Button
					size="small"
					icon={<PlayCircle size="1em" />}
					onClick={() => openCreate(record)}
				>
					{t('opsActions.create', '发起')}
				</Button>
			),
		},
	];

	const recentColumns: TableProps<RecentOpsAction>['columns'] = [
		{
			title: t('opsActions.colAction', '动作'),
			dataIndex: 'action',
			key: 'action',
			render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
		},
		{
			title: t('opsActions.colStatus', '状态'),
			dataIndex: 'status',
			key: 'status',
			width: 150,
			render: (value: string) => <StatusTag status={value} />,
		},
		{
			title: t('opsActions.colCreatedAt', '创建时间'),
			dataIndex: 'createdAt',
			key: 'createdAt',
			width: 200,
			render: (value?: string) => value ?? '—',
		},
		{
			title: t('opsActions.colOperate', '操作'),
			key: 'ops',
			width: 100,
			render: (_: unknown, record) => (
				<Button size="small" type="link" onClick={() => setCurrent(toRecord(record))}>
					{t('opsActions.view', '查看')}
				</Button>
			),
		},
	];

	// 用字面量 t() 键（i18n 门禁可静态核对；动态拼接键拿不到该保护）。
	function createErrorMessage(error: unknown): string {
		switch (classifyOpsActionError(error)) {
			case 'quota':
				return t('opsActions.err.quota');
			case 'unauthorized':
				return t('opsActions.err.unauthorized');
			case 'forbidden':
				return t('opsActions.err.forbidden');
			case 'invalid':
				return t('opsActions.err.invalid');
			case 'conflict':
				return t('opsActions.err.conflict');
			case 'unavailable':
				return t('opsActions.err.unavailable');
			default:
				return t('opsActions.err.unknown');
		}
	}

	function openCreate(item: OpsActionCatalogItem) {
		setSelectedAction(item.action);
		form.resetFields();
		form.setFieldsValue({ action: item.action });
		setModalOpen(true);
	}

	async function handleSubmit() {
		let values: CreateFormValues;
		try {
			values = await form.validateFields();
		} catch {
			return;
		}

		let params: Record<string, unknown> = {};
		if (values.params && values.params.trim() !== '') {
			try {
				const parsed = JSON.parse(values.params);
				if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
					message.error(t('opsActions.paramsMustBeObject', '参数必须是 JSON 对象'));
					return;
				}
				params = parsed as Record<string, unknown>;
			} catch {
				message.error(t('opsActions.paramsInvalid', '参数不是合法 JSON'));
				return;
			}
		}

		setSubmitting(true);
		try {
			const record = await createAction.mutateAsync({
				action: values.action,
				target: values.target,
				targetTenantId: values.targetTenantId,
				summary: values.summary,
				reason: values.reason,
				params,
				idempotencyKey: newIdempotencyKey(),
			});
			setCurrent(record);
			setRecent(rememberAction(record));
			setModalOpen(false);
			form.resetFields();
			if (record.status === 'succeeded') {
				message.success(t('opsActions.executed', '动作已执行'));
			} else if (record.status === 'pending_consent' || record.status === 'executing' || record.status === 'requested') {
				message.success(t('opsActions.created', '动作已创建，等待 Consent 审批'));
			} else {
				// failed / rejected / denied / expired / request_failed 等：别把失败说成「等待审批」
				message.warning(t('opsActions.finishedWithStatus', { status: record.status }));
			}
		} catch (error) {
			message.error(createErrorMessage(error));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div>
			<AppPageHeader title={t('opsActions.title', '动作请求')} />

			<Alert
				className="mb-4"
				variant="info"
				title={t('opsActions.noticeTitle', '本页只发起请求，审批在 Consent 完成')}
			>
				{t('opsActions.notice')}
			</Alert>

			{catalogError && (
				<ApiErrorState
					error={catalogError}
					title={t('opsActions.catalogLoadFailed', '动作目录加载失败')}
					onRetry={refetch}
					className="mb-4"
				/>
			)}

			<Card
				title={t('opsActions.catalog', '动作目录')}
				className="mb-4"
				extra={
					<Button size="small" icon={<RefreshCw size="1em" />} onClick={() => refetch()} loading={catalogLoading}>
						{t('common.refresh', '刷新')}
					</Button>
				}
			>
				<Table
					rowKey="action"
					size="small"
					loading={catalogLoading}
					columns={catalogColumns}
					dataSource={items}
					pagination={false}
					locale={{ emptyText: <Empty description={t('opsActions.catalogEmpty', '没有可用动作')} /> }}
				/>
			</Card>

			{current && (
				<Card
					className="mb-4"
					title={t('opsActions.detail', '动作详情')}
					extra={
						<Space>
							<Button
								size="small"
								icon={<RefreshCw size="1em" />}
								loading={detail.isFetching}
								onClick={() => detail.refetch()}
							>
								{t('opsActions.refresh', '刷新状态')}
							</Button>
							{consentHref && (
								<Button
									size="small"
									type="primary"
									icon={<ExternalLink size="1em" />}
									href={consentHref}
									target="_blank"
									rel="noreferrer"
								>
									{t('opsActions.goConsent', '去 Consent 审批')}
								</Button>
							)}
						</Space>
					}
				>
					<Descriptions column={2} size="small">
						<Descriptions.Item label={t('opsActions.colAction', '动作')}>
							<Typography.Text code>{current.action}</Typography.Text>
						</Descriptions.Item>
						<Descriptions.Item label={t('opsActions.colStatus', '状态')}>
							<StatusTag status={current.status} />
							{!isTerminalStatus(current.status) && (
								<span className="ml-2 text-xs text-neutral-500">
									{t('opsActions.polling', '每 4s 自动刷新')}
								</span>
							)}
						</Descriptions.Item>
						<Descriptions.Item label={t('opsActions.colRisk', '风险')}>
							<Tag color={RISK_COLORS[current.risk] ?? 'default'}>{current.risk}</Tag>
						</Descriptions.Item>
						<Descriptions.Item label={t('opsActions.actionId', '动作 ID')}>
							<Typography.Text copyable>{current.actionId}</Typography.Text>
						</Descriptions.Item>
						<Descriptions.Item label={t('opsActions.consentId', 'Consent ID')}>
							{current.consentId ? <Typography.Text copyable>{current.consentId}</Typography.Text> : '—'}
						</Descriptions.Item>
						<Descriptions.Item label={t('opsActions.targetTenant', '目标租户')}>
							{current.targetTenantId ?? '—'}
						</Descriptions.Item>
						<Descriptions.Item label={t('opsActions.summary', '摘要')} span={2}>
							{current.summary ?? '—'}
						</Descriptions.Item>
						{current.errorCode && (
							<Descriptions.Item label={t('opsActions.errorCode', '错误码')} span={2}>
								<Typography.Text type="danger">{current.errorCode}</Typography.Text>
							</Descriptions.Item>
						)}
						{currentResult && (
							<Descriptions.Item label={t('opsActions.result', '执行结果')} span={2}>
								<pre className="max-h-64 overflow-auto rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-800">
									{currentResult.text}
								</pre>
								{currentResult.truncated && (
									<span className="text-xs text-neutral-500">
										{t('opsActions.resultTruncated', '结果过长，已截断')}
									</span>
								)}
							</Descriptions.Item>
						)}
					</Descriptions>
					{current.status === 'pending_consent' && (
						<Alert
							className="mt-3"
							variant="warning"
							title={t('opsActions.pendingHint', '等待审批')}
						>
							{consentHref
								? t('opsActions.pendingHintWithLink', '请在 Consent PWA 打开深链完成批准/拒绝。')
								: t('opsActions.pendingHintNoLink', '请在 consent.autional.* 的待确认列表中找到该 Consent 完成审批。')}
						</Alert>
					)}
				</Card>
			)}

			<Card title={t('opsActions.recent', '本次会话发起的动作')}>
				<Table
					rowKey="actionId"
					size="small"
					columns={recentColumns}
					dataSource={recent}
					pagination={false}
					locale={{ emptyText: <Empty description={t('opsActions.recentEmpty', '还没有发起过动作')} /> }}
				/>
			</Card>

			<Modal
				open={modalOpen}
				title={t('opsActions.createTitle', '发起动作')}
				onCancel={() => setModalOpen(false)}
				onOk={handleSubmit}
				okText={t('opsActions.submit', '提交')}
				cancelText={t('common.cancel', '取消')}
				confirmLoading={submitting}
				destroyOnHidden
				// U412①：destroyOnHidden 弹窗首开前不渲染子树；openCreate 会 setFieldsValue，
				// 不 forceRender 会丢 action 值（AntD 未连接表单告警）。
				forceRender
			>
				<Form form={form} layout="vertical" preserve={false}>
					<Form.Item name="action" label={t('opsActions.colAction', '动作')} rules={[{ required: true }]}>
						<Input readOnly />
					</Form.Item>
					{selectedItem?.requiredFactor && (
						<Alert
							className="mb-3"
							variant="warning"
							title={t('opsActions.factorRequired', { factor: selectedItem.requiredFactor })}
						/>
					)}
					<Form.Item
						name="targetTenantId"
						label={t('opsActions.targetTenant', '目标租户')}
						extra={t('opsActions.targetTenantHint', '被操作对象的租户 ULID（不是发起人租户）')}
					>
						<Input placeholder="01ARZ3NDEKTSV4RRFFQ69G5FAV" />
					</Form.Item>
					<Form.Item name="target" label={t('opsActions.target', '目标')}>
						<Input placeholder={t('opsActions.targetPlaceholder', '可选：目标标识（服务名/资源名）')} />
					</Form.Item>
					<Form.Item
						name="summary"
						label={t('opsActions.summary', '摘要')}
						rules={[{ required: true, message: t('opsActions.summaryRequired', '请填写摘要') }]}
					>
						<Input placeholder={t('opsActions.summaryPlaceholder', '一句话说明这次操作的目的')} maxLength={512} />
					</Form.Item>
					<Form.Item name="reason" label={t('opsActions.reason', '原因')}>
						<Input placeholder={t('opsActions.reasonPlaceholder', '工单/事故编号或背景')} />
					</Form.Item>
					<Form.Item
						name="params"
						label={t('opsActions.params', '参数 JSON')}
						extra={t('opsActions.paramsHint', '参数只上行、不回显；不要粘贴密钥。')}
					>
						<Input.TextArea
							rows={5}
							className="font-mono"
							placeholder={PARAM_HINTS[selectedAction] ?? '{}'}
						/>
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}

function StatusTag({ status }: { status: string }) {
	const { t } = useTranslation();
	const key = status?.trim().toLowerCase() || 'unknown';
	return (
		<Tag color={STATUS_COLORS[key] ?? 'default'}>
			{t(`opsActions.status.${key}`, key)}
		</Tag>
	);
}

function toRecord(item: RecentOpsAction): OpsActionRecord {
	return {
		actionId: item.actionId,
		action: item.action,
		risk: 'unknown',
		status: item.status,
		createdAt: item.createdAt,
		consentId: item.consentId,
	};
}
