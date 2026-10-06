'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, Card, Tag, Button, Statistic, Row, Col, Space, Modal, Form, Input, Select, Empty, Progress, Badge } from 'antd';
import { message, modal } from '@/lib/antd-app';
import {
	SafetyCertificateOutlined,
	EditOutlined,
	PlusOutlined,
	EyeOutlined,
	SettingOutlined,
} from '@ant-design/icons';
import {
	useDSARs,
	useUpdateDSAR,
	useExecuteErasure,
	useRetentionPolicies,
	useSODRules,
	useISOControls,
	useCreateRetentionPolicy,
	useUpdateRetentionPolicy,
	useConsents,
	useCreateConsent,
	useRevokeConsent,
} from '@/hooks/use-compliance';
import { handleApiError } from '@/lib/error-handler';
import { DataTable, Drawer, PageError } from '@autional/ui/antd';
import { useAuthStore, useTenantSlug } from '@autional/shared';
import { ConsolePageHeader } from '@autional/ui';
import { useNavigate } from 'react-router';
import { useTenants } from '@/hooks/use-tenants';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';

interface DSARRecord {
	id: string;
	requesterEmail: string;
	type: string;
	status: string;
	createdAt: string;
	description?: string;
}

interface RetentionPolicy {
	id: string;
	name: string;
	resourceType: string;
	retentionDays: number;
	actionAfterExpiry: string;
	status: string;
}

interface SODRule {
	id: string;
	name: string;
	roleA: string;
	roleB: string;
	description: string;
}

interface ISOControl {
	id: string;
	controlId: string;
	title: string;
	domain: string;
	complianceStatus: string;
}

interface ConsentRecord {
	id: string;
	userId: string;
	scope: string;
	granted: boolean;
	ipAddress?: string;
	recordedAt?: string;
	revokedAt?: string;
	version?: string;
}

