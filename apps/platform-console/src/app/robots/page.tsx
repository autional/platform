'use client';

import React, { useState } from 'react';
import { DataTable, Modal } from '@autional/ui/antd';
import { Button, Space, Form, Input, Select, Popconfirm, Skeleton } from 'antd';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
	usePageTitle,
	useTenantSlug,
	fromPageResult,
	toPageParams,
	type PageResult,
} from '@autional/shared';
import { AppPageHeader, EmptyState, ErrorState, StatusBadge } from '@autional/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	adminRobots,
	adminRobotsPost,
	adminRobotsByRobotsDelete,
} from '@autional/shared/generated/api';
import { useNavigate } from 'react-router';
import { message } from '@/lib/antd-app';
import { handleApiError } from '@/lib/error-handler';
import { queryKeys } from '@/lib/query-keys';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';
import { statusLabel, statusVariant } from '@/lib/robot-status';

interface RobotRecord {
	identityId?: string;
	identity_id?: string;
	name: string;
	model?: string;
	location?: string;
	status: string;
	workloadSubtype?: string;
	workload_subtype?: string;
	firmwareVer?: string;
	firmware_ver?: string;
	ownerName?: string;
	owner_name?: string;
	ownerId?: string;
	owner_id?: string;
	createdAt?: string;
	created_at?: string;
}

function formatDate(iso: string): string {
	if (!iso) return '-';
	return new Date(iso).toLocaleDateString('zh-CN');
}

// 后端 RobotInfo 主键键名 = identity_id（无裸 id）；camel 化后 identityId。
function recordId(r: RobotRecord): string {
	return (r.identityId ?? r.identity_id ?? '') as string;
}

async function fetchRobots(page: number, pageSize: number): Promise<PageResult<RobotRecord>> {
	// tenant 从 JWT claims 读取，不传 tenant_id（PL-37：空参残留已去）
	const res = await adminRobots(toPageParams({ page, pageSize }) as any);
	return fromPageResult<RobotRecord>(res);
}

async function createRobot(values: Record<string, unknown>): Promise<RobotRecord> {
	return adminRobotsPost(values as any);
}

async function deleteRobot(id: string): Promise<void> {
	await adminRobotsByRobotsDelete(id);
}

export default function RobotsPage() {
	usePageTitle('Robot 管理');
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
		queryKey: queryKeys.robots.list({ page, pageSize }),
		queryFn: () => fetchRobots(page, pageSize),
		staleTime: 300000,
	});
	const robots = data?.items ?? [];
	const total = data?.total ?? 0;

	const createMut = useMutation({
		mutationFn: createRobot,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.robots.all }),
	});

	const deleteMut = useMutation({
		mutationFn: deleteRobot,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.robots.all }),
	});

	const handleCreate = async (values: Record<string, unknown>) => {
		try {
			await createMut.mutateAsync(values);
			message.success('Robot 创建成功');
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
			render: (v: string, record: RobotRecord) => (
				<a
					onClick={() =>
						navigate(
							buildNavHref(
								ROUTE.ROBOT_DETAIL.replace(':id', recordId(record)),
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
			title: '型号',
			dataIndex: 'model',
			key: 'model',
			render: (v: string) => v || '-',
		},
		{
			title: '位置',
			dataIndex: 'location',
			key: 'location',
			render: (v: string) => v || '-',
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => (
				<StatusBadge variant={statusVariant(v)}>{statusLabel(v)}</StatusBadge>
			),
		},
		{
			title: '所有者',
			key: 'owner',
			render: (_: unknown, r: RobotRecord) =>
				(r.ownerName ?? r.owner_name ?? r.ownerId ?? r.owner_id) || '-',
		},
		{
			title: '创建时间',
			key: 'created',
			render: (_: unknown, r: RobotRecord) =>
				formatDate((r.createdAt ?? r.created_at ?? '') as string),
		},
		{
			title: '操作',
			key: 'action',
			render: (_: unknown, record: RobotRecord) => (
				<Space size="small">
					<Button
						type="link"
						icon={<Pencil size="1em" />}
						onClick={(e) => {
							e.stopPropagation();
							navigate(
								buildNavHref(
									ROUTE.ROBOT_DETAIL.replace(':id', recordId(record)),
									tenantSlug,
								),
							);
						}}
					>
						编辑
					</Button>
					<Popconfirm
						title="确认删除该 Robot？"
						description="此操作不可撤销。"
						onConfirm={() => handleDelete(recordId(record))}
						okText="删除"
						okButtonProps={{ danger: true }}
						cancelText="取消"
					>
						<Button
							type="link"
							danger
							icon={<Trash2 size="1em" />}
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
			<AppPageHeader
				title="Robot 管理"
				description="管理物理机器人身份与工作负载凭证。"
				actions={
					<Button
						type="primary"
						icon={<Plus size="1em" />}
						onClick={() => {
							form.resetFields();
							setModalVisible(true);
						}}
					>
						新建 Robot
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
					title="加载 Robot 列表失败"
					message="请检查网络连接后重试。"
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !error && total === 0 && (
				<div className="flex flex-col items-center gap-4">
					<EmptyState title="暂无 Robot" description="创建第一个 Robot 以开始使用。" />
					<Button
						type="primary"
						icon={<Plus size="1em" />}
						onClick={() => {
							form.resetFields();
							setModalVisible(true);
						}}
					>
						新建 Robot
					</Button>
				</div>
			)}

			{!isLoading && !error && total > 0 && (
				<DataTable
					rowKey={recordId}
					columns={columns}
					dataSource={robots}
					pagination={{
						current: page,
						pageSize,
						total,
						showSizeChanger: true,
						showTotal: (t: number) => `共 ${t} 条 Robot`,
						onChange: (p: number, ps: number) => {
							setPage(p);
							setPageSize(ps);
						},
					}}
					onRow={(record) => ({
						onClick: () =>
							navigate(
								buildNavHref(
									ROUTE.ROBOT_DETAIL.replace(':id', recordId(record)),
									tenantSlug,
								),
							),
						style: { cursor: 'pointer' },
					})}
				/>
			)}

			<Modal
				title="新建 Robot"
				open={modalVisible}
				onCancel={() => {
					setModalVisible(false);
					form.resetFields();
				}}
				onOk={() => form.submit()}
				confirmLoading={createMut.isPending}
				destroyOnHidden
				// U412①：destroyOnHidden 弹窗首开前不渲染子树，forceRender 让表单随页挂载（消「未挂载即调用」告警）
				forceRender
			>
				<Form form={form} layout="vertical" onFinish={handleCreate}>
					<Form.Item name="name" label="名称" rules={[{ required: true }]}>
						<Input placeholder="例如：assembly-bot-1、patrol-drone" />
					</Form.Item>
					<Form.Item name="model" label="型号">
						<Input placeholder="例如：UR5e、Phantom 4" />
					</Form.Item>
					<Form.Item name="location" label="位置">
						<Input placeholder="例如：Warehouse-A、Floor-3" />
					</Form.Item>
					<Form.Item
						name="workload_subtype"
						label="工作负载子类型"
						rules={[{ required: true }]}
						initialValue="industrial"
					>
						<Select
							options={[
								{ value: 'industrial', label: '工业' },
								{ value: 'vehicle', label: '车辆' },
								{ value: 'drone', label: '无人机' },
							]}
						/>
					</Form.Item>
					<Form.Item name="firmware_ver" label="固件版本">
						<Input placeholder="例如：v2.1.0" />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
