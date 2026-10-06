'use client';

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
	Button,
	Tag,
	Space,
	Modal,
	Form,
	Input,
	Select,
	Skeleton,
	Descriptions,
	Typography,
	Popconfirm,
} from 'antd';
import {
	EditOutlined,
	ArrowLeftOutlined,
	PlayCircleOutlined,
	PauseCircleOutlined,
	KeyOutlined,
} from '@ant-design/icons';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { ConsolePageHeader, EmptyState, ErrorState, SectionCard, StatusBadge } from '@autional/ui';
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
import type { RobotInfo } from '@autional/shared/generated/types';

const { Paragraph, Text } = Typography;

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
	active: 'success',
	commissioning: 'info',
	degraded: 'warning',
	decommissioned: 'neutral',
	maintenance: 'warning',
	provisioning: 'info',
};

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
	return STATUS_VARIANT[s] || 'neutral';
}

const SUBTYPE_LABELS: Record<string, string> = {
	industrial: '工业',
	vehicle: '车辆',
	drone: '无人机',
};

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

	usePageTitle(robot?.name ? `${robot.name} - Robot` : 'Robot 详情');

	const handleEdit = async (values: Record<string, unknown>) => {
		if (!id) return;
		try {
			await updateMut.mutateAsync({ id, values });
			message.success('Robot 更新成功');
			setEditVisible(false);
		} catch (err) {
			handleApiError(err, '更新失败');
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
			message.success('Robot 已启用');
		} catch (err) {
			handleApiError(err, '启用失败');
		}
	};

	const handleDecommission = async () => {
		if (!id) return;
		try {
			await decommissionMut.mutateAsync(id);
			message.success('Robot 已停用');
		} catch (err) {
			handleApiError(err, '停用失败');
		}
	};

	const handleIssueIntent = async (values: Record<string, unknown>) => {
		if (!id) return;
		try {
			const result = await intentMut.mutateAsync({ id, data: values });
			setIntentResult(result.intentToken ?? result.intent_token ?? null);
			message.success('Intent Token 已签发');
		} catch (err) {
			handleApiError(err, '签发失败');
		}
	};

	const canCommission = robot?.status === 'decommissioned' || robot?.status === 'provisioning';
	const canDecommission = robot?.status === 'active';
	const canIssueIntent = robot?.status === 'active';

	if (!id) {
		return (
			<div>
				<ErrorState title="Robot 无效" message="未提供 Robot ID。" />
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<Button
					type="text"
					icon={<ArrowLeftOutlined />}
					onClick={() => navigate(buildNavHref(ROUTE.ROBOTS, tenantSlug))}
					className="mb-4 pl-0"
				>
					返回 Robot 列表
				</Button>
				<div className="flex items-center justify-between">
					<ConsolePageHeader
						title={robot?.name || 'Robot 详情'}
						description={robot?.model ? `型号：${robot.model}` : '加载中…'}
					/>
					{robot && (
						<Space>
							{canCommission && (
								<Button
									icon={<PlayCircleOutlined />}
									style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
									onClick={handleCommission}
									loading={commissionMut.isPending}
								>
									启用
								</Button>
							)}
							{canDecommission && (
								<Popconfirm
									title="确认停用该 Robot？"
									description="停用后该机器人将不可用，此操作将产生审计记录。"
									okText="确认停用"
									okButtonProps={{ danger: true }}
									onConfirm={handleDecommission}
								>
									<Button
										icon={<PauseCircleOutlined />}
										danger
										loading={decommissionMut.isPending}
									>
										停用
									</Button>
								</Popconfirm>
							)}
							{canIssueIntent && (
								<Button
									icon={<KeyOutlined />}
									onClick={() => {
										intentForm.resetFields();
										setIntentResult(null);
										setIntentVisible(true);
									}}
								>
									签发 Intent
								</Button>
							)}
							<Button icon={<EditOutlined />} onClick={openEdit}>
								编辑 Robot
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
				<ErrorState
					title="加载 Robot 详情失败"
					message="请重试。"
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !error && robot && (
				<>
					<SectionCard title="Robot 信息" className="mb-6">
						<Descriptions column={2} bordered size="small">
							<Descriptions.Item label="名称">{robot.name}</Descriptions.Item>
							<Descriptions.Item label="状态">
								<StatusBadge variant={statusVariant(robot.status || '')}>
									{robot.status || '-'}
								</StatusBadge>
							</Descriptions.Item>
							<Descriptions.Item label="型号">{robot.model || '-'}</Descriptions.Item>
							<Descriptions.Item label="子类型">
								<Tag color="purple">
									{SUBTYPE_LABELS[robot.workloadSubtype || ''] || robot.workloadSubtype || '-'}
								</Tag>
							</Descriptions.Item>
							<Descriptions.Item label="位置">{robot.location || '-'}</Descriptions.Item>
							<Descriptions.Item label="固件">{robot.firmwareVer || '-'}</Descriptions.Item>
							<Descriptions.Item label="身份 ID">{robot.identityId || '-'}</Descriptions.Item>
							<Descriptions.Item label="所有者 ID">{robot.ownerId || '-'}</Descriptions.Item>
							<Descriptions.Item label="安全策略">
								{robot.safetyPolicy || '-'}
							</Descriptions.Item>
							<Descriptions.Item label="最近健康检查">
								{formatDate(robot.lastHealthAt || '')}
							</Descriptions.Item>
							<Descriptions.Item label="创建时间">
								{formatDate(robot.createdAt || '')}
							</Descriptions.Item>
							<Descriptions.Item label="更新时间">
								{formatDate(robot.updatedAt || '')}
							</Descriptions.Item>
						</Descriptions>
					</SectionCard>

					<SectionCard title="操作" className="mb-6">
						<div className="space-y-4">
							<div>
								<Text strong>启用状态：</Text>
								{canCommission && <Text type="success">可启用</Text>}
								{canDecommission && <Text type="warning">活跃 —— 可停用</Text>}
								{robot.status === 'decommissioned' && <Text type="secondary">已停用</Text>}
								{robot.status === 'degraded' && (
									<Text type="warning">运行于降级模式</Text>
								)}
							</div>
							{canIssueIntent && (
								<div>
									<Text strong>Intent 令牌：</Text>
									<Text>
										可用 —— 点击「签发 Intent」生成一次性操作令牌。
									</Text>
								</div>
							)}
						</div>
					</SectionCard>
				</>
			)}

			<Modal
				title="编辑 Robot"
				open={editVisible}
				onCancel={() => {
					setEditVisible(false);
					form.resetFields();
				}}
				onOk={() => form.submit()}
				confirmLoading={updateMut.isPending}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" onFinish={handleEdit}>
					<Form.Item name="name" label="名称" rules={[{ required: true }]}>
						<Input placeholder="例如：assembly-bot-1、patrol-drone" />
					</Form.Item>
					<Form.Item name="model" label="型号">
						<Input placeholder="例如：UR5e、Phantom 4" />
					</Form.Item>
					<Form.Item name="location" label="位置">
						<Input placeholder="例如：Warehouse-A、Floor-3" />
					</Form.Item>
					<Form.Item name="firmwareVer" label="固件版本">
						<Input placeholder="例如：v2.1.0" />
					</Form.Item>
					<Form.Item name="safetyPolicy" label="安全策略">
						<Input placeholder="例如：strict、moderate" />
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				title={`签发 Intent 令牌 — ${robot?.name || ''}`}
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
									关闭
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
									取消
								</Button>,
								<Button
									key="submit"
									type="primary"
									loading={intentMut.isPending}
									onClick={() => intentForm.submit()}
								>
									签发令牌
								</Button>,
							]
				}
				destroyOnHidden
			>
				{intentResult ? (
					<div className="space-y-3">
						<Text strong>已生成的 Intent 令牌：</Text>
						<Paragraph copyable code className="break-all text-xs bg-neutral-50 p-3 rounded border">
							{intentResult}
						</Paragraph>
						<Text type="secondary" className="text-xs">
							复制该令牌并用于 Robot Runtime SDK。该令牌不会再次显示。
						</Text>
					</div>
				) : (
					<Form form={intentForm} layout="vertical" onFinish={handleIssueIntent}>
						<Form.Item name="actions" label="允许的动作">
							<Select
								mode="tags"
								placeholder="例如：move、grasp、navigate"
								options={[
									{ value: 'move', label: '移动' },
									{ value: 'grasp', label: '抓取' },
									{ value: 'navigate', label: '导航' },
									{ value: 'scan', label: '扫描' },
									{ value: 'dock', label: '停靠' },
								]}
							/>
						</Form.Item>
						<Form.Item name="allowedZones" label="允许的区域">
							<Select
								mode="tags"
								placeholder="例如：zone-a、warehouse-1"
								options={[
									{ value: 'zone-a', label: '区域 A' },
									{ value: 'zone-b', label: '区域 B' },
									{ value: 'warehouse-1', label: '仓库 1' },
									{ value: 'floor-1', label: '楼层 1' },
								]}
							/>
						</Form.Item>
						<Form.Item name="maxSpeed" label="最大速度（m/s）">
							<Input type="number" placeholder="例如：2.0" />
						</Form.Item>
					</Form>
				)}
			</Modal>
		</div>
	);
}