export default function CompliancePage() {
	const [activeTab, setActiveTab] = useState('dashboard');
	const [complianceScore, setComplianceScore] = useState<number | null>(null);
	const [standardCount, setStandardCount] = useState(0);
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	const [dsarDrawer, setDsarDrawer] = useState(false);
	const [currentDsar, setCurrentDsar] = useState<DSARRecord | null>(null);

	const { data: tenantPage } = useTenants();
	const tenants = tenantPage?.items ?? [];
	const currentTenantId = useAuthStore((s) => s.currentTenantId);
	const switchTenant = useAuthStore((s) => s.switchTenant);

	const [policyModal, setPolicyModal] = useState(false);
	const [policyForm] = Form.useForm();
	const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);

	const [consentModal, setConsentModal] = useState(false);
	const [consentForm] = Form.useForm();

	const { data: dsars = [], isLoading: dsarLoading } = useDSARs();
	const { data: policies = [], isLoading: policyLoading, error, refetch } = useRetentionPolicies();
	const { data: sodRules = [], isLoading: sodLoading } = useSODRules();
	const { data: isoControls = [], isLoading: isoLoading } = useISOControls();
	const updateDsarMut = useUpdateDSAR();
	const erasureMut = useExecuteErasure();
	const createPolicyMut = useCreateRetentionPolicy();
	const updatePolicyMut = useUpdateRetentionPolicy();
	const { data: consents = [], isLoading: consentLoading } = useConsents();
	const createConsentMut = useCreateConsent();
	const revokeConsentMut = useRevokeConsent();

	const loading = dsarLoading || policyLoading || sodLoading || isoLoading;

	useEffect(() => {
		if (!currentTenantId && tenants.length > 0) {
			switchTenant(tenants[0].id);
		}
	}, [currentTenantId, tenantPage, switchTenant]);

	useEffect(() => {
		if (!currentTenantId) return;
		(async () => {
			try {
				const { adminComplianceTenantsScoreByTenants, adminComplianceTenantsPolicyByTenants } =
					await import('@autional/shared/generated/api');
				const scoreRes = (await adminComplianceTenantsScoreByTenants(currentTenantId)) as any;
				const scorePayload = scoreRes?.data ?? scoreRes;
				setComplianceScore(scorePayload?.overallScore ?? scorePayload?.overall_score ?? null);
				const polRes = (await adminComplianceTenantsPolicyByTenants(currentTenantId)) as any;
				const polPayload = polRes?.data ?? polRes;
				setStandardCount(polPayload?.standards?.length || 0);
			} catch {
				// 合规评分加载失败时保持默认
			}
		})();
	}, [currentTenantId]);

	const handleProcessDsar = async (id: string, statusVal: string) => {
		try {
			await updateDsarMut.mutateAsync({ id, data: { status: statusVal } });
			message.success('DSAR 状态更新成功');
		} catch (err) {
			handleApiError(err, '更新失败');
		}
	};

	const handleExecuteErasure = async (id: string) => {
		modal.confirm({
			title: '确认执行删除',
			content: '此操作将永久删除用户数据，不可恢复，是否继续？',
			okText: '执行删除',
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await erasureMut.mutateAsync(id);
					message.success('删除执行成功');
				} catch (err) {
					handleApiError(err, '执行删除失败');
				}
			},
		});
	};

	const handleSavePolicy = async (values: any) => {
		try {
			if (editingPolicy) {
				await updatePolicyMut.mutateAsync({ id: editingPolicy.id, data: values });
				message.success('策略更新成功');
			} else {
				await createPolicyMut.mutateAsync(values);
				message.success('策略创建成功');
			}
			setPolicyModal(false);
			policyForm.resetFields();
			setEditingPolicy(null);
		} catch (err) {
			handleApiError(err, '保存策略失败');
		}
	};

	const handleCreateConsent = async (values: {
		userId: string;
		scope: string;
		granted: boolean;
	}) => {
		try {
			await createConsentMut.mutateAsync({
				userId: values.userId,
				purpose: values.scope,
				service: 'admin-console',
				granted: values.granted,
				consentMethod: 'manual',
			});
			message.success('同意记录创建成功');
			setConsentModal(false);
			consentForm.resetFields();
		} catch (err) {
			handleApiError(err, '创建同意记录失败');
		}
	};

	const handleRevokeConsent = (record: ConsentRecord) => {
		modal.confirm({
			title: '确认撤销',
			content: `确定撤销用户 ${record.userId} 关于 ${record.scope} 的同意吗？`,
			okText: '撤销',
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await revokeConsentMut.mutateAsync({ userId: record.userId, purpose: record.scope });
					message.success('同意已撤销');
				} catch (err) {
					handleApiError(err, '撤销同意失败');
				}
			},
		});
	};

	const dsarColumns = [
		{ title: '请求人', dataIndex: 'requesterEmail', key: 'requesterEmail' },
		{ title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => (
				<Tag color={v === 'completed' ? 'success' : v === 'pending' ? 'warning' : 'default'}>
					{v}
				</Tag>
			),
		},
		{ title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
		{
			title: '操作',
			key: 'action',
			render: (_: any, record: DSARRecord) => (
				<Space size="small">
					<Button
						type="link"
						icon={<EyeOutlined />}
						onClick={() => {
							setCurrentDsar(record);
							setDsarDrawer(true);
						}}
					>
						详情
					</Button>
					<Button type="link" onClick={() => handleProcessDsar(record.id, 'completed')}>
						标记完成
					</Button>
					<Button type="link" danger onClick={() => handleExecuteErasure(record.id)}>
						执行删除
					</Button>
				</Space>
			),
		},
	];

	const policyColumns = [
		{ title: '名称', dataIndex: 'name', key: 'name' },
		{ title: '资源类型', dataIndex: 'resourceType', key: 'resourceType' },
		{ title: '留存天数', dataIndex: 'retentionDays', key: 'retentionDays' },
		{ title: '过期后操作', dataIndex: 'actionAfterExpiry', key: 'actionAfterExpiry' },
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => <Tag color={v === 'active' ? 'success' : 'default'}>{v}</Tag>,
		},
		{
			title: '操作',
			key: 'action',
			render: (_: any, record: RetentionPolicy) => (
				<Space size="small">
					<Button
						type="link"
						icon={<EditOutlined />}
						onClick={() => {
							setEditingPolicy(record);
							policyForm.setFieldsValue(record);
							setPolicyModal(true);
						}}
					>
						编辑
					</Button>
				</Space>
			),
		},
	];

	const sodColumns = [
		{ title: '规则名称', dataIndex: 'name', key: 'name' },
		{ title: '角色 A', dataIndex: 'roleA', key: 'roleA' },
		{ title: '角色 B', dataIndex: 'roleB', key: 'roleB' },
		{ title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
	];

	const isoColumns = [
		{ title: '控制项编号', dataIndex: 'controlId', key: 'controlId' },
		{ title: '标题', dataIndex: 'title', key: 'title' },
		{ title: '域', dataIndex: 'domain', key: 'domain' },
		{
			title: '合规状态',
			dataIndex: 'complianceStatus',
			key: 'complianceStatus',
			render: (v: string) => (
				<Tag color={v === 'compliant' ? 'success' : v === 'non_compliant' ? 'error' : 'warning'}>
					{v}
				</Tag>
			),
		},
	];

	const consentColumns = [
		{ title: '用户ID', dataIndex: 'userId', key: 'userId', ellipsis: true },
		{
			title: '范围',
			dataIndex: 'scope',
			key: 'scope',
			render: (v: string) => <Tag>{v || '-'}</Tag>,
		},
		{
			title: '状态',
			key: 'status',
			render: (_: any, r: ConsentRecord) => (
				<Tag color={r.granted ? 'success' : 'error'}>{r.granted ? '已同意' : '已撤销'}</Tag>
			),
		},
		{ title: 'IP地址', dataIndex: 'ipAddress', key: 'ipAddress', ellipsis: true },
		{
			title: '记录时间',
			dataIndex: 'recordedAt',
			key: 'recordedAt',
			render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
		},
		{ title: '版本', dataIndex: 'version', key: 'version' },
		{
			title: '操作',
			key: 'action',
			render: (_: any, record: ConsentRecord) =>
				record.granted ? (
					<Button type="link" danger onClick={() => handleRevokeConsent(record)}>
						撤销
					</Button>
				) : null,
		},
	];

	const pendingDsarCount = (dsars as DSARRecord[]).filter((d) => d.status === 'pending').length;

	const tenantOptions = tenants.map((t) => ({
		value: t.id,
		label: t.name ?? t.id,
	}));

	return (
		<div>
			<ConsolePageHeader
				title="合规中心"
				actions={
					<>
						<Select
							style={{ width: 240 }}
							placeholder="选择租户"
							value={currentTenantId || undefined}
							onChange={(tid: string) => switchTenant(tid)}
							options={tenantOptions}
						/>
					</>
				}
			/>

			<Tabs
				activeKey={activeTab}
				onChange={setActiveTab}
				items={[
					{
						key: 'dashboard',
						label: '仪表盘',
						children: (
							<Row gutter={16}>
								<Col xs={24} md={6}>
									<Card loading={loading}>
										<Statistic
											title="合规评分"
											value={complianceScore ?? 0}
											suffix="/ 100"
											valueStyle={{
												color:
													(complianceScore ?? 0) >= 80 ? 'var(--color-success-text)' : 'var(--color-danger-text)',
											}}
											prefix={<SafetyCertificateOutlined />}
										/>
									</Card>
								</Col>
								<Col xs={24} md={6}>
									<Card loading={loading}>
										<Statistic title="遵守标准" value={standardCount} suffix="个" />
										<Button
											type="link"
											size="small"
											icon={<SettingOutlined />}
											onClick={() =>
												navigate(buildNavHref(ROUTE.COMPLIANCE_POLICY, tenantSlug))
											}
										>
											管理策略
										</Button>
									</Card>
								</Col>
								<Col xs={24} md={6}>
									<Card loading={loading}>
										<Statistic
											title="待处理 DSAR"
											value={pendingDsarCount}
											valueStyle={{ color: pendingDsarCount > 0 ? 'var(--color-danger-text)' : 'var(--color-success-text)' }}
										/>
									</Card>
								</Col>
							</Row>
						),
					},
					{
						key: 'dsar',
						label: 'GDPR DSAR',
						children: (
							<DataTable
								rowKey="id"
								columns={dsarColumns}
								dataSource={dsars}
								loading={dsarLoading}
								pagination={{ pageSize: 10 }}
							/>
						),
					},
					{
						key: 'consent',
						label: '同意管理',
						children: (
							<>
								<div className="flex justify-end mb-4">
									<Button
										type="primary"
										icon={<PlusOutlined />}
										onClick={() => {
											consentForm.resetFields();
											setConsentModal(true);
										}}
									>
										新建同意记录
									</Button>
								</div>
								<DataTable
									rowKey="id"
									columns={consentColumns}
									dataSource={consents}
									loading={consentLoading}
									pagination={{ pageSize: 10 }}
								/>
							</>
						),
					},
					{
						key: 'retention',
						label: '留存策略',
						children: (
							<>
								<div className="flex justify-end mb-4">
									<Button
										type="primary"
										icon={<PlusOutlined />}
										onClick={() => {
											setEditingPolicy(null);
											policyForm.resetFields();
											setPolicyModal(true);
										}}
									>
										新建策略
									</Button>
								</div>

								{error && <PageError message="加载合规状态失败" retry={refetch} className="mb-4" />}
								<DataTable
									rowKey="id"
									columns={policyColumns}
									dataSource={policies}
									loading={policyLoading}
									pagination={{ pageSize: 10 }}
								/>
							</>
						),
					},
					{
						key: 'sod',
						label: 'SoD 规则',
						children: (
							<DataTable
								rowKey="id"
								columns={sodColumns}
								dataSource={sodRules}
								loading={sodLoading}
								pagination={{ pageSize: 10 }}
							/>
						),
					},
					{
						key: 'iso',
						label: 'ISO27001',
						children: (
							<DataTable
								rowKey="id"
								columns={isoColumns}
								dataSource={isoControls}
								loading={isoLoading}
								pagination={{ pageSize: 10 }}
							/>
						),
					},
				]}
			/>

			<Drawer title="DSAR 详情" size="sm" open={dsarDrawer} onClose={() => setDsarDrawer(false)}>
				{currentDsar && (
					<div className="space-y-4">
						<Row>
							<Col span={8} className="text-neutral-600">
								ID
							</Col>
							<Col span={16}>{currentDsar.id}</Col>
						</Row>
						<Row>
							<Col span={8} className="text-neutral-600">
								请求人
							</Col>
							<Col span={16}>{currentDsar.requesterEmail}</Col>
						</Row>
						<Row>
							<Col span={8} className="text-neutral-600">
								类型
							</Col>
							<Col span={16}>
								<Tag>{currentDsar.type}</Tag>
							</Col>
						</Row>
						<Row>
							<Col span={8} className="text-neutral-600">
								状态
							</Col>
							<Col span={16}>
								<Tag>{currentDsar.status}</Tag>
							</Col>
						</Row>
						<Row>
							<Col span={8} className="text-neutral-600">
								创建时间
							</Col>
							<Col span={16}>{currentDsar.createdAt}</Col>
						</Row>
						<Row>
							<Col span={8} className="text-neutral-600">
								描述
							</Col>
							<Col span={16}>{currentDsar.description || '-'}</Col>
						</Row>
					</div>
				)}
			</Drawer>

			<Modal
				title={editingPolicy ? '编辑留存策略' : '新建留存策略'}
				open={policyModal}
				onCancel={() => {
					setPolicyModal(false);
					setEditingPolicy(null);
					policyForm.resetFields();
				}}
				onOk={() => policyForm.submit()}
			>
				<Form form={policyForm} layout="vertical" onFinish={handleSavePolicy}>
					<Form.Item name="name" label="策略名称" rules={[{ required: true }]}>
						<Input placeholder="如：用户数据留存策略" />
					</Form.Item>
					<Form.Item name="resourceType" label="资源类型" rules={[{ required: true }]}>
						<Input placeholder="如：user" />
					</Form.Item>
					<Form.Item name="retentionDays" label="留存天数" rules={[{ required: true }]}>
						<Input type="number" placeholder="365" />
					</Form.Item>
					<Form.Item name="actionAfterExpiry" label="过期后操作" rules={[{ required: true }]}>
						<Select
							placeholder="选择操作"
							options={[
								{ value: 'delete', label: '删除' },
								{ value: 'archive', label: '归档' },
								{ value: 'anonymize', label: '匿名化' },
							]}
						/>
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				title="新建同意记录"
				open={consentModal}
				onCancel={() => {
					setConsentModal(false);
					consentForm.resetFields();
				}}
				onOk={() => consentForm.submit()}
			>
				<Form form={consentForm} layout="vertical" onFinish={handleCreateConsent}>
					<Form.Item
						name="userId"
						label="用户ID"
						rules={[{ required: true, message: '请输入用户ID' }]}
					>
						<Input placeholder="如: usr_abc123" />
					</Form.Item>
					<Form.Item
						name="scope"
						label="同意范围"
						rules={[{ required: true, message: '请输入同意范围' }]}
					>
						<Select
							placeholder="选择或输入范围"
							options={[
								{ value: 'marketing', label: '营销通信' },
								{ value: 'analytics', label: '数据分析' },
								{ value: 'third_party', label: '第三方共享' },
								{ value: 'terms', label: '服务条款' },
								{ value: 'privacy', label: '隐私政策' },
							]}
						/>
					</Form.Item>
					<Form.Item
						name="granted"
						label="同意状态"
						rules={[{ required: true }]}
						initialValue={true}
					>
						<Select
							options={[
								{ value: true, label: '已同意' },
								{ value: false, label: '已拒绝' },
							]}
						/>
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
