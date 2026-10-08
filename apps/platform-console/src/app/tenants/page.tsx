'use client';

import React, { useState } from 'react';
import { Button, Space, Tag, Form, Input, Select, Card, Descriptions, Tabs, Popconfirm, Row, Col } from 'antd';
import { message } from '@/lib/antd-app';
import {
	Eye,
	PauseCircle,
	Pencil,
	Play,
	Plus,
	Trash2,
} from 'lucide-react';
import {
	useTenants,
	useCreateTenant,
	useUpdateTenant,
	useDeleteTenant,
	useActivateTenant,
	useSuspendTenant,
	type TenantRecord,
} from '@/hooks/use-tenants';
import { handleApiError } from '@/lib/error-handler';
import { formatDateTime } from '@/lib/format';
import { DataTable, Drawer, Modal, PageError } from '@autional/ui/antd';
import { Alert, AppPageHeader } from '@autional/ui';
import { useMembers } from '@/hooks/use-members';
import { useApplications } from '@/hooks/use-applications';
import { useNavigate } from 'react-router';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { useTranslation } from 'react-i18next';
import { buildNavHref } from '@/lib/nav';
import { ROUTE } from '@/lib/route-paths';

const { Option } = Select;

const TENANT_STATUS_MAP: Record<string, { label: string; color: string }> = {
	active: { label: '正常', color: 'success' },
	suspended: { label: '已暂停', color: 'error' },
	pending: { label: '待激活', color: 'warning' },
};

const renderTenantStatus = (status?: string) => {
	const meta = TENANT_STATUS_MAP[status ?? ''] ?? { label: status || '-', color: 'default' };
	return <Tag color={meta.color}>{meta.label}</Tag>;
};

