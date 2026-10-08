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
import { adminIots, adminIotsPost, adminIotsByIotsDelete } from '@autional/shared/generated/api';
import { useNavigate } from 'react-router';
import { message } from '@/lib/antd-app';
import { handleApiError } from '@/lib/error-handler';
import { queryKeys } from '@/lib/query-keys';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';

interface DeviceRecord {
	identityId?: string;
	identity_id?: string;
	name: string;
	type?: string;
	workloadSubtype?: string;
	workload_subtype?: string;
	hardwareId?: string;
	hardware_id?: string;
	firmwareVer?: string;
	firmware_ver?: string;
	manufacturer?: string;
	ownerName?: string;
	owner_name?: string;
	ownerId?: string;
	owner_id?: string;
	createdAt?: string;
	created_at?: string;
}

const TYPE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
	pet: 'info',
	smart_home: 'success',
	office: 'warning',
	sensor: 'info',
};

function typeVariant(s: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
	return TYPE_VARIANT[s] || 'neutral';
}

const TYPE_LABELS: Record<string, string> = {
	pet: '宠物',
	smart_home: '智能家居',
	office: '办公',
	sensor: '传感器',
};

function formatDate(iso: string): string {
	if (!iso) return '-';
	return new Date(iso).toLocaleDateString('zh-CN');
}

// 后端 DeviceInfo 主键键名 = identity_id（无裸 id）；camel 化后 identityId。
function recordId(r: DeviceRecord): string {
	return (r.identityId ?? r.identity_id ?? '') as string;
}

async function fetchDevices(page: number, pageSize: number): Promise<PageResult<DeviceRecord>> {
	// tenant 从 JWT claims 读取，不传 tenant_id（传参被后端忽略）
	const res = await adminIots(toPageParams({ page, pageSize }) as any);
	return fromPageResult<DeviceRecord>(res);
}

async function createDevice(values: Record<string, unknown>): Promise<DeviceRecord> {
	return adminIotsPost(values as any);
}

async function deleteDevice(id: string): Promise<void> {
	await adminIotsByIotsDelete(id);
}

export default function DevicesPage() {
	usePageTitle('Device 管理');
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
		queryKey: queryKeys.devices.list({ page, pageSize }),
		queryFn: () => fetchDevices(page, pageSize),
		staleTime: 300000,
	});
	const devices = data?.items ?? [];
	const total = data?.total ?? 0;

	const createMut = useMutation({
		mutationFn: createDevice,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.devices.all }),
	});

	const deleteMut = useMutation({
		mutationFn: deleteDevice,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.devices.all }),
	});

	const handleCreate = async (values: Record<string, unknown>) => {
		try {
			await createMut.mutateAsync(values);
			message.success('Device 创建成功');
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
			render: (v: string, record: DeviceRecord) => (
				<a
					onClick={() =>
						navigate(
							buildNavHref(
								ROUTE.DEVICE_DETAIL.replace(':id', recordId(record)),
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
			title: '类型',
			key: 'type',
			render: (_: unknown, r: DeviceRecord) => {
				const v = (r.workloadSubtype ?? r.workload_subtype) || '';
				return (
					<StatusBadge variant={typeVariant(v)}>{TYPE_LABELS[v] || v || '-'}</StatusBadge>
				);
			},
		},
		{
			title: '所有者',
			key: 'owner',
			render: (_: unknown, r: DeviceRecord) =>
				(r.ownerName ?? r.owner_name ?? r.ownerId ?? r.owner_id) || '-',
		},
		{
			title: '硬件 ID',
			key: 'hardware_id',
			render: (_: unknown, r: DeviceRecord) => {
				const v = (r.hardwareId ?? r.hardware_id) || '';
				return v ? <code className="text-xs">{v}</code> : '-';
			},
		},
		{
			title: '固件',
			key: 'firmware_ver',
			render: (_: unknown, r: DeviceRecord) => (r.firmwareVer ?? r.firmware_ver) || '-',
		},
		{
			title: '创建时间',
			key: 'created_at',
			render: (_: unknown, r: DeviceRecord) =>
				formatDate((r.createdAt ?? r.created_at ?? '') as string),
		},
		{
			title: '操作',
			key: 'action',
			render: (_: unknown, record: DeviceRecord) => (
				<Space size="small">
					<Button
						type="link"
						icon={<Pencil size="1em" />}
						onClick={(e) => {
							e.stopPropagation();
							navigate(
								buildNavHref(
									ROUTE.DEVICE_DETAIL.replace(':id', recordId(record)),
									tenantSlug,
								),
							);
						}}
					>
						编辑
					</Button>
					<Popconfirm
						title="确认删除该 Device？"
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
				title="Device 管理"
				description="管理 IoT 与边缘设备身份。"
				actions={
					<Button
						type="primary"
						icon={<Plus size="1em" />}
						onClick={() => {
							form.resetFields();
							setModalVisible(true);
						}}
					>
						新建 Device
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
					title="加载 Device 列表失败"
					message="请检查网络连接后重试。"
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !error && total === 0 && (
				<div className="flex flex-col items-center gap-4">
					<EmptyState title="暂无 Device" description="创建第一个 Device 以开始使用。" />
					<Button
						type="primary"
						icon={<Plus size="1em" />}
						onClick={() => {
							form.resetFields();
							setModalVisible(true);
						}}
					>
						新建 Device
					</Button>
				</div>
			)}

			{!isLoading && !error && total > 0 && (
				<DataTable
					rowKey={recordId}
					columns={columns}
					dataSource={devices}
					pagination={{
						current: page,
						pageSize,
						total,
						showSizeChanger: true,
						showTotal: (t: number) => `共 ${t} 条 Device`,
						onChange: (p: number, ps: number) => {
							setPage(p);
							setPageSize(ps);
						},
					}}
					onRow={(record) => ({
						onClick: () =>
							navigate(
								buildNavHref(
									ROUTE.DEVICE_DETAIL.replace(':id', recordId(record)),
									tenantSlug,
								),
							),
						style: { cursor: 'pointer' },
					})}
				/>
			)}

			<Modal
				title="新建 Device"
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
						<Input placeholder="例如：temp-sensor-1、smart-lock-front" />
					</Form.Item>
					<Form.Item
						name="workload_subtype"
						label="工作负载子类型"
						rules={[{ required: true }]}
						initialValue="sensor"
					>
						<Select
							options={[
								{ value: 'pet', label: '宠物' },
								{ value: 'smart_home', label: '智能家居' },
								{ value: 'office', label: '办公' },
								{ value: 'sensor', label: '传感器' },
							]}
						/>
					</Form.Item>
					<Form.Item name="hardware_id" label="硬件 ID">
						<Input placeholder="例如：HW-001、ESP32-A4" />
					</Form.Item>
					<Form.Item name="firmware_ver" label="固件版本">
						<Input placeholder="例如：v1.2.3" />
					</Form.Item>
					<Form.Item name="manufacturer" label="制造商">
						<Input placeholder="例如：Bosch、Xiaomi" />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
