import { useMemo, type ReactNode } from 'react';
import { Button, Card, Col, Row, Skeleton, Statistic, Typography } from 'antd';
import {
	TeamOutlined,
	NotificationOutlined,
	CloudServerOutlined,
	WarningOutlined,
	ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { StatusBadge } from '@autional/ui';
import { useSystemTenants } from '@/hooks/use-system-overview';
import { useIncidents, useOverview } from '@/hooks/use-status';
import { usePlatformNotificationStats } from '@/hooks/use-platform-stats';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';
import { formatDateTime } from '@/lib/format';
import { severityBadge, severityLabels } from '@/lib/incident-meta';

const { Title } = Typography;

interface KpiItem {
	title: string;
	value: string | number;
	suffix?: string;
	icon: ReactNode;
	note: string;
	route: string;
	warning: boolean;
}

export default function DashboardPage() {
	usePageTitle('平台仪表盘');
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();

	const { data: overview, isLoading: overviewLoading, error: overviewError } = useOverview();
	const { data: tenants, isLoading: tenantsLoading, error: tenantsError } = useSystemTenants();
	const { data: stats, isLoading: statsLoading, error: statsError } = usePlatformNotificationStats();
	const { data: incidents, isLoading: incidentsLoading } = useIncidents();

	const loading = overviewLoading || tenantsLoading || statsLoading;

	const recentIncidents = useMemo(
		() =>
			[...(incidents ?? [])]
				.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
				.slice(0, 5),
		[incidents],
	);

	const go = (route: string) => navigate(buildNavHref(route, tenantSlug));

	// PL-02/04：KPI 卡补下钻与口径注解；趋势图不补（平台侧无时序数据源，不伪造历史曲线）
	const kpis: KpiItem[] = [
		{
			title: '租户总数',
			value: tenants?.total ?? '—',
			icon: <TeamOutlined />,
			note: '点击下钻 · 租户管理',
			route: ROUTE.TENANTS,
			warning: !!tenantsError,
		},
		{
			title: '活跃事故',
			value: overview?.activeIncidents ?? '—',
			icon: <WarningOutlined />,
			note: '公开状态页口径 · 点击下钻',
			route: ROUTE.INCIDENTS,
			warning: !!overviewError,
		},
		{
			title: '健康服务',
			value: overview?.servicesHealthy ?? '—',
			suffix: overview?.servicesTotal != null ? `/ ${overview.servicesTotal}` : undefined,
			icon: <CloudServerOutlined />,
			note: '公开状态页口径 · 点击下钻',
			route: ROUTE.OPS,
			warning: !!overviewError,
		},
		{
			title: '平台通知',
			value: stats?.totalSent ?? '—',
			icon: <NotificationOutlined />,
			note: '站内通知全量累计 · 点击下钻',
			route: ROUTE.PLATFORM_NOTIFICATIONS,
			warning: !!statsError,
		},
	];

	const quickLinks = [
		{ label: '租户管理', route: ROUTE.TENANTS },
		{ label: '事故管理', route: ROUTE.INCIDENTS },
		{ label: '维护窗口', route: ROUTE.MAINTENANCES },
		{ label: '运维视图', route: ROUTE.OPS },
		{ label: '平台通知', route: ROUTE.PLATFORM_NOTIFICATIONS },
		{ label: '公告管理', route: ROUTE.ANNOUNCEMENTS },
	];

	return (
		<div>
			<Title level={3}>平台仪表盘</Title>
			<Row gutter={[16, 16]} className="mt-4">
				{kpis.map((kpi) => (
					<Col xs={24} sm={12} lg={6} key={kpi.title}>
						<Card hoverable onClick={() => go(kpi.route)}>
							{loading ? (
								<Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
							) : (
								<>
									<Statistic
										title={kpi.title}
										value={kpi.value}
										suffix={kpi.suffix}
										prefix={kpi.icon}
										valueStyle={
											kpi.warning ? { color: 'var(--color-warning)' } : undefined
										}
									/>
									<div className="mt-2 text-xs text-neutral-600">{kpi.note}</div>
								</>
							)}
						</Card>
					</Col>
				))}
			</Row>

			<Row gutter={[16, 16]} className="mt-6">
				<Col xs={24} lg={12}>
					<Card
						title="最近事故"
						extra={
							<Button type="link" size="small" onClick={() => go(ROUTE.INCIDENTS)}>
								全部事故
							</Button>
						}
					>
						{incidentsLoading ? (
							<Skeleton active paragraph={{ rows: 4 }} />
						) : recentIncidents.length === 0 ? (
							<div className="py-8 text-center text-neutral-600">暂无事故记录</div>
						) : (
							<ul>
								{recentIncidents.map((inc) => (
									<li
										key={inc.id}
										className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-b-0"
									>
										<div className="flex min-w-0 items-center gap-2">
											<StatusBadge variant={severityBadge[inc.severity] || 'neutral'}>
												{severityLabels[inc.severity] || inc.severity}
											</StatusBadge>
											<span className="truncate">{inc.title}</span>
										</div>
										<span className="shrink-0 text-xs text-neutral-600">
											{inc.createdAt ? formatDateTime(inc.createdAt) : '—'}
										</span>
									</li>
								))}
							</ul>
						)}
					</Card>
				</Col>
				<Col xs={24} lg={12}>
					<Card title="快捷入口">
						<div className="grid grid-cols-2 gap-1">
							{quickLinks.map((link) => (
								<Button
									key={link.route}
									type="link"
									className="justify-start !px-0"
									icon={<ArrowRightOutlined className="text-xs" />}
									onClick={() => go(link.route)}
								>
									{link.label}
								</Button>
							))}
						</div>
					</Card>
				</Col>
			</Row>
		</div>
	);
}
