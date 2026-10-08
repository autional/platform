'use client';

import React, { useState } from 'react';
import { Card, Tag, Row, Col, Spin, Statistic } from 'antd';
import { message } from '@/lib/antd-app';
import {
	CheckCircleOutlined,
	CloseCircleOutlined,
	CloudServerOutlined,
	WarningOutlined,
} from '@ant-design/icons';
import { useOpsStatus, useHealth, useServiceHealth, type ServiceHealthItem } from '@/hooks/use-ops';
import { ops, isGrafanaConfigured } from '@/lib/api.generated';
import { PageError } from '@autional/ui/antd';
import { Alert, AppPageHeader } from '@autional/ui';

interface ServiceHealth {
	name: string;
	status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
	latency?: string;
	port?: number;
	checkedAt?: string;
}

export default function OpsPage() {
	const [selectedService, setSelectedService] = useState<string | null>(null);

	const { data: opsStatus, isLoading: opsLoading, error, refetch } = useOpsStatus();
	const { data: health, isLoading: healthLoading } = useHealth();
	const { data: healthData, isLoading: healthDataLoading } = useServiceHealth();

	const loading = opsLoading || healthLoading || healthDataLoading;

	const services: ServiceHealth[] = React.useMemo(() => {
		const svcs: ServiceHealth[] = [];
		if (health?.servicesList && Array.isArray(health.servicesList)) {
			health.servicesList.forEach((svc: ServiceHealthItem) => {
				svcs.push({
					name: svc.name,
					status: (svc.status as ServiceHealth['status']) ?? 'unknown',
					latency: svc.latency,
					port: svc.port,
					checkedAt: svc.checkedAt ?? svc.checked_at,
				});
			});
			return svcs;
		}
		if ((opsStatus as any)?.services) {
			svcs.push(
				...(opsStatus as any).services.map((s: string) => ({
					name: s.split(':')[0],
					status: 'healthy' as const,
				})),
			);
		}
		if (health?.services) {
			Object.entries(health.services).forEach(([name, status]: [string, any]) => {
				const existing = svcs.find((svc) => svc.name === name);
				if (existing) existing.status = status;
				else svcs.push({ name, status });
			});
		}
		return svcs;
	}, [opsStatus, health]);

	return (
		<div>
			{error && <PageError message="加载运维状态失败" retry={refetch} className="mb-4" />}

			<AppPageHeader
				title="运维视图"
			/>

			<Spin spinning={loading}>
				{/* PL-57：本页两个数字来源不同（此带=公开状态页聚合，下方服务卡=网关直连探测子集），不注明会被当矛盾 */}
				{healthData && (
					<div className="text-sm font-medium mb-2">全站服务概览（公开状态页聚合口径）</div>
				)}

				{healthData && (
					<Row gutter={[16, 16]} className="mb-6">
						<Col xs={24} sm={8}>
							<Card>
								<Statistic
									title="服务总数"
									value={healthData.servicesTotal}
									prefix={<CloudServerOutlined />}
								/>
							</Card>
						</Col>
						<Col xs={24} sm={8}>
							<Card>
								<Statistic
									title="健康服务"
									value={healthData.servicesHealthy}
									suffix={`/ ${healthData.servicesTotal}`}
									valueStyle={{ color: 'var(--color-success-text)' }}
									prefix={<CheckCircleOutlined />}
								/>
							</Card>
						</Col>
						<Col xs={24} sm={8}>
							<Card>
								<Statistic
									title="活跃事件"
									value={healthData.activeIncidents}
									valueStyle={{ color: healthData.activeIncidents > 0 ? 'var(--color-danger-text)' : undefined }}
									prefix={<WarningOutlined />}
								/>
							</Card>
						</Col>
					</Row>
				)}

				{services.length > 0 && (
					<div className="text-sm font-medium mb-2">
						服务直连探测（网关 developer/status 口径 · 仅含网关已注册服务，少于全站总数属正常）
					</div>
				)}
				<Row gutter={[16, 16]} className="mb-6">
					{services.map((svc) => (
						<Col xs={24} sm={12} md={8} lg={6} key={svc.name}>
							<Card hoverable onClick={() => setSelectedService(svc.name)}>
								<div className="flex items-center justify-between mb-1">
									<div className="font-medium">{svc.name}</div>
									<Tag
										icon={
											svc.status === 'healthy' ? <CheckCircleOutlined /> : <CloseCircleOutlined />
										}
										color={
											svc.status === 'healthy'
												? 'success'
												: svc.status === 'degraded'
													? 'warning'
													: 'error'
										}
									>
										{svc.status === 'healthy'
											? '正常'
											: svc.status === 'degraded'
												? '降级'
												: '异常'}
									</Tag>
								</div>
								{svc.latency && (
									<div className="text-xs text-neutral-600">
										延迟: {svc.latency === '0s' ? '—' : svc.latency}
										{svc.port != null && ` | 端口: ${svc.port}`}
									</div>
								)}
							</Card>
						</Col>
					))}
				</Row>

				<Card
					title="服务总览 (Grafana)"
					className="mb-6"
					// iframe 加载失败跨域不可检测（XFO/CSP/Basic Auth 均表现为空白）→ 链接恒显式渲染
					extra={
						isGrafanaConfigured ? (
							<a href={ops.grafanaOverviewUrl} target="_blank" rel="noreferrer">
								新窗口打开
							</a>
						) : undefined
					}
				>
					{isGrafanaConfigured ? (
						<iframe
							src={ops.grafanaOverviewUrl}
							width="100%"
							height="500"
							style={{ border: 'none' }}
							title="Grafana 总览面板"
						/>
					) : (
						<Alert
							variant="info"
							title="Grafana 未接入"
						>
							"当前环境未配置 Grafana 面板地址；接入后在此展示服务总览面板。"
						</Alert>
					)}
				</Card>

				{selectedService && (
					<Card
						title={`${selectedService} 详情 (Grafana)`}
						className="mb-6"
						extra={
							<span className="flex items-center gap-3">
								{isGrafanaConfigured && (
									<a
										href={ops.grafanaServicesUrl(selectedService)}
										target="_blank"
										rel="noreferrer"
									>
										新窗口打开
									</a>
								)}
								<Tag color="blue">Grafana</Tag>
							</span>
						}
					>
						{isGrafanaConfigured ? (
							<iframe
								src={ops.grafanaServicesUrl(selectedService)}
								width="100%"
								height="400"
								style={{ border: 'none' }}
								title={`Grafana ${selectedService} 面板`}
							/>
						) : (
							<Alert
								variant="info"
								title="Grafana 未接入"
							>
								"当前环境未配置 Grafana 面板地址；接入后在此展示该服务面板。"
							</Alert>
						)}
					</Card>
				)}
			</Spin>
		</div>
	);
}
