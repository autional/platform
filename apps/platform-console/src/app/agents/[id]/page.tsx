'use client';

import React, { useState } from 'react';
import { DataTable } from '@autional/ui/antd';
import { useParams, useNavigate } from 'react-router';
import { Button, Tag, Modal, Form, Input, Select, Skeleton, Descriptions } from 'antd';
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';
import { AppPageHeader, EmptyState, ErrorState, SectionCard, StatusBadge } from '@autional/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractItem } from '@autional/shared';
import { adminAgentsByAgents, adminAgentsByAgentsPut } from '@autional/shared/generated/api';
import { message } from '@/lib/antd-app';
import { handleApiError } from '@/lib/error-handler';
import { queryKeys } from '@/lib/query-keys';

interface AgentDetail {
	identityId?: string;
	identity_id?: string;
	name: string;
	description: string;
	workloadSubtype?: string;
	workload_subtype?: string;
	status: string;
	ownerName?: string;
	owner_name?: string;
	ownerId?: string;
	owner_id?: string;
	rotationDays?: number;
	rotation_days?: number;
	jitTtl?: number;
	jit_ttl?: number;
	createdAt?: string;
	created_at?: string;
	updatedAt?: string;
	updated_at?: string;
}

interface CredentialRecord {
	id: string;
	name: string;
	type: string;
	status: string;
	last_used_at: string;
	expires_at: string;
}

interface ActivityRecord {
	id: string;
	action: string;
	detail: string;
	timestamp: string;
}

interface PermissionRecord {
	id: string;
	resource: string;
	action: string;
}

const SUBTYPE_LABELS: Record<string, string> = {
	agent: 'Agent',
	service_account: '服务账号',
	automation: '自动化',
};

const SUBTYPE_COLORS: Record<string, string> = {
	agent: 'blue',
	service_account: 'green',
	automation: 'orange',
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
	active: 'success',
	disabled: 'danger',
	suspended: 'warning',
	provisioning: 'info',
};

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
	return STATUS_VARIANT[s] || 'neutral';
}

function formatDate(iso: string): string {
	if (!iso) return '-';
	return new Date(iso).toLocaleDateString('zh-CN');
}

async function fetchAgent(id: string): Promise<AgentDetail> {
	return adminAgentsByAgents(id);
}

async function fetchCredentials(id: string): Promise<CredentialRecord[]> {
	const res = await apiClient.get(`/identity/api/v1/admin/agents/${id}/credentials`); // @generated-api-exempt — no generated endpoint
	const data = extractItem<{ items: any[] }>(res.data);
	if (data?.items) return data.items;
	if (Array.isArray(data)) return data;
	return [];
}

async function fetchActivity(id: string): Promise<ActivityRecord[]> {
	const res = await apiClient.get(`/identity/api/v1/admin/agents/${id}/activity`); // @generated-api-exempt — no generated endpoint
	const data = extractItem<{ items: any[] }>(res.data);
	if (data?.items) return data.items;
	if (Array.isArray(data)) return data;
	return [];
}

async function fetchPermissions(id: string): Promise<PermissionRecord[]> {
	const res = await apiClient.get(`/identity/api/v1/admin/agents/${id}/permissions`); // @generated-api-exempt — no generated endpoint
	const data = extractItem<{ items: any[] }>(res.data);
	if (data?.items) return data.items;
	if (Array.isArray(data)) return data;
	return [];
}

async function updateAgent(id: string, values: Record<string, unknown>): Promise<AgentDetail> {
	return adminAgentsByAgentsPut(id, values as any);
}

