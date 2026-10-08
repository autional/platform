'use client';

import React, { useMemo } from 'react';
import { Card, Col, Row, Tag, Statistic } from 'antd';
import {
	AlertTriangle,
	BadgeCheck,
	CheckCircle2,
	Cloud,
	Database,
	HelpCircle,
	Users,
	XCircle,
} from 'lucide-react';
import { Alert, AppPageHeader } from '@autional/ui';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@autional/shared';
import { useSystemServices, useSystemTenants, CATEGORY_LABELS } from '@/hooks/use-system-overview';
import type { ServiceInfo } from '@/hooks/use-system-overview';
import { PageLoading } from '@autional/ui/antd';
import { ApiErrorState } from '@/components/ApiErrorState';

const statusConfig: Record<string, { icon: React.ReactNode }> = {
	healthy: { icon: <CheckCircle2 size="1em" style={{ color: 'var(--color-success)' }} /> },
	unhealthy: { icon: <XCircle size="1em" style={{ color: 'var(--color-danger)' }} /> },
	unknown: { icon: <HelpCircle size="1em" style={{ color: 'var(--color-text-disabled)' }} /> },
};

const categoryColors: Record<ServiceInfo['category'], string> = {
	authentication: 'blue',
	'user-data': 'cyan',
	'business-platform': 'purple',
	operations: 'green',
	'access-control': 'magenta',
	infrastructure: 'orange',
};

export default function SystemOverviewPage() {
	const { t } = useTranslation();
	usePageTitle(t('systemOverview.title', '系统总览'));
	const servicesQuery = useSystemServices();
	const tenantsQuery = useSystemTenants();

	const servicesByCategory = useMemo(() => {
		if (!servicesQuery.data?.services) return {};
		return servicesQuery.data.services.reduce<Record<string, ServiceInfo[]>>((acc, svc) => {
			const key = svc.category;
			(acc[key] ??= []).push(svc);
			return acc;
		}, {});
	}, [servicesQuery.data]);

	if (servicesQuery.isLoading || tenantsQuery.isLoading) return <PageLoading />;

	return (
		<div>
			<AppPageHeader
				title={t('systemOverview.title', '系统总览')}
				description={t('systemOverview.subtitle', '全局服务健康、基础设施状态、租户概览与安全态势')}
			/>

			<Row gutter={[16, 16]} className="mt-6">
				<Col xs={24} lg={16}>
					<Card
						title={
							<span>
								<Cloud size="1em" className="mr-2" />
								{t('systemOverview.serviceHealth', '服务健康')}
							</span>
						}
						className="h-full"
					>
						{servicesQuery.error ? (
							<ApiErrorState
								error={servicesQuery.error}
								title={t('systemOverview.loadError', '加载系统总览失败')}
								onRetry={() => servicesQuery.refetch()}
							/>
						) : (
							<>
								{servicesQuery.data && !servicesQuery.data.healthAvailable && (
									<Alert
										variant="warning"
										title={t(
											'systemOverview.healthUnavailable',
											'健康数据不可用',
										)}
										className="mb-4"
									>
										{t(
											'systemOverview.healthUnavailableDetail',
											'服务状态已按「未知」呈现；健康检查数据源暂不可用。',
										)}
									</Alert>
								)}
								{Object.entries(servicesByCategory).map(([category, services]) => (
									<div key={category} className="mb-4 last:mb-0">
										<Tag
											color={categoryColors[category as ServiceInfo['category']]}
											className="mb-2"
										>
											{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ??
												category}
										</Tag>
										<Row gutter={[12, 12]}>
											{services.map((svc) => (
												<Col xs={24} sm={12} md={8} lg={8} xl={6} key={svc.name}>
													<Card size="small" className="service-card">
														<div className="flex items-center justify-between">
															<div className="flex-1 min-w-0">
																<div className="font-medium text-sm truncate">
																	{svc.name}
																</div>
																<div className="text-xs text-neutral-600">
																	:{svc.port}
																</div>
															</div>
															<div className="ml-2 flex-shrink-0">
																{statusConfig[svc.status].icon}
															</div>
														</div>
													</Card>
												</Col>
											))}
										</Row>
									</div>
								))}
							</>
						)}
					</Card>
				</Col>

				<Col xs={24} lg={8}>
					<Card
						title={
							<span>
								<Database size="1em" className="mr-2" />
								{t('systemOverview.infrastructure', '基础设施')}
							</span>
						}
						className="h-full"
					>
						<Alert
							variant="warning"
							title={t('systemOverview.notConnected', '未接入')}
						>
							{t(
								'systemOverview.notConnectedDetail',
								'暂无数据源；接入后展示真实数据。',
							)}
						</Alert>
					</Card>
				</Col>
			</Row>

			<Row gutter={[16, 16]} className="mt-4">
				<Col xs={24} lg={8}>
					<Card
						title={
							<span>
								<Users size="1em" className="mr-2" />
								{t('systemOverview.tenantOverview', '租户概览')}
							</span>
						}
					>
						{tenantsQuery.error ? (
							<ApiErrorState
								error={tenantsQuery.error}
								title={t('systemOverview.loadError', '加载系统总览失败')}
								onRetry={() => tenantsQuery.refetch()}
							/>
						) : tenantsQuery.data ? (
							<>
								<Row gutter={[16, 16]}>
									<Col span={8}>
										<Statistic
											title={t('systemOverview.totalTenants', '总数')}
											value={tenantsQuery.data.total}
											prefix={<Users size="1em" className="text-info" />}
										/>
									</Col>
									<Col span={8}>
										<Statistic
											title={t('systemOverview.activeTenants', '活跃')}
											value={tenantsQuery.data.active}
											prefix={<CheckCircle2 size="1em" className="text-success" />}
										/>
									</Col>
									<Col span={8}>
										<Statistic
											title={t('systemOverview.suspendedTenants', '已暂停')}
											value={tenantsQuery.data.suspended}
											prefix={<AlertTriangle size="1em" className="text-warning" />}
										/>
									</Col>
								</Row>

								<div className="mt-4">
									<div className="text-sm font-medium text-neutral-600 mb-2">
										{t('systemOverview.planDistribution', '套餐分布')}
									</div>
									<div className="space-y-2">
										{(tenantsQuery.data.planDistribution ?? []).map(({ plan, count }) => (
											<div key={plan} className="flex items-center justify-between">
												<Tag color="blue">{plan}</Tag>
												<span className="text-sm">{count}</span>
											</div>
										))}
									</div>
								</div>
							</>
						) : null}
					</Card>
				</Col>

				<Col xs={24} lg={16}>
					<Card
						title={
							<span>
								<BadgeCheck size="1em" className="mr-2" />
								{t('systemOverview.securityPosture', '安全态势')}
							</span>
						}
					>
						<Alert
							variant="warning"
							title={t('systemOverview.notConnected', '未接入')}
						>
							{t(
								'systemOverview.notConnectedDetail',
								'暂无数据源；接入后展示真实数据。',
							)}
						</Alert>
					</Card>
				</Col>
			</Row>
		</div>
	);
}
