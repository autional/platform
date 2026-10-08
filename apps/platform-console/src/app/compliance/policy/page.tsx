'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, Card, Checkbox, Button, Tag, Space, Form, Input, Select, Progress, Row, Col, Statistic, Descriptions, Spin } from 'antd';
import {
	BadgeCheck,
	CheckCircle2,
	Pencil,
	Trash2,
	XCircle,
} from 'lucide-react';
import { handleApiError } from '@/lib/error-handler';
import { message } from '@/lib/antd-app';
import { useAuthStore, extractItem, usePageTitle } from '@autional/shared';
import { PageError, DataTable, Modal } from '@autional/ui/antd';
import { AppPageHeader } from '@autional/ui';
import { useTranslation } from 'react-i18next';
import { useTenants } from '@/hooks/use-tenants';

const API_BASE = '/compliance/api/v1/admin/compliance';

interface StandardItem {
	id: string;
	name: string;
	version: string;
	category: string;
	description: string;
}

interface ControlItem {
	id: string;
	requirement: string;
	name: string;
	description: string;
	parameter: string;
	operator: string;
	value: any;
	severity: string;
	tags: string[];
}

interface ResolvedParam {
	value: any;
	source: string[];
	mergeRule: string;
	overridden: boolean;
	overrideValue?: any;
	severity: string;
}

interface GapItem {
	parameter: string;
	required: any;
	current: any;
	operator: string;
	compliant: boolean;
	severity: string;
	standard?: string;
	controlRef?: string;
	description?: string;
}

interface OverrideItem {
	parameter: string;
	value: any;
	reason: string;
	createdBy: string;
	created_at?: string;
	createdAt?: string;
}

interface ReadinessItem {
	standardId?: string;
	standardName?: string;
	totalControls: number;
	passedControls: number;
	complianceRate: number;
	readyForAudit: boolean;
	failedControls?: unknown[];
	recommendations: string[];
}

const severityColor: Record<string, string> = {
	critical: 'red',
	high: 'orange',
	medium: 'gold',
	low: 'blue',
};

const severityLabel: Record<string, string> = {
	critical: '严重',
	high: '高',
	medium: '中',
	low: '低',
};

const categoryLabel: Record<string, string> = {
	financial: '金融',
	government: '政府',
	privacy: '隐私',
	security: '安全',
	healthcare: '医疗',
};

