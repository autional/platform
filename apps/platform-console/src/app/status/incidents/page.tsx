'use client';

import React, { useState, useEffect } from 'react';
import { Button, Space, Form, Input, Select, Popconfirm, Descriptions } from 'antd';
import { message } from '@/lib/antd-app';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import {
	useIncidents,
	useIncident,
	useCreateIncident,
	useUpdateIncident,
	useDeleteIncident,
	useAddIncidentUpdate,
} from '@/hooks/use-status';
import type { IncidentRecord } from '@/hooks/use-status';
import { handleApiError } from '@/lib/error-handler';
import { formatDateTime } from '@/lib/format';
import { DataTable, Drawer, Modal, PageError } from '@autional/ui/antd';
import { AppPageHeader, StatusBadge } from '@autional/ui';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@autional/shared';
import { severityBadge, severityLabels, statusBadge, statusLabels } from '@/lib/incident-meta';

const { Option } = Select;
const { TextArea } = Input;

export default function IncidentsPage() {
	const { t } = useTranslation();
	usePageTitle(t('incidents.title', '事故管理'));
	const [modalVisible, setModalVisible] = useState(false);
	const [editing, setEditing] = useState<IncidentRecord | null>(null);
	const [drawerId, setDrawerId] = useState<string | null>(null);
	const [filters, setFilters] = useState<{ severity?: string; status?: string }>({});
	const [form] = Form.useForm();
	const [updateForm] = Form.useForm();

	const {
		data = [],
		isLoading,
		error,
		refetch,
	} = useIncidents(Object.keys(filters).length > 0 ? filters : undefined);
	const { data: drawerIncident, isLoading: drawerLoading } = useIncident(drawerId || '');

	// PL-22：详情记录切换时重置「添加进展」表单（清掉上一条记录的草稿 / 状态默认值）。
	// 仅靠 Form key 重建不够：新表单子树先渲染、旧字段卸载清理后，无 initialValue 的
	// 字段（进展描述）不会再重渲染，DOM 会残留上一条的草稿。resetFields 会广播 reset
	// 事件，令所有字段强制刷新并回落到各自 initialValue。
	useEffect(() => {
		if (drawerIncident?.id) {
			updateForm.resetFields();
		}
	}, [drawerIncident?.id, updateForm]);

	const createMut = useCreateIncident();
	const updateMut = useUpdateIncident();
	const deleteMut = useDeleteIncident();
	const updateAddMut = useAddIncidentUpdate();

	const handleSave = async (values: any) => {
		try {
			const payload = {
				title: values.title,
				description: values.description,
				severity: values.severity,
				status: values.status,
				affectedServices: values.affectedServices
					? values.affectedServices
							.split(',')
							.map((s: string) => s.trim())
							.filter(Boolean)
					: undefined,
			};
			if (editing) {
				await updateMut.mutateAsync({ id: editing.id, data: payload });
				message.success(t('incidents.updateSuccess', '事故更新成功'));
			} else {
				await createMut.mutateAsync(payload);
				message.success(t('incidents.createSuccess', '事故创建成功'));
			}
			setModalVisible(false);
			setEditing(null);
			form.resetFields();
		} catch (err) {
			handleApiError(err, t('common.saveFailed', '保存失败'));
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteMut.mutateAsync(id);
			message.success(t('common.deleteSuccess', '删除成功'));
		} catch (err) {
			handleApiError(err, t('common.deleteFailed', '删除失败'));
		}
	};

	const handleAddUpdate = async (values: any) => {
		if (!drawerId) return;
		try {
			await updateAddMut.mutateAsync({
				id: drawerId,
				data: { message: values.message, status: values.status },
			});
			message.success(t('incidents.updateAdded', '进展已添加'));
			updateForm.resetFields();
		} catch (err) {
			handleApiError(err, t('incidents.addUpdateFailed', '添加进展失败'));
		}
	};

	const columns = [
		{ title: t('incidents.colTitle', '标题'), dataIndex: 'title', key: 'title' },
		{
			title: t('incidents.colSeverity', '严重级别'),
			dataIndex: 'severity',
			key: 'severity',
			render: (v: string) => (
				<StatusBadge variant={severityBadge[v]}>{severityLabels[v] || v}</StatusBadge>
			),
		},
		{
			title: t('common.status', '状态'),
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => (
				<StatusBadge variant={statusBadge[v]}>{statusLabels[v] || v}</StatusBadge>
			),
		},
		{
			title: t('incidents.colAffectedServices', '影响服务'),
			dataIndex: 'affectedServices',
			key: 'affectedServices',
			render: (v?: string[]) => (v && v.length > 0 ? v.join(', ') : '-'),
		},
		{
			title: t('incidents.colCreatedAt', '创建时间'),
			dataIndex: 'createdAt',
			key: 'createdAt',
			render: (v?: string) => (v ? formatDateTime(v) : '-'),
		},
		{
			title: t('common.actions', '操作'),
			key: 'action',
			render: (_: any, record: IncidentRecord) => (
				<Space size="small">
					<Button
						type="text"
						size="small"
						icon={<Eye size="1em" />}
						onClick={() => setDrawerId(record.id)}
					>
						{t('common.details', '详情')}
					</Button>
					<Button
						type="text"
						size="small"
						icon={<Pencil size="1em" />}
						onClick={() => {
							setEditing(record);
							form.setFieldsValue({
								title: record.title,
								description: record.description,
								severity: record.severity,
								status: record.status,
								affectedServices: record.affectedServices?.join(', '),
							});
							setModalVisible(true);
						}}
					>
						{t('common.edit', '编辑')}
					</Button>
					<Popconfirm
						title={t('incidents.confirmDelete', '确认删除该事故？')}
						onConfirm={() => handleDelete(record.id)}
					>
						<Button type="text" danger size="small" icon={<Trash2 size="1em" />}>
							{t('common.delete', '删除')}
						</Button>
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<div>
			<AppPageHeader
				title={t('incidents.title', '事故管理')}
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
							{t('incidents.createTitle', '创建事故')}
						</Button>
					</>
				}
			/>

			<div className="flex gap-4 mb-4">
				<Select
					allowClear
					placeholder={t('incidents.colSeverity', '严重级别')}
					style={{ width: 160 }}
					value={filters.severity}
					onChange={(v) => setFilters((f) => ({ ...f, severity: v }))}
				>
					<Option value="critical">{t('incidents.severity.critical', '严重')}</Option>
					<Option value="major">{t('incidents.severity.major', '重大')}</Option>
					<Option value="minor">{t('incidents.severity.minor', '轻微')}</Option>
					<Option value="maintenance">{t('incidents.severity.maintenance', '维护')}</Option>
				</Select>
				<Select
					allowClear
					placeholder={t('common.status', '状态')}
					style={{ width: 160 }}
					value={filters.status}
					onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
				>
					<Option value="investigating">{t('incidents.status.investigating', '调查中')}</Option>
					<Option value="identified">{t('incidents.status.identified', '已定位')}</Option>
					<Option value="monitoring">{t('incidents.status.monitoring', '监控中')}</Option>
					<Option value="resolved">{t('incidents.status.resolved', '已解决')}</Option>
					<Option value="draft">{t('incidents.status.draft', '草稿')}</Option>
				</Select>
			</div>

			{error && <PageError message={t('incidents.loadError', '加载事故列表失败')} retry={refetch} className="mb-4" />}
			<DataTable
				rowKey="id"
				columns={columns}
				dataSource={data}
				loading={isLoading}
				pagination={{ pageSize: 10 }}
			/>

			<Modal
				title={editing ? t('incidents.editTitle', '编辑事故') : t('incidents.createTitle', '创建事故')}
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
					<Form.Item name="title" label={t('incidents.colTitle', '标题')} rules={[{ required: true }]}>
						<Input placeholder={t('incidents.titlePlaceholder', '事故标题')} />
					</Form.Item>
					<Form.Item name="description" label={t('incidents.descriptionLabel', '描述')}>
						<TextArea rows={4} placeholder={t('incidents.descriptionPlaceholder', '事故描述')} />
					</Form.Item>
					<Form.Item name="severity" label={t('incidents.colSeverity', '严重级别')} rules={[{ required: true }]}>
						<Select placeholder={t('incidents.severityPlaceholder', '选择严重级别')}>
							<Option value="critical">{t('incidents.severity.critical', '严重')}</Option>
							<Option value="major">{t('incidents.severity.major', '重大')}</Option>
							<Option value="minor">{t('incidents.severity.minor', '轻微')}</Option>
							<Option value="maintenance">{t('incidents.severity.maintenance', '维护')}</Option>
						</Select>
					</Form.Item>
					<Form.Item name="status" label={t('common.status', '状态')} initialValue="investigating">
						<Select>
							<Option value="investigating">{t('incidents.status.investigating', '调查中')}</Option>
							<Option value="identified">{t('incidents.status.identified', '已定位')}</Option>
							<Option value="monitoring">{t('incidents.status.monitoring', '监控中')}</Option>
							<Option value="resolved">{t('incidents.status.resolved', '已解决')}</Option>
							<Option value="draft">{t('incidents.status.draft', '草稿')}</Option>
						</Select>
					</Form.Item>
					<Form.Item name="affectedServices" label={t('incidents.colAffectedServices', '影响服务')}>
						<Input placeholder={t('incidents.servicesPlaceholder', '多个服务用逗号分隔')} />
					</Form.Item>
				</Form>
			</Modal>

			<Drawer
				title={t('incidents.detailTitle', '事故详情')}
				open={!!drawerId}
				onClose={() => {
					setDrawerId(null);
				}}
				size="md"
				loading={drawerLoading}
			>
				{drawerIncident && (
					<>
						<Descriptions column={2} bordered size="small" className="mb-6">
							<Descriptions.Item label={t('incidents.colTitle', '标题')}>{drawerIncident.title}</Descriptions.Item>
							<Descriptions.Item label={t('incidents.colSeverity', '严重级别')}>
								<StatusBadge variant={severityBadge[drawerIncident.severity]}>
									{severityLabels[drawerIncident.severity] || drawerIncident.severity}
								</StatusBadge>
							</Descriptions.Item>
							<Descriptions.Item label={t('common.status', '状态')}>
								<StatusBadge variant={statusBadge[drawerIncident.status]}>
									{statusLabels[drawerIncident.status] || drawerIncident.status}
								</StatusBadge>
							</Descriptions.Item>
							<Descriptions.Item label={t('incidents.colAffectedServices', '影响服务')}>
								{drawerIncident.affectedServices?.join(', ') || '-'}
							</Descriptions.Item>
							<Descriptions.Item label={t('incidents.descriptionLabel', '描述')} span={2}>
								{drawerIncident.description || '-'}
							</Descriptions.Item>
							<Descriptions.Item label={t('incidents.colCreatedAt', '创建时间')}>
								{drawerIncident.createdAt ? formatDateTime(drawerIncident.createdAt) : '-'}
							</Descriptions.Item>
							<Descriptions.Item label={t('incidents.resolvedAt', '解决时间')}>
								{drawerIncident.resolvedAt ? formatDateTime(drawerIncident.resolvedAt) : '-'}
							</Descriptions.Item>
						</Descriptions>

						<h3 className="text-lg font-semibold mb-3">{t('incidents.updates', '进展更新')}</h3>
						{drawerIncident.updates && drawerIncident.updates.length > 0 ? (
							<div className="space-y-3 mb-6">
								{drawerIncident.updates.map((u) => (
									<div key={u.id} className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xs">
										<div className="flex items-center gap-2 mb-1">
											<StatusBadge variant={statusBadge[u.status]}>
												{statusLabels[u.status] || u.status}
											</StatusBadge>
											<span className="text-xs text-neutral-600">
												{u.createdAt ? formatDateTime(u.createdAt) : '-'}
											</span>
										</div>
										<p className="text-sm">{u.message}</p>
									</div>
								))}
							</div>
						) : (
							<p className="text-neutral-600 mb-6">{t('incidents.noUpdates', '暂无进展记录')}</p>
						)}

						<h3 className="text-lg font-semibold mb-3">{t('incidents.addUpdate', '添加进展')}</h3>
						{/* PL-22：preserve=false —— 抽屉关闭卸载时清空字段值，避免草稿在重开时复活 */}
						<Form
							form={updateForm}
							layout="vertical"
							onFinish={handleAddUpdate}
							preserve={false}
						>
							<Form.Item name="message" label={t('incidents.updateMessageLabel', '进展描述')} rules={[{ required: true }]}>
								<TextArea rows={3} placeholder={t('incidents.updateMessagePlaceholder', '输入事故进展信息')} />
							</Form.Item>
							<Form.Item name="status" label={t('incidents.updateStatusLabel', '更新状态')} initialValue={drawerIncident.status}>
								<Select>
									<Option value="investigating">{t('incidents.status.investigating', '调查中')}</Option>
									<Option value="identified">{t('incidents.status.identified', '已定位')}</Option>
									<Option value="monitoring">{t('incidents.status.monitoring', '监控中')}</Option>
									<Option value="resolved">{t('incidents.status.resolved', '已解决')}</Option>
								</Select>
							</Form.Item>
							<Button type="primary" htmlType="submit" loading={updateAddMut.isPending}>
								{t('incidents.submitUpdate', '提交进展')}
							</Button>
						</Form>
					</>
				)}
			</Drawer>
		</div>
	);
}
