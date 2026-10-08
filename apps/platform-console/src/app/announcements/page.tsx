'use client';

import React, { useState } from 'react';
import { Button, Space, Tag, Form, Input, Select, Popconfirm, Checkbox } from 'antd';
import { message, modal } from '@/lib/antd-app';
import {
	Pencil,
	Plus,
	Send,
	Trash2,
	Undo2,
} from 'lucide-react';
import {
	useAnnouncements,
	useCreateAnnouncement,
	useUpdateAnnouncement,
	useDeleteAnnouncement,
	usePublishAnnouncement,
	useUnpublishAnnouncement,
	type AnnouncementRecord,
} from '@/hooks/use-announcements';
import { handleApiError } from '@/lib/error-handler';
import { extractItem, usePageTitle } from '@autional/shared';
import { PageError, DataTable, Modal } from '@autional/ui/antd';
import { AppPageHeader } from '@autional/ui';
import { useTranslation } from 'react-i18next';

const { Option } = Select;
const { TextArea } = Input;

interface AnnouncementFormValues {
	title: string;
	content: string;
	type: 'global' | 'targeted';
	targetRoles?: string[];
	publishNow?: boolean;
}

export default function AnnouncementsPage() {
	const { t } = useTranslation();
	usePageTitle(t('announcements.title', '平台公告'));
	const [modalVisible, setModalVisible] = useState(false);
	const [editing, setEditing] = useState<AnnouncementRecord | null>(null);
	const [form] = Form.useForm<AnnouncementFormValues>();

	const { data = [], isLoading, error, refetch } = useAnnouncements();
	const createMut = useCreateAnnouncement();
	const updateMut = useUpdateAnnouncement();
	const deleteMut = useDeleteAnnouncement();
	const publishMut = usePublishAnnouncement();
	const unpublishMut = useUnpublishAnnouncement();

	// PL-76：payload 只发真实契约字段（title/content/targetRoles）；
	// 「立即发布」走真实 publish 端点（创建恒为草稿，发布需显式调用）
	const doSave = async (values: AnnouncementFormValues) => {
		const payload = {
			title: values.title,
			content: values.content,
			targetRoles: values.type === 'targeted' ? (values.targetRoles ?? []) : [],
		};
		try {
			if (editing) {
				await updateMut.mutateAsync({ id: editing.id, data: payload });
				message.success('公告更新成功');
			} else {
				const res = await createMut.mutateAsync(payload);
				const created = values.publishNow
					? extractItem<AnnouncementRecord>(res)
					: undefined;
				if (created?.id) {
					try {
						await publishMut.mutateAsync(created.id);
						message.success('公告已创建并发布');
					} catch (err) {
						handleApiError(err, '公告已保存为草稿，但立即发布失败');
					}
				} else {
					message.success('公告已保存为草稿，可在列表中发布');
				}
			}
			setModalVisible(false);
			setEditing(null);
			form.resetFields();
		} catch (err) {
			handleApiError(err, '保存失败');
		}
	};

	// PL-20：勾选「立即发布」时提交前二次确认（发布后对用户可见，非草稿可回退）
	const handleSave = async (values: AnnouncementFormValues) => {
		if (!editing && values.publishNow) {
			modal.confirm({
				title: '确认立即发布？',
				content: '公告将直接发布，对用户可见；如需先审阅请取消并改用「保存为草稿」。',
				okText: '确认发布',
				onOk: () => doSave(values),
			});
			return;
		}
		await doSave(values);
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteMut.mutateAsync(id);
			message.success('删除成功');
		} catch (err) {
			handleApiError(err, '删除失败');
		}
	};

	const handlePublish = async (id: string) => {
		try {
			await publishMut.mutateAsync(id);
			message.success('公告已发布');
		} catch (err) {
			handleApiError(err, '发布失败');
		}
	};

	const handleUnpublish = async (id: string) => {
		try {
			await unpublishMut.mutateAsync(id);
			message.success('公告已撤回');
		} catch (err) {
			handleApiError(err, '撤回失败');
		}
	};

	const type = Form.useWatch('type', form);

	const columns = [
		{ title: '标题', dataIndex: 'title', key: 'title' },
		{
			title: '类型',
			key: 'type',
			// 由真实字段 targetRoles 推导（空 = 全员广播）；此前读幻影 record.type 恒显示「定向」（PL-18）
			render: (_: unknown, record: AnnouncementRecord) =>
				record.targetRoles?.length ? (
					<Tag color="orange">定向</Tag>
				) : (
					<Tag color="blue">全局</Tag>
				),
		},
		{
			title: '发布状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => {
				const meta: Record<string, { color: string; label: string }> = {
					draft: { color: 'default', label: '草稿' },
					scheduled: { color: 'processing', label: '定时待发' },
					published: { color: 'success', label: '已发布' },
					expired: { color: 'gray', label: '已过期' },
				};
				const m = meta[v];
				return <Tag color={m?.color ?? 'default'}>{m?.label ?? v}</Tag>;
			},
		},
		{
			// 此前读幻影 publishedAt 恒「-」；改读真实字段 publishAt（计划发布时间）。
			// 实际发布时刻后端无独立字段，W5（PL-17）复核口径。
			title: '发布时间',
			dataIndex: 'publishAt',
			key: 'publishAt',
			render: (v?: string) => v || '-',
		},
		{
			title: '操作',
			key: 'action',
			render: (_: any, record: AnnouncementRecord) => (
				<Space size="small">
					<Button
						type="text"
						size="small"
						icon={<Pencil size="1em" />}
						onClick={() => {
							setEditing(record);
							form.setFieldsValue({
								title: record.title,
								content: record.content,
								type: record.targetRoles?.length ? 'targeted' : 'global',
								targetRoles: record.targetRoles,
							});
							setModalVisible(true);
						}}
					>
						编辑
					</Button>
					{(record.status === 'draft' || record.status === 'scheduled') && (
						<Popconfirm
							title="确认发布该公告？"
							description="发布后公告将立即对所有用户可见。"
							okText="确认发布"
							onConfirm={() => handlePublish(record.id)}
						>
							<Button
								type="text"
								size="small"
								icon={<Send size="1em" />}
								loading={publishMut.isPending}
							>
								发布
							</Button>
						</Popconfirm>
					)}
					{record.status === 'published' && (
						<Button
							type="text"
							size="small"
							icon={<Undo2 size="1em" />}
							onClick={() => handleUnpublish(record.id)}
							loading={unpublishMut.isPending}
						>
							撤回
						</Button>
					)}
					<Popconfirm title="确认删除该公告？" onConfirm={() => handleDelete(record.id)}>
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
				title={t('announcements.title', '平台公告')}
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
							发布公告
						</Button>
					</>
				}
			/>

			{error && <PageError message="加载公告列表失败" retry={refetch} className="mb-4" />}
			<DataTable
				rowKey="id"
				columns={columns}
				dataSource={data}
				loading={isLoading}
				pagination={{ pageSize: 10 }}
			/>

			<Modal
				title={editing ? '编辑公告' : '发布公告'}
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
						<Input placeholder="公告标题" />
					</Form.Item>
					<Form.Item name="content" label="内容" rules={[{ required: true }]}>
						<TextArea rows={6} placeholder="公告正文，支持 HTML" />
					</Form.Item>
					<Form.Item name="type" label="类型" rules={[{ required: true }]} initialValue="global">
						<Select placeholder="选择类型">
							<Option value="global">全局（所有用户）</Option>
							<Option value="targeted">定向（按角色）</Option>
						</Select>
					</Form.Item>
					{type === 'targeted' && (
						<Form.Item
							name="targetRoles"
							label="目标角色"
							rules={[{ required: true, type: 'array', message: '请选择至少一个目标角色' }]}
						>
							<Select mode="multiple" allowClear placeholder="选择目标角色，仅这些角色的用户会收到公告">
								<Option value="owner">所有者 (Owner)</Option>
								<Option value="admin">管理员 (Admin)</Option>
								<Option value="member">成员 (Member)</Option>
							</Select>
						</Form.Item>
					)}
					{!editing && (
						<Form.Item name="publishNow" valuePropName="checked" initialValue={false} className="mb-0">
							<Checkbox>创建后立即发布（默认保存为草稿，可在列表中再发布）</Checkbox>
						</Form.Item>
					)}
				</Form>
			</Modal>
		</div>
	);
}
