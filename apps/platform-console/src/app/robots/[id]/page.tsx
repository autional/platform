'use client';

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
	Button,
	Tag,
	Space,
	Form,
	Input,
	Select,
	Skeleton,
	Descriptions,
	Typography,
	Popconfirm,
} from 'antd';
import { Modal } from '@autional/ui/antd';
import {
	ArrowLeft,
	KeyRound,
	PauseCircle,
	Pencil,
	Play,
} from 'lucide-react';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { AppPageHeader, ErrorState, SectionCard, StatusBadge } from '@autional/ui';
import { ApiErrorState } from '@/components/ApiErrorState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from '@/lib/antd-app';
import {
	adminRobotsByRobots,
	adminRobotsByRobotsPut,
	adminRobotsCommissionByRobotsPost,
	adminRobotsDecommissionByRobotsPost,
	adminRobotsIntentByRobotsPost,
} from '@autional/shared/generated/api';
import { handleApiError } from '@/lib/error-handler';
import { queryKeys } from '@/lib/query-keys';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';
import { operationHint, statusLabel, statusVariant } from '@/lib/robot-status';
import type { RobotInfo } from '@autional/shared/generated/types';

const { Paragraph, Text } = Typography;

const SUBTYPE_LABEL_KEYS: Record<string, string> = {
	industrial: 'robots.subtype.industrial',
	vehicle: 'robots.subtype.vehicle',
	drone: 'robots.subtype.drone',
};

// 键映射 + 调用时求值（模块级无组件作用域）：未知子类型回退原始值，语义同旧版映射兜底。
function subtypeLabel(s: string | undefined): string {
	if (!s) return '-';
	const key = SUBTYPE_LABEL_KEYS[s];
	return key ? i18n.t(key) : s;
}

function formatDate(iso: string): string {
	if (!iso) return '-';
	return new Date(iso).toLocaleDateString('zh-CN');
}

async function fetchRobot(id: string): Promise<RobotInfo> {
	return adminRobotsByRobots(id);
}

async function updateRobot(id: string, values: Record<string, unknown>): Promise<RobotInfo> {
	return adminRobotsByRobotsPut(id, values as any);
}

async function commissionRobot(id: string): Promise<void> {
	await adminRobotsCommissionByRobotsPost(id);
}

async function decommissionRobot(id: string): Promise<void> {
	await adminRobotsDecommissionByRobotsPost(id);
}

async function issueIntentToken(
	id: string,
	data: Record<string, unknown>,
): Promise<{ intentToken?: string; intent_token?: string }> {
	return adminRobotsIntentByRobotsPost(id, data as any);
}