export default function TenantsPage() {
	const { t } = useTranslation();
	usePageTitle(t('tenants.title', '租户管理'));
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	const [modalVisible, setModalVisible] = useState(false);
	const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
	const [editing, setEditing] = useState<TenantRecord | null>(null);
	const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
	const [detailData, setDetailData] = useState<any>({});
	const detailTenantId = selectedTenant?.id || '';
	const detailCreatedAt: string | undefined =
		detailData.info?.createdAt || selectedTenant?.createdAt;
	const {
		data: detailMembers = [],
		isLoading: detailMembersLoading,
		error: membersError,
		refetch: membersRefetch,
	} = useMembers(detailTenantId);
	const {
		data: detailApps = [],
		isLoading: detailAppsLoading,
		error: applicationsError,
		refetch: applicationsRefetch,
	} = useApplications(detailTenantId);
	const [form] = Form.useForm();

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [keyword, setKeyword] = useState('');

	const { data, isLoading, refetch, error } = useTenants({
		page,
		pageSize,
		search: keyword || undefined,
	});
	const tenants = data?.items ?? [];
	const total = data?.total ?? 0;
	const createTenantMutation = useCreateTenant();
	const updateTenantMutation = useUpdateTenant();
	const deleteTenantMutation = useDeleteTenant();
	const activateTenantMutation = useActivateTenant();
	const suspendTenantMutation = useSuspendTenant();

	const handleSave = async (values: any) => {
		try {
			if (editing) {
				await updateTenantMutation.mutateAsync({ id: editing.id, data: values });
				message.success('租户更新成功');
			} else {
				await createTenantMutation.mutateAsync(values);
				message.success('租户创建成功');
			}
			setModalVisible(false);
			setEditing(null);
			form.resetFields();
			refetch();
		} catch (err) {
			handleApiError(err, '保存失败');
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteTenantMutation.mutateAsync(id);
			message.success('删除成功');
			refetch();
		} catch (err) {
			handleApiError(err, '删除失败');
		}
	};

	const handleActivate = async (id: string) => {
		try {
			await activateTenantMutation.mutateAsync(id);
			message.success('租户已激活');
			refetch();
		} catch (err) {
			handleApiError(err, '操作失败');
		}
	};

	const handleSuspend = async (id: string) => {
		try {
			await suspendTenantMutation.mutateAsync(id);
			message.success('租户已暂停');
			refetch();
		} catch (err) {
			handleApiError(err, '操作失败');
		}
	};

	const openDetail = (record: TenantRecord) => {
		setSelectedTenant(record);
		setDetailDrawerVisible(true);
		setDetailData({ info: record });
	};

	// PL-10：配额 / 邀请配置此前零 UI 入口（仅直达 URL 可达），挂进详情抽屉
	const goTenantSubPage = (route: string) => {
		if (!selectedTenant) return;
		navigate(buildNavHref(route.replace(':id', selectedTenant.id), tenantSlug));
	};

	const columns = [
		{ title: '租户 ID', dataIndex: 'id', key: 'id', ellipsis: true },
		// U414②：name 是租户标识（URL slug，见创建表单「租户标识」口径），显示名称单列展示
		{ title: '租户标识', dataIndex: 'name', key: 'name' },
		{ title: '显示名称', dataIndex: 'displayName', key: 'displayName', render: (v?: string) => v || '-' },
		{ title: '域名', dataIndex: 'domain', key: 'domain', render: (v?: string) => v || '-' },
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (status: string) => renderTenantStatus(status),
		},
		{ title: '套餐', dataIndex: 'plan', key: 'plan', render: (v?: string) => v || '-' },
		{
			title: '成员数',
			dataIndex: 'memberCount',
			key: 'memberCount',
			render: (v?: number) => v ?? '-',
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
			// PL-07：操作列固定到右侧 + 显式宽度不可省——table-layout:fixed 下
			// pinned 列只分到均摊的 150px，装不下四个按钮（实测内容需 309px）
			width: 320,
			fixed: 'right' as const,
			render: (_: any, record: TenantRecord) => (
				<Space size="small">
					<Button
						type="text"
						size="small"
						icon={<Eye size="1em" />}
						onClick={() => openDetail(record)}
					>
						详情
					</Button>
					{record.status === 'active' ? (
						<Button
							type="text"
							size="small"
							icon={<PauseCircle size="1em" />}
							onClick={() => handleSuspend(record.id)}
						>
							暂停
						</Button>
					) : (
						<Button
							type="text"
							size="small"
							icon={<Play size="1em" />}
							onClick={() => handleActivate(record.id)}
						>
							激活
						</Button>
					)}
					<Button
						type="text"
						size="small"
						icon={<Pencil size="1em" />}
						onClick={() => {
							setEditing(record);
							form.setFieldsValue({
								name: record.name,
								displayName: record.displayName || record.name,
								domain: record.domain,
								plan: record.plan,
							});
							setModalVisible(true);
						}}
					>
						编辑
					</Button>
					<Popconfirm
						title="确认删除租户？此操作不可恢复！"
						onConfirm={() => handleDelete(record.id)}
					>
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
				title={t('tenants.title', '租户管理')}
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
							创建租户
						</Button>
					</>
				}
			/>

			<Alert
				variant="warning"
				title="此页面仅平台管理员可见"
				className="mb-4"
			 />

			{error && <PageError message="加载租户列表失败" retry={refetch} className="mb-4" />}

			<Input.Search
				allowClear
				placeholder="按名称 / 域名搜索租户"
				style={{ width: 320, marginBottom: 16 }}
				onSearch={(value) => {
					setPage(1);
					setKeyword(value.trim());
				}}
			/>

			<DataTable
				rowKey="id"
				columns={columns}
				dataSource={tenants}
				loading={isLoading}
				/* PL-07：配合操作列 fixed:'right' 提供横向滚动容器 */
				scroll={{ x: 1200 }}
				pagination={{
					current: page,
					pageSize,
					total,
					showSizeChanger: true,
					showTotal: (n: number) => `共 ${n} 条租户`,
					onChange: (p: number, ps: number) => {
						setPage(p);
						setPageSize(ps);
					},
				}}
				locale={{ emptyText: '暂无租户数据' }}
			/>

			<Modal
				title={editing ? '编辑租户' : '创建租户'}
				open={modalVisible}
				onCancel={() => {
					setModalVisible(false);
					setEditing(null);
					form.resetFields();
				}}
				onOk={() => form.submit()}
				destroyOnHidden
				// U412①：destroyOnHidden 弹窗首开前不渲染子树，forceRender 让表单随页挂载（消「未挂载即调用」告警）
				forceRender
			>
				<Form form={form} layout="vertical" onFinish={handleSave}>
					<Form.Item name="name" label="租户标识" rules={[{ required: true }]} extra="创建后不可修改">
						<Input placeholder="如：acme-corp" disabled={!!editing} />
					</Form.Item>
					<Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
						<Input placeholder="如：ACME Corp" />
					</Form.Item>
					<Form.Item name="domain" label="域名">
						<Input placeholder="如：acme.example.com" />
					</Form.Item>
					{!editing && (
						<Form.Item
							name="ownerId"
							label="所有者用户 ID"
							rules={[{ required: true }, { pattern: /^[0-9A-HJKMNP-TV-Z]{26}$/, message: '请输入 26 位用户 ULID' }]}
						>
							<Input placeholder="如：01KTKJF63A4RDHHJSHTY1ACP2F" />
						</Form.Item>
					)}
					<Form.Item name="plan" label="套餐" rules={[{ required: true }]} initialValue="free">
						<Select placeholder="选择套餐">
							<Option value="free">免费版</Option>
							<Option value="pro">专业版</Option>
							<Option value="enterprise">企业版</Option>
						</Select>
					</Form.Item>
				</Form>
			</Modal>

			<Drawer
				title={`租户详情: ${selectedTenant?.name}`}
				size="lg"
				open={detailDrawerVisible}
				onClose={() => setDetailDrawerVisible(false)}
				extra={
					selectedTenant ? (
						<Space size="small">
							<Button size="small" onClick={() => goTenantSubPage(ROUTE.TENANT_QUOTA)}>
								资源配额
							</Button>
							<Button
								size="small"
								onClick={() => goTenantSubPage(ROUTE.TENANT_INVITATION_CONFIG)}
							>
								邀请配置
							</Button>
						</Space>
					) : null
				}
			>
				<Tabs
					defaultActiveKey="info"
					items={[
						{
							key: 'info',
							label: '基本信息',
							children: (
								<Card>
									<Descriptions column={2}>
										<Descriptions.Item label="租户 ID">
											{detailData.info?.id || selectedTenant?.id}
										</Descriptions.Item>
										<Descriptions.Item label="名称">
											{detailData.info?.name || selectedTenant?.name}
										</Descriptions.Item>
										<Descriptions.Item label="显示名称">
											{detailData.info?.displayName || selectedTenant?.displayName || '-'}
										</Descriptions.Item>
										<Descriptions.Item label="域名">
											{detailData.info?.domain || selectedTenant?.domain || '-'}
										</Descriptions.Item>
										<Descriptions.Item label="状态">
											{renderTenantStatus(detailData.info?.status || selectedTenant?.status)}
										</Descriptions.Item>
										<Descriptions.Item label="套餐">
											{detailData.info?.plan || selectedTenant?.plan || '-'}
										</Descriptions.Item>
										<Descriptions.Item label="创建时间">
											{detailCreatedAt ? formatDateTime(detailCreatedAt) : '-'}
										</Descriptions.Item>
									</Descriptions>
								</Card>
							),
						},
						{
							key: 'members',
							label: '成员列表',
							children: (
								<DataTable
									rowKey="userId"
									dataSource={detailMembers}
									pagination={{ pageSize: 5 }}
									columns={[
										{ title: '用户 ID', dataIndex: 'userId', key: 'userId' },
										{ title: '用户名', dataIndex: 'username', key: 'username' },
										{ title: '邮箱', dataIndex: 'email', key: 'email' },
										{
											title: '角色',
											dataIndex: 'role',
											key: 'role',
											render: (v: string) => <Tag>{v}</Tag>,
										},
									]}
								/>
							),
						},
						{
							key: 'applications',
							label: '应用列表',
							children: (
								<DataTable
									rowKey="id"
									dataSource={detailApps}
									pagination={{ pageSize: 5 }}
									columns={[
										{ title: '应用名称', dataIndex: 'name', key: 'name' },
										{
											title: '类型',
											dataIndex: 'type',
											key: 'type',
											render: (v: string) => <Tag>{v?.toUpperCase()}</Tag>,
										},
										{ title: 'Client ID', dataIndex: 'clientId', key: 'clientId', ellipsis: true },
										{
											title: '状态',
											dataIndex: 'status',
											key: 'status',
											render: (v: string) => (
												<Tag color={v === 'active' ? 'success' : 'default'}>{v}</Tag>
											),
										},
									]}
								/>
							),
						},
						{
							key: 'stats',
							label: '统计数据',
							children: (
								<Card>
									<Row gutter={16}>
										<Col span={8}>
											<Card>
												<div className="text-neutral-600">成员数</div>

												{membersError && (
													<PageError message="加载失败" retry={membersRefetch} className="mb-4" />
												)}

												{applicationsError && (
													<PageError
														message="加载失败"
														retry={applicationsRefetch}
														className="mb-4"
													/>
												)}
												<div className="text-2xl font-bold">{detailMembers.length}</div>
											</Card>
										</Col>
										<Col span={8}>
											<Card>
												<div className="text-neutral-600">应用数</div>
												<div className="text-2xl font-bold">{detailApps.length}</div>
											</Card>
										</Col>
									</Row>
								</Card>
							),
						},
					]}
				/>
			</Drawer>
		</div>
	);
}
