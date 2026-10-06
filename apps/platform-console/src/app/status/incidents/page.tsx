'use client';

import React, { useState, useEffect } from 'react';
import { Button, Space, Modal, Form, Input, Select, Popconfirm, Descriptions } from 'antd';
import { message } from '@/lib/antd-app';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
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
import { DataTable, Drawer, PageError } from '@autional/ui/antd';
import { ConsolePageHeader, StatusBadge } from '@autional/ui';
import { severityBadge, severityLabels, statusBadge, statusLabels } from '@/lib/incident-meta';

const { Option } = Select;
const { TextArea } = Input;

export default function IncidentsPage() {
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
				message.success('事件更新成功');
			} else {
				await createMut.mutateAsync(payload);
				message.success('事件创建成功');
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

	const handleAddUpdate = async (values: any) => {
		if (!drawerId) return;
		try {
			await updateAddMut.mutateAsync({
				id: drawerId,
				data: { message: values.message, status: values.status },
			});
			message.success('进展已添加');
			updateForm.resetFields();
		} catch (err) {
			handleApiError(err, '添加进展失败');
		}
	};

	const columns = [
		{ title: '标题', dataIndex: 'title', key: 'title' },
		{
			title: '严重级别',
			dataIndex: 'severity',
			key: 'severity',
			render: (v: string) => (
				<StatusBadge variant={severityBadge[v]}>{severityLabels[v] || v}</StatusBadge>
			),
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => (
				<StatusBadge variant={statusBadge[v]}>{statusLabels[v] || v}</StatusBadge>
			),
		},
		{
			title: '影响服务',
			dataIndex: 'affectedServices',
			key: 'affectedServices',
			render: (v?: string[]) => (v && v.length > 0 ? v.join(', ') : '-'),
		},
		{
			title: '创建时间',
			dataIndex: 'createdAt',
			key: 'createdAt',
			render: (v?: string) => (v ? formatDateTime(v) : '-'),
		},
		{
			title: '操作',
			key: 'action',
			render: (_: any, record: IncidentRecord) => (
				<Space size="small">
					<Button
						type="text"
						size="small"
						icon={<EyeOutlined />}
						onClick={() => setDrawerId(record.id)}
					>
						详情
					</Button>
					<Button
						type="text"
						size="small"
						icon={<EditOutlined />}
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
						编辑
					</Button>
					<Popconfirm title="确认删除该事件？" onConfirm={() => handleDelete(record.id)}>
						<Button type="text" danger size="small" icon={<DeleteOutlined />}>
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
				title="事件管理"
				actions={
					<>
						<Button
							type="primary"
							icon={<PlusOutlined />}
							onClick={() => {
								setEditing(null);
								form.resetFields();
								setModalVisible(true);
							}}
						>
							创建事件
						</Button>
					</>
				}
			/>

			<div className="flex gap-4 mb-4">
				<Select
					allowClear
					placeholder="严重级别"
					style={{ width: 160 }}
					value={filters.severity}
					onChange={(v) => setFilters((f) => ({ ...f, severity: v }))}
				>
					<Option value="critical">严重</Option>
					<Option value="major">重大</Option>
					<Option value="minor">轻微</Option>
					<Option value="maintenance">维护</Option>
				</Select>
				<Select
					allowClear
					placeholder="状态"
					style={{ width: 160 }}
					value={filters.status}
					onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
				>
					<Option value="investigating">调查中</Option>
					<Option value="identified">已定位</Option>
					<Option value="monitoring">监控中</Option>
					<Option value="resolved">已解决</Option>
					<Option value="draft">草稿</Option>
				</Select>
			</div>

			{error && <PageError message="加载事件列表失败" retry={refetch} className="mb-4" />}
			<DataTable
				rowKey="id"
				columns={columns}
				dataSource={data}
				loading={isLoading}
				pagination={{ pageSize: 10 }}
			/>

			<Modal
				title={editing ? '编辑事件' : '创建事件'}
				open={modalVisible}
				onCancel={() => {
					setModalVisible(false);
					setEditing(null);
					form.resetFields();
				}}
				onOk={() => form.submit()}
				width={640}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" onFinish={handleSave}>
					<Form.Item name="title" label="标题" rules={[{ required: true }]}>
						<Input placeholder="事件标题" />
					</Form.Item>
					<Form.Item name="description" label="描述">
						<TextArea rows={4} placeholder="事件描述" />
					</Form.Item>
					<Form.Item name="severity" label="严重级别" rules={[{ required: true }]}>
						<Select placeholder="选择严重级别">
							<Option value="critical">严重</Option>
							<Option value="major">重大</Option>
							<Option value="minor">轻微</Option>
							<Option value="maintenance">维护</Option>
						</Select>
					</Form.Item>
					<Form.Item name="status" label="状态" initialValue="investigating">
						<Select>
							<Option value="investigating">调查中</Option>
							<Option value="identified">已定位</Option>
							<Option value="monitoring">监控中</Option>
							<Option value="resolved">已解决</Option>
							<Option value="draft">草稿</Option>
						</Select>
					</Form.Item>
					<Form.Item name="affectedServices" label="影响服务">
						<Input placeholder="多个服务用逗号分隔" />
					</Form.Item>
				</Form>
			</Modal>

			<Drawer
				title="事件详情"
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
							<Descriptions.Item label="标题">{drawerIncident.title}</Descriptions.Item>
							<Descriptions.Item label="严重级别">
								<StatusBadge variant={severityBadge[drawerIncident.severity]}>
									{severityLabels[drawerIncident.severity] || drawerIncident.severity}
								</StatusBadge>
							</Descriptions.Item>
							<Descriptions.Item label="状态">
								<StatusBadge variant={statusBadge[drawerIncident.status]}>
									{statusLabels[drawerIncident.status] || drawerIncident.status}
								</StatusBadge>
							</Descriptions.Item>
							<Descriptions.Item label="影响服务">
								{drawerIncident.affectedServices?.join(', ') || '-'}
							</Descriptions.Item>
							<Descriptions.Item label="描述" span={2}>
								{drawerIncident.description || '-'}
							</Descriptions.Item>
							<Descriptions.Item label="创建时间">
								{drawerIncident.createdAt ? formatDateTime(drawerIncident.createdAt) : '-'}
							</Descriptions.Item>
							<Descriptions.Item label="解决时间">
								{drawerIncident.resolvedAt ? formatDateTime(drawerIncident.resolvedAt) : '-'}
							</Descriptions.Item>
						</Descriptions>

						<h3 className="text-lg font-semibold mb-3">进展更新</h3>
						{drawerIncident.updates && drawerIncident.updates.length > 0 ? (
							<div className="space-y-3 mb-6">
								{drawerIncident.updates.map((u) => (
									<div key={u.id} className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded">
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
							<p className="text-neutral-600 mb-6">暂无进展记录</p>
						)}

						<h3 className="text-lg font-semibold mb-3">添加进展</h3>
						{/* PL-22：preserve=false —— 抽屉关闭卸载时清空字段值，避免草稿在重开时复活 */}
						<Form
							form={updateForm}
							layout="vertical"
							onFinish={handleAddUpdate}
							preserve={false}
						>
							<Form.Item name="message" label="进展描述" rules={[{ required: true }]}>
								<TextArea rows={3} placeholder="输入事件进展信息" />
							</Form.Item>
							<Form.Item name="status" label="更新状态" initialValue={drawerIncident.status}>
								<Select>
									<Option value="investigating">调查中</Option>
									<Option value="identified">已定位</Option>
									<Option value="monitoring">监控中</Option>
									<Option value="resolved">已解决</Option>
								</Select>
							</Form.Item>
							<Button type="primary" htmlType="submit" loading={updateAddMut.isPending}>
								提交进展
							</Button>
						</Form>
					</>
				)}
			</Drawer>
		</div>
	);
}
