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
				message.success(t('announcements.updateSuccess', '公告更新成功'));
			} else {
				const res = await createMut.mutateAsync(payload);
				const created = values.publishNow
					? extractItem<AnnouncementRecord>(res)
					: undefined;
				if (created?.id) {
					try {
						await publishMut.mutateAsync(created.id);
						message.success(t('announcements.createdAndPublished', '公告已创建并发布'));
					} catch (err) {
						handleApiError(err, t('announcements.savedDraftPublishFailed'));
					}
				} else {
					message.success(t('announcements.savedAsDraft'));
				}
			}
			setModalVisible(false);
			setEditing(null);
			form.resetFields();
		} catch (err) {
			handleApiError(err, t('common.saveFailed', '保存失败'));
		}
	};

	// PL-20：勾选「立即发布」时提交前二次确认（发布后对用户可见，非草稿可回退）
	const handleSave = async (values: AnnouncementFormValues) => {
		if (!editing && values.publishNow) {
			modal.confirm({
				title: t('announcements.confirmPublishNow', '确认立即发布？'),
				content: t('announcements.confirmPublishNowDetail'),
				okText: t('announcements.confirmPublish', '确认发布'),
				onOk: () => doSave(values),
			});
			return;
		}
		await doSave(values);
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteMut.mutateAsync(id);
			message.success(t('common.deleteSuccess', '删除成功'));
		} catch (err) {
			handleApiError(err, t('common.deleteFailed', '删除失败'));
		}
	};

	const handlePublish = async (id: string) => {
		try {
			await publishMut.mutateAsync(id);
			message.success(t('announcements.published', '公告已发布'));
		} catch (err) {
			handleApiError(err, t('announcements.publishFailed', '发布失败'));
		}
	};

	const handleUnpublish = async (id: string) => {
		try {
			await unpublishMut.mutateAsync(id);
			message.success(t('announcements.unpublished', '公告已撤回'));
		} catch (err) {
			handleApiError(err, t('announcements.unpublishFailed', '撤回失败'));
		}
	};

	const type = Form.useWatch('type', form);

	const columns = [
		{ title: t('announcements.colTitle', '标题'), dataIndex: 'title', key: 'title' },
		{
			title: t('announcements.colType', '类型'),
			key: 'type',
			// 由真实字段 targetRoles 推导（空 = 全员广播）；此前读幻影 record.type 恒显示「定向」（PL-18）
			render: (_: unknown, record: AnnouncementRecord) =>
				record.targetRoles?.length ? (
					<Tag color="orange">{t('announcements.type.targeted', '定向')}</Tag>
				) : (
					<Tag color="blue">{t('announcements.type.global', '全局')}</Tag>
				),
		},
		{
			title: t('announcements.colStatus', '发布状态'),
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => {
				const meta: Record<string, { color: string; label: string }> = {
					draft: { color: 'default', label: t('announcements.status.draft', '草稿') },
					scheduled: { color: 'processing', label: t('announcements.status.scheduled', '定时待发') },
					published: { color: 'success', label: t('announcements.status.published', '已发布') },
					expired: { color: 'gray', label: t('announcements.status.expired', '已过期') },
				};
				const m = meta[v];
				return <Tag color={m?.color ?? 'default'}>{m?.label ?? v}</Tag>;
			},
		},
		{
			// 此前读幻影 publishedAt 恒「-」；改读真实字段 publishAt（计划发布时间）。
			// 实际发布时刻后端无独立字段，W5（PL-17）复核口径。
			title: t('announcements.colPublishAt', '发布时间'),
			dataIndex: 'publishAt',
			key: 'publishAt',
			render: (v?: string) => v || '-',
		},
		{
			title: t('common.actions', '操作'),
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
						{t('common.edit', '编辑')}
					</Button>
					{(record.status === 'draft' || record.status === 'scheduled') && (
						<Popconfirm
							title={t('announcements.confirmPublishTitle', '确认发布该公告？')}
							description={t('announcements.confirmPublishDesc')}
							okText={t('announcements.confirmPublish', '确认发布')}
							onConfirm={() => handlePublish(record.id)}
						>
							<Button
								type="text"
								size="small"
								icon={<Send size="1em" />}
								loading={publishMut.isPending}
							>
								{t('announcements.publish', '发布')}
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
								{t('announcements.unpublish', '撤回')}
						</Button>
					)}
					<Popconfirm title={t('announcements.confirmDelete', '确认删除该公告？')} onConfirm={() => handleDelete(record.id)}>
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
							{t('announcements.create', '发布公告')}
						</Button>
					</>
				}
			/>

			{error && <PageError message={t('announcements.loadError', '加载公告列表失败')} retry={refetch} className="mb-4" />}
			<DataTable
				rowKey="id"
				columns={columns}
				dataSource={data}
				loading={isLoading}
				pagination={{ pageSize: 10 }}
			/>

			<Modal
				title={editing ? t('announcements.editTitle', '编辑公告') : t('announcements.create', '发布公告')}
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
					<Form.Item name="title" label={t('announcements.colTitle', '标题')} rules={[{ required: true }]}>
						<Input placeholder={t('announcements.titlePlaceholder', '公告标题')} />
					</Form.Item>
					<Form.Item name="content" label={t('announcements.contentLabel', '内容')} rules={[{ required: true }]}>
						<TextArea rows={6} placeholder={t('announcements.contentPlaceholder', '公告正文，支持 HTML')} />
					</Form.Item>
					<Form.Item name="type" label={t('announcements.colType', '类型')} rules={[{ required: true }]} initialValue="global">
						<Select placeholder={t('announcements.typePlaceholder', '选择类型')}>
							<Option value="global">{t('announcements.type.globalOption', '全局（所有用户）')}</Option>
							<Option value="targeted">{t('announcements.type.targetedOption', '定向（按角色）')}</Option>
						</Select>
					</Form.Item>
					{type === 'targeted' && (
						<Form.Item
							name="targetRoles"
							label={t('announcements.targetRolesLabel', '目标角色')}
							rules={[{ required: true, type: 'array', message: t('announcements.targetRolesRequired', '请选择至少一个目标角色') }]}
						>
							<Select mode="multiple" allowClear placeholder={t('announcements.targetRolesPlaceholder')}>
								<Option value="owner">{t('announcements.role.owner', '所有者 (Owner)')}</Option>
								<Option value="admin">{t('announcements.role.admin', '管理员 (Admin)')}</Option>
								<Option value="member">{t('announcements.role.member', '成员 (Member)')}</Option>
							</Select>
						</Form.Item>
					)}
					{!editing && (
						<Form.Item name="publishNow" valuePropName="checked" initialValue={false} className="mb-0">
							<Checkbox>{t('announcements.publishNowHint')}</Checkbox>
						</Form.Item>
					)}
				</Form>
			</Modal>
		</div>
	);
}
