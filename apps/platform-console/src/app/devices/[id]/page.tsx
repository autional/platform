'use client';

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Tag, Modal, Form, Input, Select, Skeleton, Descriptions } from 'antd';
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { ConsolePageHeader, EmptyState, ErrorState, SectionCard, StatusBadge } from '@autional/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractItem } from '@autional/shared';
import { adminIotsByIots } from '@autional/shared/generated/api';
import { message } from '@/lib/antd-app';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';
import { handleApiError } from '@/lib/error-handler';
import { queryKeys } from '@/lib/query-keys';
import type { DeviceInfo } from '@autional/shared/generated/types';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
	active: 'success',
	unpaired: 'info',
	transferring: 'warning',
	revoked: 'danger',
};

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
	return STATUS_VARIANT[s] || 'neutral';
}

const SUBTYPE_LABELS: Record<string, string> = {
	pet: '宠物',
	smart_home: '智能家居',
	office: '办公',
	sensor: '传感器',
};

const SUBTYPE_COLORS: Record<string, string> = {
	pet: 'pink',
	smart_home: 'green',
	office: 'blue',
	sensor: 'orange',
};

function formatDate(iso: string): string {
	if (!iso) return '-';
	return new Date(iso).toLocaleDateString('zh-CN');
}

async function fetchDevice(id: string): Promise<DeviceInfo> {
	return adminIotsByIots(id);
}

async function updateDevice(id: string, values: Record<string, unknown>): Promise<DeviceInfo> {
	const res = await apiClient.put(`/identity/api/v1/admin/iots/${id}`, values); // @generated-api-exempt — no generated endpoint
	return extractItem<DeviceInfo>(res.data) ?? ({} as DeviceInfo);
}

export default function DeviceDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	const queryClient = useQueryClient();
	const [editVisible, setEditVisible] = useState(false);
	const [form] = Form.useForm();

	const {
		data: device,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.devices.detail(id!),
		queryFn: () => fetchDevice(id!),
		enabled: !!id,
		staleTime: 30000,
	});

	const updateMut = useMutation({
		mutationFn: ({ id: devId, values }: { id: string; values: Record<string, unknown> }) =>
			updateDevice(devId, values),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.devices.detail(id!) });
			queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
		},
	});

	usePageTitle(device?.name ? `${device.name} - Device` : 'Device 详情');

	const handleEdit = async (values: Record<string, unknown>) => {
		if (!id) return;
		try {
			await updateMut.mutateAsync({ id, values });
			message.success('Device 更新成功');
			setEditVisible(false);
		} catch (err) {
			handleApiError(err, '更新失败');
		}
	};

	const openEdit = () => {
		if (!device) return;
		form.setFieldsValue({
			name: device.name,
			firmwareVer: device.firmwareVer,
			hardwareId: device.hardwareId,
			manufacturer: device.manufacturer,
		});
		setEditVisible(true);
	};

	if (!id) {
		return (
			<div>
				<ErrorState title="Device 无效" message="未提供 Device ID。" />
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<Button
					type="text"
					icon={<ArrowLeftOutlined />}
					onClick={() => navigate(buildNavHref(ROUTE.DEVICES, tenantSlug))}
					className="mb-4 pl-0"
				>
					返回 Device 列表
				</Button>
				<div className="flex items-center justify-between">
					<ConsolePageHeader
						title={device?.name || 'Device 详情'}
						description={device?.manufacturer ? `制造商：${device.manufacturer}` : '加载中…'}
					/>
					{device && (
						<Button icon={<EditOutlined />} onClick={openEdit}>
							编辑 Device
						</Button>
					)}
				</div>
			</div>

			{isLoading && (
				<div className="space-y-4">
					<Skeleton active paragraph={{ rows: 4 }} />
				</div>
			)}

			{!isLoading && error && (
				<ErrorState
					title="加载 Device 详情失败"
					message="请重试。"
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !error && device && (
				<SectionCard title="Device 信息" className="mb-6">
					<Descriptions column={2} bordered size="small">
						<Descriptions.Item label="名称">{device.name}</Descriptions.Item>
						<Descriptions.Item label="状态">
							<StatusBadge variant={statusVariant(device.status || '')}>
								{device.status || '-'}
							</StatusBadge>
						</Descriptions.Item>
						<Descriptions.Item label="类型">
							<Tag color={SUBTYPE_COLORS[device.workloadSubtype || ''] || 'default'}>
								{SUBTYPE_LABELS[device.workloadSubtype || ''] || device.workloadSubtype || '-'}
							</Tag>
						</Descriptions.Item>
						<Descriptions.Item label="身份 ID">{device.identityId || '-'}</Descriptions.Item>
						<Descriptions.Item label="硬件 ID">{device.hardwareId || '-'}</Descriptions.Item>
						<Descriptions.Item label="固件">{device.firmwareVer || '-'}</Descriptions.Item>
						<Descriptions.Item label="制造商">{device.manufacturer || '-'}</Descriptions.Item>
						<Descriptions.Item label="所有者 ID">{device.ownerId || '-'}</Descriptions.Item>
						<Descriptions.Item label="配对码">
							{device.pairingCode ? <code className="text-xs">{device.pairingCode}</code> : '-'}
						</Descriptions.Item>
						<Descriptions.Item label="创建时间">
							{formatDate(device.createdAt || '')}
						</Descriptions.Item>
						<Descriptions.Item label="更新时间">
							{formatDate(device.updatedAt || '')}
						</Descriptions.Item>
					</Descriptions>
				</SectionCard>
			)}

			{!isLoading && !error && !device && (
				<EmptyState
					title="未找到 Device"
					description="无法找到所请求的 Device。"
				/>
			)}

			<Modal
				title="编辑 Device"
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
						<Input placeholder="例如：temp-sensor-1" />
					</Form.Item>
					<Form.Item name="firmwareVer" label="固件版本">
						<Input placeholder="例如：v1.2.3" />
					</Form.Item>
					<Form.Item name="hardwareId" label="硬件 ID">
						<Input placeholder="例如：HW-001" />
					</Form.Item>
					<Form.Item name="manufacturer" label="制造商">
						<Input placeholder="例如：Bosch、Xiaomi" />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
