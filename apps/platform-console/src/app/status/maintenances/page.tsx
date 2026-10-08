'use client';

import React, { useState } from 'react';
import dayjs from 'dayjs';
import { Button, Space, Form, Input, Select, Popconfirm, DatePicker } from 'antd';
import { message } from '@/lib/antd-app';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
	useMaintenances,
	useCreateMaintenance,
	useUpdateMaintenance,
	useDeleteMaintenance,
} from '@/hooks/use-status';
import type { MaintenanceRecord } from '@/hooks/use-status';
import { handleApiError } from '@/lib/error-handler';
import { formatDateTime } from '@/lib/format';
import { PageError, DataTable, Modal } from '@autional/ui/antd';
import { AppPageHeader, StatusBadge, type StatusVariant } from '@autional/ui';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@autional/shared';

const { Option } = Select;
const { TextArea } = Input;

const maintenanceStatusBadge: Record<string, StatusVariant> = {
	scheduled: 'info',
	in_progress: 'warning',
	completed: 'success',
	cancelled: 'neutral',
};

const statusLabels: Record<string, string> = {
	scheduled: '已排期',
	in_progress: '进行中',
	completed: '已完成',
	cancelled: '已取消',
};

export default function MaintenancesPage() {
	const { t } = useTranslation();
	usePageTitle(t('maintenances.title', '计划维护'));
	const [modalVisible, setModalVisible] = useState(false);
	const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
	const [filters, setFilters] = useState<{ status?: string }>({});
	const [form] = Form.useForm();

	const {
		data = [],
		isLoading,
		error,
		refetch,
	} = useMaintenances(Object.keys(filters).length > 0 ? filters : undefined);
	const createMut = useCreateMaintenance();
	const updateMut = useUpdateMaintenance();
	const deleteMut = useDeleteMaintenance();

	const handleSave = async (values: any) => {
		try {
			const payload = {
				title: values.title,
				description: values.description,
				scheduledStartAt: values.scheduledStartAt?.toISOString(),
				scheduledEndAt: values.scheduledEndAt?.toISOString(),
				affectedServices: values.affectedServices
					? values.affectedServices
							.split(',')
							.map((s: string) => s.trim())
							.filter(Boolean)
					: undefined,
			};
			if (editing) {
				await updateMut.mutateAsync({
					id: editing.id,
					data: { ...payload, status: values.status },
				});
				message.success('维护更新成功');
			} else {
				await createMut.mutateAsync(payload);
				message.success('维护创建成功');
			}
			setModalVisible(false);
			setEditing(null);
			form.resetFields();
		} catch (err) {
			handleApiError(err, '保存失败');
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
		{ title: '标题', dataIndex: 'title', key: 'title' },
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => (
				<StatusBadge variant={maintenanceStatusBadge[v]}>{statusLabels[v] || v}</StatusBadge>
			),
		},
		{
			title: '计划开始',
			dataIndex: 'scheduledStartAt',
			key: 'scheduledStartAt',
			render: (v?: string) => (v ? formatDateTime(v) : '-'),
		},
		{
			title: '计划结束',
			dataIndex: 'scheduledEndAt',
			key: 'scheduledEndAt',
			render: (v?: string) => (v ? formatDateTime(v) : '-'),
		},
		{
			title: '影响服务',
			dataIndex: 'affectedServices',
			key: 'affectedServices',
			render: (v?: string[]) => (v && v.length > 0 ? v.join(', ') : '-'),
		},
		{
			title: '操作',
			key: 'action',
			render: (_: any, record: MaintenanceRecord) => (
				<Space size="small">
					<Button
						type="text"
						size="small"
						icon={<Pencil size="1em" />}
						onClick={() => {
							setEditing(record);
							form.setFieldsValue({
								title: record.title,
								description: record.description,
								status: record.status,
								scheduledStartAt: record.scheduledStartAt
									? dayjs(record.scheduledStartAt)
									: undefined,
								scheduledEndAt: record.scheduledEndAt ? dayjs(record.scheduledEndAt) : undefined,
								affectedServices: record.affectedServices?.join(', '),
							});
							setModalVisible(true);
						}}
					>
						编辑
					</Button>
					<Popconfirm title="确认删除该项维护？" onConfirm={() => handleDelete(record.id)}>
						<Button type="text" danger size="small" icon={<Trash2 size="1em" />}>
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
				title={t('maintenances.title', '计划维护')}
				actions={
					<>
						<Button
							type="primary"
							icon={<Plus size="1em" />}
							onClick={() => {
								setEditing(null);
								form.resetFields();
								setModalVisible(true);
							}}
						>
							创建维护
						</Button>
					</>
				}
			/>

			<div className="flex gap-4 mb-4">
				<Select
					allowClear
					placeholder="状态"
					style={{ width: 160 }}
					value={filters.status}
					onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
				>
					<Option value="scheduled">已排期</Option>
					<Option value="in_progress">进行中</Option>
					<Option value="completed">已完成</Option>
					<Option value="cancelled">已取消</Option>
				</Select>
			</div>

			{error && <PageError message="加载维护列表失败" retry={refetch} className="mb-4" />}
			<DataTable
				rowKey="id"
				columns={columns}
				dataSource={data}
				loading={isLoading}
				pagination={{ pageSize: 10 }}
			/>

			<Modal
				title={editing ? '编辑维护' : '创建维护'}
				open={modalVisible}
				onCancel={() => {
					setModalVisible(false);
					setEditing(null);
					form.resetFields();
				}}
				onOk={() => form.submit()}
				width={640}
				destroyOnHidden
				// U412①：destroyOnHidden 弹窗首开前不渲染子树，forceRender 让表单随页挂载（消「未挂载即调用」告警）
				forceRender
			>
				<Form form={form} layout="vertical" onFinish={handleSave}>
					<Form.Item name="title" label="标题" rules={[{ required: true }]}>
						<Input placeholder="维护标题" />
					</Form.Item>
					<Form.Item name="description" label="描述">
						<TextArea rows={4} placeholder="维护描述" />
					</Form.Item>
					<Form.Item name="scheduledStartAt" label="计划开始时间" rules={[{ required: true }]}>
						<DatePicker showTime style={{ width: '100%' }} />
					</Form.Item>
					<Form.Item name="scheduledEndAt" label="计划结束时间" rules={[{ required: true }]}>
						<DatePicker showTime style={{ width: '100%' }} />
					</Form.Item>
					<Form.Item name="affectedServices" label="影响服务">
						<Input placeholder="多个服务用逗号分隔" />
					</Form.Item>
					{editing && (
						<Form.Item name="status" label="状态" initialValue="scheduled">
							<Select>
								<Option value="scheduled">已排期</Option>
								<Option value="in_progress">进行中</Option>
								<Option value="completed">已完成</Option>
								<Option value="cancelled">已取消</Option>
							</Select>
						</Form.Item>
					)}
				</Form>
			</Modal>
		</div>
	);
}