export default function CompliancePolicyPage() {
	const { t } = useTranslation();
	usePageTitle(t('compliancePolicy.title', '合规策略管理'));
	const [activeTab, setActiveTab] = useState('standards');
	const [standards, setStandards] = useState<StandardItem[]>([]);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [resolvedPolicy, setResolvedPolicy] = useState<Record<string, ResolvedParam>>({});
	const [gapItems, setGapItems] = useState<GapItem[]>([]);
	const [overrides, setOverrides] = useState<OverrideItem[]>([]);
	const [readiness, setReadiness] = useState<Record<string, ReadinessItem>>({});
	const [score, setScore] = useState<number | null>(null);
	// U414③：score API 已下发 grade（A+/A/B/C/D），接渲染
	const [scoreGrade, setScoreGrade] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [overrideModal, setOverrideModal] = useState(false);
	const [overrideForm] = Form.useForm();
	const [resolvedStandards, setResolvedStandards] = useState<string[]>([]);

	const [tenantSearch, setTenantSearch] = useState('');
	const [selectedTenantLabel, setSelectedTenantLabel] = useState<string | null>(null);
	const { data: tenantPage, isLoading: tenantsLoading } = useTenants({
		pageSize: 50,
		search: tenantSearch || undefined,
	});
	// 排除平台租户自身（按响应里的 plan 字段判定，勿依赖裸 ULID）。
	const tenantItems = useMemo(
		() => (tenantPage?.items ?? []).filter((t) => t.plan !== 'platform'),
		[tenantPage],
	);
	const currentTenantId = useAuthStore((s) => s.currentTenantId);
	const switchTenant = useAuthStore((s) => s.switchTenant);

	useEffect(() => {
		if (!currentTenantId && tenantItems.length > 0) {
			switchTenant(tenantItems[0].id);
		}
	}, [currentTenantId, tenantItems, switchTenant]);

	useEffect(() => {
		const found = tenantItems.find((t) => t.id === currentTenantId);
		if (found?.name) setSelectedTenantLabel(found.name);
	}, [tenantItems, currentTenantId]);

	useEffect(() => {
		fetchStandards();
		fetchOverrides();
		fetchScore();
	}, [currentTenantId]);

	const fetchStandards = async () => {
		try {
			setLoading(true);
			const { adminComplianceStandards, adminComplianceTenantsPolicyByTenants } =
				await import('@autional/shared/generated/api');
			const res = await adminComplianceStandards();
			const items = (res as any)?.data || res || [];
			setStandards(items);

			if (currentTenantId) {
				const policyRes = await adminComplianceTenantsPolicyByTenants(currentTenantId);
				const policy = (policyRes as any)?.data || policyRes;
				if (policy?.standards) {
					setSelectedIds(policy.standards);
					setResolvedPolicy(policy.parameters || {});
					setResolvedStandards(policy.standards);
				}
			}
		} catch (err) {
			setError('加载标准失败');
		} finally {
			setLoading(false);
		}
	};

	const fetchOverrides = async () => {
		try {
			const { apiClient: api } = await import('@autional/shared');
			const res = await api.get(`${API_BASE}/tenants/self/overrides`); // @generated-api-exempt — no generated endpoint
			setOverrides(extractItem<{ overrides: any[] }>(res.data)?.overrides || []);
		} catch {
			// 覆盖项加载失败时保持空列表
		}
	};

	const fetchScore = async () => {
		try {
			if (!currentTenantId) return;
			const { adminComplianceTenantsScoreByTenants } = await import('@autional/shared/generated/api');
			const res = (await adminComplianceTenantsScoreByTenants(currentTenantId)) as any;
			const payload = res?.data ?? res;
			setScore(payload?.overallScore ?? payload?.overall_score ?? null);
			setScoreGrade(payload?.grade ?? null);
		} catch {
			// 评分加载失败时保持默认
		}
	};

	const handleApply = async () => {
		try {
			setLoading(true);
			if (!currentTenantId) return;
			const { adminComplianceTenantsStandardsByTenantsPut, adminComplianceTenantsPolicyByTenants } =
				await import('@autional/shared/generated/api');
			await adminComplianceTenantsStandardsByTenantsPut(currentTenantId, { standards: selectedIds } as any);
			const res = await adminComplianceTenantsPolicyByTenants(currentTenantId);
			const policy = (res as any)?.data || res;
			setResolvedPolicy(policy?.parameters || {});
			setResolvedStandards(policy?.standards || []);
			message.success('标准选择已更新');
			fetchOverrides();
			fetchScore();
		} catch (err) {
			handleApiError(err, '更新失败');
		} finally {
			setLoading(false);
		}
	};

	const handleRunGapAnalysis = async () => {
		try {
			setLoading(true);
			if (!currentTenantId) return;
			const { adminComplianceTenantsGapAnalysisByTenantsPost } =
				await import('@autional/shared/generated/api');
			const res = (await adminComplianceTenantsGapAnalysisByTenantsPost(currentTenantId, {} as any)) as any;
			const payload = res?.data ?? res;
			setGapItems(payload?.parameters ?? []);
			setActiveTab('gaps');
		} catch (err) {
			handleApiError(err, '差距分析失败');
		} finally {
			setLoading(false);
		}
	};

	const handleGetReadiness = async (stdId: string) => {
		try {
			setLoading(true);
			if (!currentTenantId) return;
			const { adminComplianceTenantsReadinessByTenantsByReadinessPost } =
				await import('@autional/shared/generated/api');
			const res = (await adminComplianceTenantsReadinessByTenantsByReadinessPost(
				currentTenantId,
				stdId,
				{} as any,
			)) as any;
			setReadiness((prev) => ({ ...prev, [stdId]: res?.data ?? res }));
		} catch (err) {
			handleApiError(err, '获取认证报告失败');
		} finally {
			setLoading(false);
		}
	};

	const handleAddOverride = async (values: any) => {
		try {
			const { adminComplianceTenantsSelfOverridesPost } =
				await import('@autional/shared/generated/api');
			await adminComplianceTenantsSelfOverridesPost({
				parameter: values.parameter,
				value: values.value,
				reason: values.reason || '',
			} as any); // OverrideRequest 类型为 billing feature-gates 结构，compliance 契约实际为 parameter/value/reason
			message.success('覆盖已设置');
			setOverrideModal(false);
			overrideForm.resetFields();
			fetchOverrides();
		} catch (err) {
			handleApiError(err, '设置覆盖失败');
		}
	};

	const handleRemoveOverride = async (param: string) => {
		try {
			const { apiClient: api } = await import('@autional/shared');
			await api.delete(`${API_BASE}/tenants/self/overrides/${param}`); // @generated-api-exempt — no generated endpoint
			message.success('覆盖已移除');
			fetchOverrides();
		} catch (err) {
			handleApiError(err, '移除覆盖失败');
		}
	};

	if (error) {
		return <PageError message={error} retry={fetchStandards} />;
	}

	const filteredStandards = standards;

	const tenantOptions = tenantItems.map((t) => ({
		value: t.id,
		label: t.name ?? t.id,
	}));
	if (currentTenantId && !tenantItems.some((t) => t.id === currentTenantId)) {
		tenantOptions.unshift({ value: currentTenantId, label: selectedTenantLabel ?? currentTenantId });
	}

	const tabs = [
		{
			key: 'standards',
			label: '标准选择',
			children: (
				<div>
					<Card title="选择遵守的合规标准" style={{ marginBottom: 16 }}>
						<Checkbox.Group
							value={selectedIds}
							onChange={(v) => setSelectedIds(v as string[])}
							style={{ width: '100%' }}
						>
							<Space orientation="vertical" size="middle" style={{ width: '100%' }}>
								{filteredStandards.map((std) => (
									<Card key={std.id} size="small" hoverable>
										<Checkbox value={std.id}>
											<strong>{std.name}</strong>
											<Tag style={{ marginLeft: 8 }}>
												{categoryLabel[std.category] || std.category}
											</Tag>
											<Tag color="blue">{std.version}</Tag>
										</Checkbox>
										<div style={{ marginTop: 4, color: '#666', fontSize: 13 }}>
											{std.description}
										</div>
									</Card>
								))}
							</Space>
						</Checkbox.Group>
					</Card>
					<Space>
						<Button
							type="primary"
							icon={<BadgeCheck size="1em" />}
							onClick={handleApply}
							loading={loading}
						>
							应用标准选择
						</Button>
						<Button onClick={handleRunGapAnalysis} loading={loading}>
							运行差距分析
						</Button>
					</Space>
				</div>
			),
		},
		{
			key: 'policy',
			label: `组合策略${resolvedStandards.length ? ` (${resolvedStandards.length}个标准)` : ''}`,
			children: (
				<div>
					<Card title="解析后的合规策略" style={{ marginBottom: 16 }}>
						{resolvedStandards.length > 0 && (
							<Space wrap style={{ marginBottom: 12 }}>
								{resolvedStandards.map((sid) => (
									<Tag key={sid} color="blue">
										{standards.find((s) => s.id === sid)?.name || sid}
									</Tag>
								))}
							</Space>
						)}
						<DataTable
							rowKey="parameter"
							dataSource={Object.entries(resolvedPolicy).map(([k, v]) => ({
								parameter: k,
								...v,
								key: k,
							}))}
							columns={[
								{ title: '参数', dataIndex: 'parameter', width: 200 },
								{ title: '要求值', dataIndex: 'value', render: (v: any) => String(v) },
								{ title: '合并规则', dataIndex: 'mergeRule', width: 100 },
								{ title: '来源标准', dataIndex: 'source', render: (s: string[]) => s.join(', ') },
								{
									title: '严重度',
									dataIndex: 'severity',
									render: (s: string) => <Tag color={severityColor[s]}>{severityLabel[s]}</Tag>,
								},
								{
									title: '已拔高',
									dataIndex: 'overridden',
									render: (v: boolean) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
								},
							]}
							pagination={{ pageSize: 20 }}
							size="small"
						/>
					</Card>
				</div>
			),
		},
		{
			key: 'gaps',
			label: `差距分析${gapItems.length ? ` (${gapItems.filter((g) => !g.compliant).length}项不合规)` : ''}`,
			children: (
				<div>
					{gapItems.length === 0 ? (
						<Card>
							<div style={{ textAlign: 'center', padding: 40 }}>
								<p>点击"运行差距分析"按钮查看合规差距</p>
								<Button type="primary" onClick={handleRunGapAnalysis}>
									运行差距分析
								</Button>
							</div>
						</Card>
					) : (
						<Card
							title={
								<Space>
									<span>差距分析</span>
									{score != null && (
										<Space size={6}>
											<Progress
												type="circle"
												percent={Math.round(score)}
												size={40}
												status={score >= 80 ? 'success' : score >= 60 ? 'normal' : 'exception'}
											/>
											{/* U414③：圆环数字补文本直读 + grade 接渲染 */}
											<span>
												合规评分 {Math.round(score)}/100
												{scoreGrade ? ` · 评级 ${scoreGrade}` : ''}
											</span>
										</Space>
									)}
								</Space>
							}
						>
							<DataTable
								rowKey="parameter"
								dataSource={gapItems}
								columns={[
									{ title: '参数', dataIndex: 'parameter', width: 200 },
									{ title: '要求值', dataIndex: 'required', render: (v: any) => String(v) },
									{
										title: '当前值',
										dataIndex: 'current',
										render: (v: any) => (v != null ? String(v) : '—'),
									},
									{ title: '操作符', dataIndex: 'operator', width: 70 },
									{
										title: '状态',
										dataIndex: 'compliant',
										width: 80,
										render: (v: boolean) =>
											v ? (
												<Tag color="green" icon={<CheckCircle2 size="1em" />}>
													合规
												</Tag>
											) : (
												<Tag color="red" icon={<XCircle size="1em" />}>
													不合规
												</Tag>
											),
									},
									{
										title: '严重度',
										dataIndex: 'severity',
										width: 80,
										render: (s: string) => <Tag color={severityColor[s]}>{severityLabel[s]}</Tag>,
									},
									{ title: '来源', dataIndex: 'standard', width: 120 },
									{ title: '说明', dataIndex: 'description', ellipsis: true },
								]}
								pagination={{ pageSize: 20 }}
								size="small"
							/>
						</Card>
					)}
				</div>
			),
		},
		{
			key: 'overrides',
			label: `参数覆盖${overrides.length ? ` (${overrides.length})` : ''}`,
			children: (
				<div>
					<Card
						title="参数拔高覆盖"
						extra={
							<Button type="primary" icon={<Pencil size="1em" />} onClick={() => setOverrideModal(true)}>
								新增覆盖
							</Button>
						}
					>
						<DataTable
							rowKey="parameter"
							dataSource={overrides}
							columns={[
								{ title: '参数', dataIndex: 'parameter', width: 220 },
								{
									title: '覆盖值',
									dataIndex: 'value',
									render: (v: any) => <Tag color="green">{String(v)}</Tag>,
								},
								{ title: '原因', dataIndex: 'reason' },
								{
									title: '设置时间',
									dataIndex: 'created_at',
									width: 180,
									render: (_: any, r: OverrideItem) => r.createdAt ?? r.created_at ?? '-',
								},
								{
									title: '操作',
									width: 80,
									render: (_: any, record: OverrideItem) => (
										<Button
											type="link"
											danger
											icon={<Trash2 size="1em" />}
											onClick={() => handleRemoveOverride(record.parameter)}
										>
											移除
										</Button>
									),
								},
							]}
							pagination={{ pageSize: 20 }}
							size="small"
						/>
					</Card>
					<Modal
						title="新增参数覆盖 (只能拔高)"
						open={overrideModal}
						onCancel={() => {
							setOverrideModal(false);
							overrideForm.resetFields();
						}}
						onOk={() => overrideForm.submit()}
					>
						<Form form={overrideForm} layout="vertical" onFinish={handleAddOverride}>
							<Form.Item name="parameter" label="参数名" rules={[{ required: true }]}>
								<Input placeholder="例如: password_min_length_sfa" />
							</Form.Item>
							<Form.Item name="value" label="覆盖值" rules={[{ required: true }]}>
								<Input placeholder="例如: 16" />
							</Form.Item>
							<Form.Item name="reason" label="原因">
								<Input.TextArea placeholder="可选: 说明为何需要更高的安全要求" rows={2} />
							</Form.Item>
						</Form>
					</Modal>
				</div>
			),
		},
		{
			key: 'readiness',
			label: '认证就绪',
			children: (
				<div>
					{resolvedStandards.length === 0 ? (
						<Card>
							<div style={{ textAlign: 'center', padding: 40 }}>
								请先在"标准选择"中选择至少一个标准
							</div>
						</Card>
					) : (
						<Space orientation="vertical" size="middle" style={{ width: '100%' }}>
							{resolvedStandards.map((sid) => {
								const r = readiness[sid];
								return (
									<Card
										key={sid}
										title={standards.find((s) => s.id === sid)?.name || sid}
										extra={
											<Button
												size="small"
												onClick={() => handleGetReadiness(sid)}
												loading={loading}
											>
												检查认证就绪
											</Button>
										}
									>
										{r ? (
											<div>
												<Row gutter={16}>
													<Col span={6}>
														<Statistic
															title="就绪度"
															value={Math.round(r.complianceRate ?? 0)}
															suffix="%"
														/>
													</Col>
													<Col span={6}>
														<Statistic
															title="通过"
															value={r.passedControls}
															suffix={`/ ${r.totalControls}`}
														/>
													</Col>
													<Col span={6}>
														<Statistic title="可提交审计" value={r.readyForAudit ? '是' : '否'} />
													</Col>
													<Col span={6}>
														<Progress
															type="circle"
															percent={Math.round(r.complianceRate ?? 0)}
															size={60}
															status={r.readyForAudit ? 'success' : 'normal'}
														/>
													</Col>
												</Row>
												{(r.recommendations ?? []).length > 0 && (
													<div style={{ marginTop: 12 }}>
														<Descriptions title="建议操作" column={1} size="small">
															{r.recommendations.map((rec, i) => (
																<Descriptions.Item key={i} label={`#${i + 1}`}>
																	{rec}
																</Descriptions.Item>
															))}
														</Descriptions>
													</div>
												)}
											</div>
										) : (
											<div style={{ color: '#999', padding: 20, textAlign: 'center' }}>
												点击"检查认证就绪"获取报告
											</div>
										)}
									</Card>
								);
							})}
						</Space>
					)}
				</div>
			),
		},
	];

	return (
		<div>
			<AppPageHeader
				title={
					<span>
						<BadgeCheck size="1em" style={{ marginRight: 8 }} />
						{t('compliancePolicy.title', '合规策略管理')}
					</span>
				}
				actions={
					<Select
						style={{ width: 240 }}
						placeholder="选择租户"
						value={currentTenantId || undefined}
						onChange={(tid: string) => switchTenant(tid)}
						options={tenantOptions}
						showSearch
						filterOption={false}
						onSearch={setTenantSearch}
						loading={tenantsLoading}
						notFoundContent={tenantsLoading ? <Spin size="small" /> : undefined}
					/>
				}
			/>
			<Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
		</div>
	);
}
