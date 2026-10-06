'use client';

import React, { useState } from 'react';
import { DataTable } from '@autional/ui/antd';
import { Button, Space, Tag, Modal, Form, Input, Select, Popconfirm, Skeleton } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
	usePageTitle,
	useTenantSlug,
	fromPageResult,
	toPageParams,
	type PageResult,
} from '@autional/shared';
import { ConsolePageHeader, EmptyState, ErrorState, StatusBadge } from '@autional/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	adminAgents,
	adminAgentsPost,
	adminAgentsByAgentsDelete,
} from '@autional/shared/generated/api';
import { useNavigate } from 'react-router';
import { message } from '@/lib/antd-app';
import { handleApiError } from '@/lib/error-handler';
import { queryKeys } from '@/lib/query-keys';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';

interface AgentRecord {
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
	jitTtl?: string;
	jit_ttl?: string;
	createdAt?: string;
	created_at?: string;
}

const SUBTYPE_LABELS: Record<string, string> = {
	agent: 'Agent',
	service_account: 'Service Account',
	automation: 'Automation',
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

// 后端 AgentInfo 主键键名 = identity_id（无裸 id）；camel 化后 identityId。
function recordId(r: AgentRecord): string {
	return (r.identityId ?? r.identity_id ?? '') as string;
}

async function fetchAgents(page: number, pageSize: number): Promise<PageResult<AgentRecord>> {
	// tenant 从 JWT claims 读取，不传 tenant_id（传参被后端忽略）
	// wire 真名 page/page_size 由 toPageParams 单点构造
	const res = await adminAgents(toPageParams({ page, pageSize }) as any);
	return fromPageResult<AgentRecord>(res);
}

async function createAgent(values: Record<string, unknown>): Promise<AgentRecord> {
	return adminAgentsPost(values as any);
}

async function deleteAgent(id: string): Promise<void> {
	await adminAgentsByAgentsDelete(id);
}

export default function AgentsPage() {
	usePageTitle('AI 智能体');
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	const queryClient = useQueryClient();
	const [modalVisible, setModalVisible] = useState(false);
	const [form] = Form.useForm();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	const {
		data,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.agents.list({ page, pageSize }),
		queryFn: () => fetchAgents(page, pageSize),
		staleTime: 300000,
	});
	const agents = data?.items ?? [];
	const total = data?.total ?? 0;

	const createMut = useMutation({
		mutationFn: createAgent,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
	});

	const deleteMut = useMutation({
		mutationFn: deleteAgent,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
	});

	const handleCreate = async (values: Record<string, unknown>) => {
		// 后端 CreateAgentRequest.rotation_days/jit_ttl 为 int；antd Input 产出 string，
		// 直接提交 422 —— 提交前归一为 number，空/非法值剔除（omitempty 走后端默认）。
		const payload: Record<string, unknown> = { ...values };
		for (const k of ['rotation_days', 'jit_ttl'] as const) {
			const v = payload[k];
			const n = v === '' || v === undefined || v === null ? NaN : Number(v);
			if (Number.isFinite(n)) payload[k] = n;
			else delete payload[k];
		}
		try {
			await createMut.mutateAsync(payload);
			message.success('Agent 创建成功');
			setModalVisible(false);
			form.resetFields();
		} catch (err) {
			handleApiError(err, '创建失败');
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteMut.mutateAsync(id);
			message.success('删除成功');
		} catch (err) {
			handleApiError(err, '删除失败');
		}
	};

	const columns = [
		{
			title: '名称',
			dataIndex: 'name',
			key: 'name',
			render: (v: string, record: AgentRecord) => (
				<a
					onClick={() =>
						navigate(
							buildNavHref(
								ROUTE.AGENT_DETAIL.replace(':id', recordId(record)),
								tenantSlug,
							),
						)
					}
					className="font-medium"
				>
					{v}
				</a>
			),
		},
		{
			title: '子类型',
			key: 'subtype',
			render: (_: unknown, r: AgentRecord) => {
				const v = (r.workloadSubtype ?? r.workload_subtype) || '';
				return (
					<Tag color={SUBTYPE_COLORS[v] || 'default'}>{SUBTYPE_LABELS[v] || v || '-'}</Tag>
				);
			},
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => <StatusBadge variant={statusVariant(v)}>{v || '-'}</StatusBadge>,
		},
		{
			title: '所有者',
			key: 'owner',
			render: (_: unknown, r: AgentRecord) =>
				(r.ownerName ?? r.owner_name ?? r.ownerId ?? r.owner_id) || '-',
		},
		{
			title: '创建时间',
			key: 'created',
			render: (_: unknown, r: AgentRecord) =>
				formatDate(r.createdAt ?? r.created_at ?? ''),
		},
		{
			title: '操作',
			key: 'action',
			render: (_: unknown, record: AgentRecord) => (
				<Space size="small">
					<Button
						type="link"
						icon={<EditOutlined />}
						onClick={(e) => {
							e.stopPropagation();
							navigate(
								buildNavHref(
									ROUTE.AGENT_DETAIL.replace(':id', recordId(record)),
									tenantSlug,
								),
							);
						}}
					>
						编辑
					</Button>
					<Popconfirm
						title="确认删除该 Agent？"
						description="此操作不可撤销。"
						onConfirm={() => handleDelete(recordId(record))}
						okText="删除"
						okButtonProps={{ danger: true }}
						cancelText="取消"
					>
						<Button
							type="link"
							danger
							icon={<DeleteOutlined />}
							onClick={(e) => e.stopPropagation()}
						>
							删除
						</Button>
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<div>
			<ConsolePageHeader
				title="AI 智能体"
				description="管理机器身份与工作负载凭证。"
				actions={
					<Button
						type="primary"
						icon={<PlusOutlined />}
						onClick={() => {
							form.resetFields();
							setModalVisible(true);
						}}
					>
						新建 Agent
					</Button>
				}
			/>

			{isLoading && (
				<div className="space-y-3">
					<Skeleton active />
					<Skeleton active />
					<Skeleton active />
				</div>
			)}

			{!isLoading && error && (
				<ErrorState
					title="加载 Agent 列表失败"
					message="请检查网络连接后重试。"
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !error && total === 0 && (
				<div className="flex flex-col items-center gap-4">
					<EmptyState title="暂无 Agent" description="创建第一个 AI 智能体以开始使用。" />
					<Button
						type="primary"
						icon={<PlusOutlined />}
						onClick={() => {
							form.resetFields();
							setModalVisible(true);
						}}
					>
						新建 Agent
					</Button>
				</div>
			)}

			{!isLoading && !error && total > 0 && (
				<DataTable
					rowKey={recordId}
					columns={columns}
					dataSource={agents}
					pagination={{
						current: page,
						pageSize,
						total,
						showSizeChanger: true,
						showTotal: (t: number) => `共 ${t} 条 Agent`,
						onChange: (p: number, ps: number) => {
							setPage(p);
							setPageSize(ps);
						},
					}}
					onRow={(record) => ({
						onClick: () =>
							navigate(
								buildNavHref(
									ROUTE.AGENT_DETAIL.replace(':id', recordId(record)),
									tenantSlug,
								),
							),
						style: { cursor: 'pointer' },
					})}
				/>
			)}

			<Modal
				title="新建 Agent"
				open={modalVisible}
				onCancel={() => {
					setModalVisible(false);
					form.resetFields();
				}}
				onOk={() => form.submit()}
				confirmLoading={createMut.isPending}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" onFinish={handleCreate}>
					<Form.Item name="name" label="名称" rules={[{ required: true }]}>
						<Input placeholder="例如：deploy-bot、ci-runner" />
					</Form.Item>
					<Form.Item name="description" label="描述">
						<Input.TextArea rows={3} placeholder="描述该 Agent 的用途" />
					</Form.Item>
					<Form.Item
						name="workload_subtype"
						label="工作负载子类型"
						rules={[{ required: true }]}
						initialValue="agent"
					>
						<Select
							options={[
								{ value: 'agent', label: 'Agent' },
								{ value: 'service_account', label: '服务账号' },
								{ value: 'automation', label: '自动化' },
							]}
						/>
					</Form.Item>
					<Form.Item name="rotation_days" label="轮换周期（天）" initialValue={90}>
						<Input type="number" placeholder="90" />
					</Form.Item>
					<Form.Item name="jit_ttl" label="JIT TTL（秒）" initialValue={3600}>
						<Input type="number" placeholder="例如 3600" />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