export default function AgentDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	const queryClient = useQueryClient();
	const [editVisible, setEditVisible] = useState(false);
	const [form] = Form.useForm();

	const {
		data: agent,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.agents.detail(id!),
		queryFn: () => fetchAgent(id!),
		enabled: !!id,
		staleTime: 300000,
	});

	const { data: credentials = [], isLoading: credLoading } = useQuery({
		queryKey: queryKeys.agents.credentials(id!),
		queryFn: () => fetchCredentials(id!),
		enabled: !!id,
		staleTime: 300000,
	});

	const { data: activity = [], isLoading: actLoading } = useQuery({
		queryKey: queryKeys.agents.activity(id!),
		queryFn: () => fetchActivity(id!),
		enabled: !!id,
		staleTime: 60000,
	});

	const { data: permissions = [], isLoading: permLoading } = useQuery({
		queryKey: queryKeys.agents.permissions(id!),
		queryFn: () => fetchPermissions(id!),
		enabled: !!id,
		staleTime: 300000,
	});

	const updateMut = useMutation({
		mutationFn: ({ id: agentId, values }: { id: string; values: Record<string, unknown> }) =>
			updateAgent(agentId, values),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(id!) });
			queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
		},
	});

	usePageTitle(agent?.name ? `${agent.name} - Agent` : 'Agent 详情');

	// 后端 UpdateAgentRequest.rotation_days/jit_ttl 为 *int；antd Input 产出 string，
	// 直接提交 422 —— 提交前归一为 number，空/非法值剔除（omitempty 走后端默认）。
	const handleEdit = async (values: Record<string, unknown>) => {
		if (!id) return;
		const payload: Record<string, unknown> = { ...values };
		for (const k of ['rotation_days', 'jit_ttl'] as const) {
			const v = payload[k];
			const n = v === '' || v === undefined || v === null ? NaN : Number(v);
			if (Number.isFinite(n)) payload[k] = n;
			else delete payload[k];
		}
		try {
			await updateMut.mutateAsync({ id, values: payload });
			message.success('Agent 更新成功');
			setEditVisible(false);
		} catch (err) {
			handleApiError(err, '更新失败');
		}
	};

	const openEdit = () => {
		if (!agent) return;
		form.setFieldsValue({
			name: agent.name,
			description: agent.description,
			workload_subtype: agent.workloadSubtype ?? agent.workload_subtype,
			rotation_days: agent.rotationDays ?? agent.rotation_days,
			jit_ttl: agent.jitTtl ?? agent.jit_ttl,
		});
		setEditVisible(true);
	};

	const subtype = agent?.workloadSubtype ?? agent?.workload_subtype ?? '';
	const ownerDisplay =
		agent?.ownerName ?? agent?.owner_name ?? agent?.ownerId ?? agent?.owner_id ?? '';
	const rotationDays = agent?.rotationDays ?? agent?.rotation_days;
	const jitTtl = agent?.jitTtl ?? agent?.jit_ttl;

	const credentialColumns = [
		{ title: '名称', dataIndex: 'name', key: 'name' },
		{
			title: '类型',
			dataIndex: 'type',
			key: 'type',
			render: (v: string) => <Tag>{v || '-'}</Tag>,
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => (
				<StatusBadge variant={v === 'active' ? 'success' : 'neutral'}>{v || '-'}</StatusBadge>
			),
		},
		{
			title: '最后使用',
			key: 'last_used',
			render: (_: unknown, r: any) =>
				formatDate((r.lastUsedAt as string) ?? (r.last_used_at as string) ?? ''),
		},
		{
			title: '过期时间',
			key: 'expires',
			render: (_: unknown, r: any) =>
				formatDate((r.expiresAt as string) ?? (r.expires_at as string) ?? ''),
		},
	];

	const activityColumns = [
		{ title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => <Tag>{v}</Tag> },
		{ title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
		{
			title: '时间',
			dataIndex: 'timestamp',
			key: 'timestamp',
			render: (v: string) => formatDate(v),
		},
	];

	const permissionColumns = [
		{ title: '资源', dataIndex: 'resource', key: 'resource' },
		{
			title: '动作',
			dataIndex: 'action',
			key: 'action',
			render: (v: string) => <Tag color="blue">{v}</Tag>,
		},
	];

	if (!id) {
		return (
			<div>
				<ErrorState title="Agent 无效" message="未提供 Agent ID。" />
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<Button
					type="text"
					icon={<ArrowLeftOutlined />}
					onClick={() => navigate(buildNavHref(ROUTE.AGENTS, tenantSlug))}
					className="mb-4 pl-0"
				>
					返回 Agent 列表
				</Button>
				<div className="flex items-center justify-between">
					<AppPageHeader
						title={agent?.name || 'Agent 详情'}
						description={agent?.description || '加载中…'}
					/>
					{agent && (
						<Button icon={<EditOutlined />} onClick={openEdit}>
							编辑 Agent
						</Button>
					)}
				</div>
			</div>

			{isLoading && (
				<div className="space-y-4">
					<Skeleton active paragraph={{ rows: 4 }} />
					<Skeleton active paragraph={{ rows: 3 }} />
					<Skeleton active paragraph={{ rows: 3 }} />
				</div>
			)}

			{!isLoading && error && (
				<ErrorState
					title="加载 Agent 详情失败"
					message="请重试。"
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !error && agent && (
				<>
					<SectionCard title="Agent 信息" className="mb-6">
						<Descriptions column={2} bordered size="small">
							<Descriptions.Item label="名称">{agent.name}</Descriptions.Item>
							<Descriptions.Item label="状态">
								<StatusBadge variant={statusVariant(agent.status)}>{agent.status}</StatusBadge>
							</Descriptions.Item>
							<Descriptions.Item label="工作负载子类型">
								<Tag color={SUBTYPE_COLORS[subtype] || 'default'}>
									{SUBTYPE_LABELS[subtype] || subtype || '-'}
								</Tag>
							</Descriptions.Item>
							<Descriptions.Item label="所有者">{ownerDisplay || '-'}</Descriptions.Item>
							<Descriptions.Item label="轮换周期（天）">
								{rotationDays ?? '-'}
							</Descriptions.Item>
							<Descriptions.Item label="JIT TTL">
								{jitTtl ? `${jitTtl} 秒` : '-'}
							</Descriptions.Item>
							<Descriptions.Item label="创建时间">
								{formatDate(agent.createdAt ?? agent.created_at ?? '')}
							</Descriptions.Item>
							<Descriptions.Item label="更新时间">
								{formatDate(agent.updatedAt ?? agent.updated_at ?? '')}
							</Descriptions.Item>
						</Descriptions>
					</SectionCard>

					<SectionCard title="凭证" className="mb-6">
						{credLoading ? (
							<Skeleton active paragraph={{ rows: 2 }} />
						) : credentials.length === 0 ? (
							<EmptyState
								title="暂无凭证"
								description="该 Agent 尚未签发任何凭证。"
							/>
						) : (
							<DataTable
								rowKey="id"
								columns={credentialColumns}
								dataSource={credentials}
								pagination={false}
								size="small"
							/>
						)}
					</SectionCard>

					<SectionCard title="近期活动" className="mb-6">
						{actLoading ? (
							<Skeleton active paragraph={{ rows: 3 }} />
						) : activity.length === 0 ? (
							<EmptyState title="暂无活动" description="该 Agent 近期没有活动。" />
						) : (
							<DataTable
								rowKey="id"
								columns={activityColumns}
								dataSource={activity}
								pagination={false}
								size="small"
							/>
						)}
					</SectionCard>

					<SectionCard title="权限" className="mb-6">
						{permLoading ? (
							<Skeleton active paragraph={{ rows: 2 }} />
						) : permissions.length === 0 ? (
							<EmptyState
								title="暂无权限"
								description="该 Agent 未分配任何权限。"
							/>
						) : (
							<DataTable
								rowKey="id"
								columns={permissionColumns}
								dataSource={permissions}
								pagination={false}
								size="small"
							/>
						)}
					</SectionCard>
				</>
			)}

			<Modal
				title="编辑 Agent"
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
						<Input placeholder="例如：deploy-bot、ci-runner" />
					</Form.Item>
					<Form.Item name="description" label="描述">
						<Input.TextArea rows={3} placeholder="描述该 Agent 的用途" />
					</Form.Item>
					<Form.Item name="workload_subtype" label="工作负载子类型" rules={[{ required: true }]}>
						<Select
							options={[
								{ value: 'agent', label: 'Agent' },
								{ value: 'service_account', label: '服务账号' },
								{ value: 'automation', label: '自动化' },
							]}
						/>
					</Form.Item>
					<Form.Item name="rotation_days" label="轮换周期（天）">
						<Input type="number" placeholder="90" />
					</Form.Item>
					<Form.Item name="jit_ttl" label="JIT TTL（秒）">
						<Input type="number" placeholder="例如 3600" />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
