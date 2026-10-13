'use client';

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Tag, Form, Input, Select, Skeleton, Descriptions } from 'antd';
import { Modal } from '@autional/ui/antd';
import { ArrowLeft, Pencil } from 'lucide-react';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { ApiErrorState } from '@/components/ApiErrorState';
import { AppPageHeader, EmptyState, ErrorState, SectionCard, StatusBadge } from '@autional/ui';
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

const SUBTYPE_LABEL_KEYS: Record<string, string> = {
	pet: 'devices.subtype.pet',
	smart_home: 'devices.subtype.smart_home',
	office: 'devices.subtype.office',
	sensor: 'devices.subtype.sensor',
};

// 键映射 + 调用时求值（模块级无组件作用域）：未知子类型回退原始值，语义同旧版映射兜底。
function subtypeLabel(s: string | undefined): string {
	if (!s) return '-';
	const key = SUBTYPE_LABEL_KEYS[s];
	return key ? i18n.t(key) : s;
}

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
	const { t } = useTranslation();
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

	usePageTitle(device?.name ? `${device.name} - Device` : t('devices.detailTitle', 'Device 详情'));

	const handleEdit = async (values: Record<string, unknown>) => {
		if (!id) return;
		try {
			await updateMut.mutateAsync({ id, values });
			message.success(t('devices.updateSuccess', 'Device 更新成功'));
			setEditVisible(false);
		} catch (err) {
			handleApiError(err, t('devices.updateFailed', '更新失败'));
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
				<ErrorState
					title={t('devices.invalidTitle', 'Device 无效')}
					message={t('devices.invalidMessage', '未提供 Device ID。')}
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
					onClick={() => navigate(buildNavHref(ROUTE.DEVICES, tenantSlug))}
					className="mb-4 pl-0"
				>
					{t('devices.backToList', '返回 Device 列表')}
				</Button>
				<div className="flex items-center justify-between">
					<AppPageHeader
						title={device?.name || t('devices.detailTitle', 'Device 详情')}
						description={
							device?.manufacturer
								? t('devices.manufacturerLine', { name: device.manufacturer })
								: isLoading
									? t('devices.loading', '加载中…')
									: ''
						}
					/>
					{device && (
						<Button icon={<Pencil size="1em" />} onClick={openEdit}>
							{t('devices.editDevice', '编辑 Device')}
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
				<ApiErrorState
					error={error}
					title={t('devices.loadDetailError', '加载 Device 详情失败')}
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !error && device && (
				<SectionCard title={t('devices.infoSection', 'Device 信息')} className="mb-6">
					<Descriptions column={2} bordered size="small">
						<Descriptions.Item label={t('devices.name', '名称')}>{device.name}</Descriptions.Item>
						<Descriptions.Item label={t('common.status', '状态')}>
							<StatusBadge variant={statusVariant(device.status || '')}>
								{device.status || '-'}
							</StatusBadge>
						</Descriptions.Item>
						<Descriptions.Item label={t('devices.type', '类型')}>
							<Tag color={SUBTYPE_COLORS[device.workloadSubtype || ''] || 'default'}>
								{subtypeLabel(device.workloadSubtype)}
							</Tag>
						</Descriptions.Item>
						<Descriptions.Item label={t('devices.identityId', '身份 ID')}>{device.identityId || '-'}</Descriptions.Item>
						<Descriptions.Item label={t('devices.hardwareId', '硬件 ID')}>{device.hardwareId || '-'}</Descriptions.Item>
						<Descriptions.Item label={t('devices.firmware', '固件')}>{device.firmwareVer || '-'}</Descriptions.Item>
						<Descriptions.Item label={t('devices.manufacturer', '制造商')}>{device.manufacturer || '-'}</Descriptions.Item>
						<Descriptions.Item label={t('devices.ownerId', '所有者 ID')}>{device.ownerId || '-'}</Descriptions.Item>
						<Descriptions.Item label={t('devices.pairingCode', '配对码')}>
							{device.pairingCode ? <code className="text-xs">{device.pairingCode}</code> : '-'}
						</Descriptions.Item>
						<Descriptions.Item label={t('devices.createdAt', '创建时间')}>
							{formatDate(device.createdAt || '')}
						</Descriptions.Item>
						<Descriptions.Item label={t('devices.updatedAt', '更新时间')}>
							{formatDate(device.updatedAt || '')}
						</Descriptions.Item>
					</Descriptions>
				</SectionCard>
			)}

			{!isLoading && !error && !device && (
				<EmptyState
					title={t('devices.notFoundTitle', '未找到 Device')}
					description={t('devices.notFoundDesc', '无法找到所请求的 Device。')}
				/>
			)}

			<Modal
				title={t('devices.editDevice', '编辑 Device')}
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
					<Form.Item name="name" label={t('devices.name', '名称')} rules={[{ required: true }]}>
						<Input placeholder={t('devices.nameEditPlaceholder', '例如：temp-sensor-1')} />
					</Form.Item>
					<Form.Item name="firmwareVer" label={t('devices.firmwareVer', '固件版本')}>
						<Input placeholder={t('devices.firmwareVerPlaceholder', '例如：v1.2.3')} />
					</Form.Item>
					<Form.Item name="hardwareId" label={t('devices.hardwareId', '硬件 ID')}>
						<Input placeholder={t('devices.hardwareIdEditPlaceholder', '例如：HW-001')} />
					</Form.Item>
					<Form.Item name="manufacturer" label={t('devices.manufacturer', '制造商')}>
						<Input placeholder={t('devices.manufacturerPlaceholder', '例如：Bosch、Xiaomi')} />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
