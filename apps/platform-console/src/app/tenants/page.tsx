'use client';

import React, { useState } from 'react';
import { Button, Space, Tag, Modal, Form, Input, Select, Card, Descriptions, Tabs, Popconfirm, Row, Col } from 'antd';
import { message } from '@/lib/antd-app';
import {
	PlusOutlined,
	EyeOutlined,
	PauseCircleOutlined,
	PlayCircleOutlined,
	DeleteOutlined,
	EditOutlined,
} from '@ant-design/icons';
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
import { DataTable, Drawer, PageError } from '@autional/ui/antd';
import { Alert, ConsolePageHeader } from '@autional/ui';
import { useMembers } from '@/hooks/use-members';
import { useApplications } from '@/hooks/use-applications';
import { useNavigate } from 'react-router';
import { useTenantSlug } from '@autional/shared';
import { buildNavHref } from '@/lib/nav';
import { ROUTE } from '@/lib/route-paths';

const { Option } = Select;

export default function TenantsPage() {
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	const [modalVisible, setModalVisible] = useState(false);
	const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
	const [editing, setEditing] = useState<TenantRecord | null>(null);
	const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
	const [detailData, setDetailData] = useState<any>({});
	const detailTenantId = selectedTenant?.id || '';
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
		{ title: '租户名称', dataIndex: 'name', key: 'name' },
		{ title: '域名', dataIndex: 'domain', key: 'domain', render: (v?: string) => v || '-' },
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (status: string) => (
				<Tag color={status === 'active' ? 'success' : 'error'}>
					{status === 'active' ? '正常' : '已暂停'}
				</Tag>
			),
		},
		{ title: '套餐', dataIndex: 'plan', key: 'plan', render: (v?: string) => v || '-' },
		{
			title: '成员数',
			dataIndex: 'memberCount',
			key: 'memberCount',
			render: (v?: number) => v ?? '-',
		},
		{ title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
		{
			title: '操作',
			key: 'action',
			render: (_: any, record: TenantRecord) => (
				<Space size="small">
					<Button
						type="text"
						size="small"
						icon={<EyeOutlined />}
						onClick={() => openDetail(record)}
					>
						详情
					</Button>
					{record.status === 'active' ? (
						<Button
							type="text"
							size="small"
							icon={<PauseCircleOutlined />}
							onClick={() => handleSuspend(record.id)}
						>
							暂停
						</Button>
					) : (
						<Button
							type="text"
							size="small"
							icon={<PlayCircleOutlined />}
							onClick={() => handleActivate(record.id)}
						>
							激活
						</Button>
					)}
					<Button
						type="text"
						size="small"
						icon={<EditOutlined />}
						onClick={() => {
							setEditing(record);
							form.setFieldsValue({
								name: record.name,
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
				title="租户管理"
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
				pagination={{
					current: page,
					pageSize,
					total,
					showSizeChanger: true,
					showTotal: (t: number) => `共 ${t} 条租户`,
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
			>
				<Form form={form} layout="vertical" onFinish={handleSave}>
					<Form.Item name="name" label="租户名称" rules={[{ required: true }]}>
						<Input placeholder="如：Acme Corp" />
					</Form.Item>
					<Form.Item name="domain" label="域名">
						<Input placeholder="如：acme.example.com" />
					</Form.Item>
					{!editing && (
						<Form.Item
							name="adminEmail"
							label="初始管理员邮箱"
							rules={[{ required: true, type: 'email' }]}
						>
							<Input placeholder="admin@example.com" />
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
										<Descriptions.Item label="域名">
											{detailData.info?.domain || selectedTenant?.domain || '-'}
										</Descriptions.Item>
										<Descriptions.Item label="状态">
											<Tag
												color={
													(detailData.info?.status || selectedTenant?.status) === 'active'
														? 'success'
														: 'error'
												}
											>
												{(detailData.info?.status || selectedTenant?.status) === 'active'
													? '正常'
													: '已暂停'}
											</Tag>
										</Descriptions.Item>
										<Descriptions.Item label="套餐">
											{detailData.info?.plan || selectedTenant?.plan || '-'}
										</Descriptions.Item>
										<Descriptions.Item label="创建时间">
											{detailData.info?.createdAt || selectedTenant?.createdAt}
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