export default function RobotDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	const queryClient = useQueryClient();
	const [editVisible, setEditVisible] = useState(false);
	const [intentVisible, setIntentVisible] = useState(false);
	const [intentResult, setIntentResult] = useState<string | null>(null);
	const [form] = Form.useForm();
	const [intentForm] = Form.useForm();

	const {
		data: robot,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.robots.detail(id!),
		queryFn: () => fetchRobot(id!),
		enabled: !!id,
		staleTime: 30000,
	});

	const updateMut = useMutation({
		mutationFn: ({ id: robotId, values }: { id: string; values: Record<string, unknown> }) =>
			updateRobot(robotId, values),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.robots.detail(id!) });
			queryClient.invalidateQueries({ queryKey: queryKeys.robots.all });
		},
	});

	const commissionMut = useMutation({
		mutationFn: commissionRobot,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.robots.detail(id!) });
			queryClient.invalidateQueries({ queryKey: queryKeys.robots.all });
		},
	});

	const decommissionMut = useMutation({
		mutationFn: decommissionRobot,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.robots.detail(id!) });
			queryClient.invalidateQueries({ queryKey: queryKeys.robots.all });
		},
	});

	const intentMut = useMutation({
		mutationFn: ({ id: robotId, data }: { id: string; data: Record<string, unknown> }) =>
			issueIntentToken(robotId, data),
	});

	usePageTitle(robot?.name ? `${robot.name} - Robot` : t('robots.detailTitle', 'Robot 详情'));

	const handleEdit = async (values: Record<string, unknown>) => {
		if (!id) return;
		try {
			await updateMut.mutateAsync({ id, values });
			message.success(t('robots.updateSuccess', 'Robot 更新成功'));
			setEditVisible(false);
		} catch (err) {
			handleApiError(err, t('robots.updateFailed', '更新失败'));
		}
	};

	const openEdit = () => {
		if (!robot) return;
		form.setFieldsValue({
			name: robot.name,
			model: robot.model,
			location: robot.location,
			firmwareVer: robot.firmwareVer,
			safetyPolicy: robot.safetyPolicy,
		});
		setEditVisible(true);
	};

	const handleCommission = async () => {
		if (!id) return;
		try {
			await commissionMut.mutateAsync(id);
			message.success(t('robots.enableSuccess', 'Robot 已启用'));
		} catch (err) {
			handleApiError(err, t('robots.enableFailed', '启用失败'));
		}
	};

	const handleDecommission = async () => {
		if (!id) return;
		try {
			await decommissionMut.mutateAsync(id);
			message.success(t('robots.disableSuccess', 'Robot 已停用'));
		} catch (err) {
			handleApiError(err, t('robots.disableFailed', '停用失败'));
		}
	};

	const handleIssueIntent = async (values: Record<string, unknown>) => {
		if (!id) return;
		try {
			const result = await intentMut.mutateAsync({ id, data: values });
			setIntentResult(result.intentToken ?? result.intent_token ?? null);
			message.success(t('robots.issueIntentSuccess', 'Intent Token 已签发'));
		} catch (err) {
			handleApiError(err, t('robots.issueIntentFailed', '签发失败'));
		}
	};

	// U408：动作门与后端状态机对齐（CanCommission 仅认 commissioning；停用/签发 = active∪degraded）。
	const canCommission = robot?.status === 'commissioning';
	const canDecommission = robot?.status === 'active' || robot?.status === 'degraded';
	const canIssueIntent = robot?.status === 'active' || robot?.status === 'degraded';
	const statusHint = operationHint(robot?.status);

	if (!id) {
		return (
			<div>
				<ErrorState
					title={t('robots.invalidTitle', 'Robot 无效')}
					message={t('robots.invalidMessage', '未提供 Robot ID。')}
				/>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<Button
					type="text"
					icon={<ArrowLeft size="1em" />}
					onClick={() => navigate(buildNavHref(ROUTE.ROBOTS, tenantSlug))}
					className="mb-4 pl-0"
				>
					{t('robots.backToList', '返回 Robot 列表')}
				</Button>
				<div className="flex items-center justify-between">
					<AppPageHeader
						title={robot?.name || t('robots.detailTitle', 'Robot 详情')}
						description={
							robot?.model
								? t('robots.modelLine', { model: robot.model })
								: isLoading
									? t('robots.loading', '加载中…')
									: ''
						}
					/>
					{robot && (
						<Space>
							{canCommission && (
								<Button
									icon={<Play size="1em" />}
									style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
									onClick={handleCommission}
									loading={commissionMut.isPending}
								>
									{t('robots.enable', '启用')}
								</Button>
							)}
							{canDecommission && (
								<Popconfirm
									title={t('robots.disableConfirmTitle', '确认停用该 Robot？')}
									description={t('robots.disableConfirmDesc')}
									okText={t('robots.disableConfirmOk', '确认停用')}
									okButtonProps={{ danger: true }}
									onConfirm={handleDecommission}
								>
									<Button
										icon={<PauseCircle size="1em" />}
										danger
										loading={decommissionMut.isPending}
									>
										{t('robots.disable', '停用')}
									</Button>
								</Popconfirm>
							)}
							{canIssueIntent && (
								<Button
									icon={<KeyRound size="1em" />}
									onClick={() => {
										intentForm.resetFields();
										setIntentResult(null);
										setIntentVisible(true);
									}}
								>
									{t('robots.issueIntent', '签发 Intent')}
								</Button>
							)}
							<Button icon={<Pencil size="1em" />} onClick={openEdit}>
								{t('robots.editRobot', '编辑 Robot')}
							</Button>
						</Space>
					)}
				</div>
			</div>

			{isLoading && (
				<div className="space-y-4">
					<Skeleton active paragraph={{ rows: 4 }} />
					<Skeleton active paragraph={{ rows: 3 }} />
				</div>
			)}

			{!isLoading && error && (
				<ApiErrorState
					error={error}
					title={t('robots.loadDetailError', '加载 Robot 详情失败')}
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !error && robot && (
				<>
					<SectionCard title={t('robots.infoSection', 'Robot 信息')} className="mb-6">
						<Descriptions column={2} bordered size="small">
							<Descriptions.Item label={t('robots.name', '名称')}>{robot.name}</Descriptions.Item>
							<Descriptions.Item label={t('common.status', '状态')}>
								<StatusBadge variant={statusVariant(robot.status)}>
									{statusLabel(robot.status)}
								</StatusBadge>
							</Descriptions.Item>
							<Descriptions.Item label={t('robots.model', '型号')}>{robot.model || '-'}</Descriptions.Item>
							<Descriptions.Item label={t('robots.subtype', '子类型')}>
								<Tag color="purple">
									{subtypeLabel(robot.workloadSubtype)}
								</Tag>
							</Descriptions.Item>
							<Descriptions.Item label={t('robots.location', '位置')}>{robot.location || '-'}</Descriptions.Item>
							<Descriptions.Item label={t('robots.firmware', '固件')}>{robot.firmwareVer || '-'}</Descriptions.Item>
							<Descriptions.Item label={t('robots.identityId', '身份 ID')}>{robot.identityId || '-'}</Descriptions.Item>
							<Descriptions.Item label={t('robots.ownerId', '所有者 ID')}>{robot.ownerId || '-'}</Descriptions.Item>
							<Descriptions.Item label={t('robots.safetyPolicy', '安全策略')}>
								{robot.safetyPolicy || '-'}
							</Descriptions.Item>
							<Descriptions.Item label={t('robots.lastHealthAt', '最近健康检查')}>
								{formatDate(robot.lastHealthAt || '')}
							</Descriptions.Item>
							<Descriptions.Item label={t('robots.createdAt', '创建时间')}>
								{formatDate(robot.createdAt || '')}
							</Descriptions.Item>
							<Descriptions.Item label={t('robots.updatedAt', '更新时间')}>
								{formatDate(robot.updatedAt || '')}
							</Descriptions.Item>
						</Descriptions>
					</SectionCard>

					<SectionCard title={t('common.actions', '操作')} className="mb-6">
						<div className="space-y-4">
							<div>
								<Text strong>{t('robots.commissionStatus', '启用状态：')}</Text>
								<Text type={statusHint.type}>{statusHint.text}</Text>
							</div>
							<div>
								<Text strong>{t('robots.intentTokenLine', 'Intent 令牌：')}</Text>
								{canIssueIntent ? (
									<Text>{t('robots.intentAvailable')}</Text>
								) : (
									<Text type="secondary">
										{t('robots.intentUnavailable')}
									</Text>
								)}
							</div>
						</div>
					</SectionCard>
				</>
			)}

			<Modal
				title={t('robots.editRobot', '编辑 Robot')}
				open={editVisible}
				onCancel={() => {
					setEditVisible(false);
					form.resetFields();
				}}
				onOk={() => form.submit()}
				confirmLoading={updateMut.isPending}
				destroyOnHidden
				// U412①：destroyOnHidden 弹窗首开前不渲染子树，forceRender 让表单随页挂载（消「未挂载即调用」告警）
				forceRender
			>
				<Form form={form} layout="vertical" onFinish={handleEdit}>
					<Form.Item name="name" label={t('robots.name', '名称')} rules={[{ required: true }]}>
						<Input placeholder={t('robots.namePlaceholder', '例如：assembly-bot-1、patrol-drone')} />
					</Form.Item>
					<Form.Item name="model" label={t('robots.model', '型号')}>
						<Input placeholder={t('robots.modelPlaceholder', '例如：UR5e、Phantom 4')} />
					</Form.Item>
					<Form.Item name="location" label={t('robots.location', '位置')}>
						<Input placeholder={t('robots.locationPlaceholder', '例如：Warehouse-A、Floor-3')} />
					</Form.Item>
					<Form.Item name="firmwareVer" label={t('robots.firmwareVer', '固件版本')}>
						<Input placeholder={t('robots.firmwarePlaceholder', '例如：v2.1.0')} />
					</Form.Item>
					<Form.Item name="safetyPolicy" label={t('robots.safetyPolicy', '安全策略')}>
						<Input placeholder={t('robots.safetyPolicyPlaceholder', '例如：strict、moderate')} />
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				title={t('robots.issueIntentTitle', { name: robot?.name || '' })}
				open={intentVisible}
				onCancel={() => {
					setIntentVisible(false);
					setIntentResult(null);
					intentForm.resetFields();
				}}
				footer={
					intentResult
						? [
								<Button
									key="close"
									onClick={() => {
										setIntentVisible(false);
										setIntentResult(null);
									}}
								>
									{t('robots.close', '关闭')}
								</Button>,
							]
						: [
								<Button
									key="cancel"
									onClick={() => {
										setIntentVisible(false);
										setIntentResult(null);
									}}
								>
									{t('common.cancel', '取消')}
								</Button>,
								<Button
									key="submit"
									type="primary"
									loading={intentMut.isPending}
									onClick={() => intentForm.submit()}
								>
									{t('robots.issueToken', '签发令牌')}
								</Button>,
							]
				}
				destroyOnHidden
				// U412①：destroyOnHidden 弹窗首开前不渲染子树，forceRender 让表单随页挂载（消「未挂载即调用」告警）
				forceRender
			>
				{intentResult ? (
					<div className="space-y-3">
						<Text strong>{t('robots.generatedIntentToken', '已生成的 Intent 令牌：')}</Text>
						<Paragraph copyable code className="break-all text-xs bg-neutral-50 p-3 rounded-xs border">
							{intentResult}
						</Paragraph>
						<Text type="secondary" className="text-xs">
							{t('robots.intentTokenNote')}
						</Text>
					</div>
				) : (
					<Form form={intentForm} layout="vertical" onFinish={handleIssueIntent}>
						<Form.Item name="actions" label={t('robots.allowedActions', '允许的动作')}>
							<Select
								mode="tags"
								placeholder={t('robots.actionsPlaceholder', '例如：move、grasp、navigate')}
								options={[
									{ value: 'move', label: t('robots.action.move', '移动') },
									{ value: 'grasp', label: t('robots.action.grasp', '抓取') },
									{ value: 'navigate', label: t('robots.action.navigate', '导航') },
									{ value: 'scan', label: t('robots.action.scan', '扫描') },
									{ value: 'dock', label: t('robots.action.dock', '停靠') },
								]}
							/>
						</Form.Item>
						<Form.Item name="allowedZones" label={t('robots.allowedZones', '允许的区域')}>
							<Select
								mode="tags"
								placeholder={t('robots.zonesPlaceholder', '例如：zone-a、warehouse-1')}
								options={[
									{ value: 'zone-a', label: t('robots.zoneA', '区域 A') },
									{ value: 'zone-b', label: t('robots.zoneB', '区域 B') },
									{ value: 'warehouse-1', label: t('robots.zoneWarehouse1', '仓库 1') },
									{ value: 'floor-1', label: t('robots.zoneFloor1', '楼层 1') },
								]}
							/>
						</Form.Item>
						<Form.Item name="maxSpeed" label={t('robots.maxSpeed', '最大速度（m/s）')}>
							<Input type="number" placeholder={t('robots.maxSpeedPlaceholder', '例如：2.0')} />
						</Form.Item>
					</Form>
				)}
			</Modal>
		</div>
	);
}
