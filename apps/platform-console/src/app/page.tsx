import { useMemo, type ReactNode } from 'react';
import { Button, Card, Col, Row, Skeleton, Statistic } from 'antd';
import {
	AlertTriangle,
	ArrowRight,
	Cloud,
	Megaphone,
	Users,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { AppPageHeader, StatusBadge } from '@autional/ui';
import { useSystemTenants } from '@/hooks/use-system-overview';
import { useIncidents, useOverview } from '@/hooks/use-status';
import { usePlatformNotificationStats } from '@/hooks/use-platform-stats';
import { ROUTE } from '@/lib/route-paths';
import { buildNavHref } from '@/lib/nav';
import { formatDateTime } from '@/lib/format';
import { severityBadge, severityLabels } from '@/lib/incident-meta';

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
	const { t } = useTranslation();
	usePageTitle(t('dashboard.title', '平台仪表盘'));
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
			title: t('dashboard.kpi.tenants', '租户总数'),
			value: tenants?.total ?? '—',
			icon: <Users size="1em" />,
			note: t('dashboard.kpi.tenantsNote', '点击下钻 · 租户管理'),
			route: ROUTE.TENANTS,
			warning: !!tenantsError,
		},
		{
			title: t('dashboard.kpi.incidents', '活跃事故'),
			value: overview?.activeIncidents ?? '—',
			icon: <AlertTriangle size="1em" />,
			note: t('dashboard.note.publicStatus', '公开状态页口径 · 点击下钻'),
			route: ROUTE.INCIDENTS,
			warning: !!overviewError,
		},
		{
			title: t('dashboard.kpi.healthy', '健康服务'),
			value: overview?.servicesHealthy ?? '—',
			suffix: overview?.servicesTotal != null ? `/ ${overview.servicesTotal}` : undefined,
			icon: <Cloud size="1em" />,
			note: t('dashboard.note.publicStatus', '公开状态页口径 · 点击下钻'),
			route: ROUTE.OPS,
			warning: !!overviewError,
		},
		{
			title: t('dashboard.kpi.notifications', '平台通知'),
			value: stats?.totalSent ?? '—',
			icon: <Megaphone size="1em" />,
			note: t('dashboard.kpi.notificationsNote', '站内通知全量累计 · 点击下钻'),
			route: ROUTE.PLATFORM_NOTIFICATIONS,
			warning: !!statsError,
		},
	];

	const quickLinks = [
		{ label: t('dashboard.quick.tenants', '租户管理'), route: ROUTE.TENANTS },
		{ label: t('dashboard.quick.incidents', '事故管理'), route: ROUTE.INCIDENTS },
		{ label: t('dashboard.quick.maintenances', '维护窗口'), route: ROUTE.MAINTENANCES },
		{ label: t('dashboard.quick.ops', '运维视图'), route: ROUTE.OPS },
		{ label: t('dashboard.quick.notifications', '平台通知'), route: ROUTE.PLATFORM_NOTIFICATIONS },
		{ label: t('dashboard.quick.announcements', '公告管理'), route: ROUTE.ANNOUNCEMENTS },
	];

	return (
		<div>
			<AppPageHeader title={t('dashboard.title', '平台仪表盘')} />
			<Row gutter={[16, 16]} className="mt-4">
				{kpis.map((kpi) => (
					<Col xs={24} sm={12} lg={6} key={kpi.route}>
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
										styles={
											kpi.warning ? { content: { color: 'var(--color-warning)' } } : undefined
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
						title={t('dashboard.recentIncidents', '最近事故')}
						extra={
							<Button type="link" size="small" onClick={() => go(ROUTE.INCIDENTS)}>
								{t('dashboard.allIncidents', '全部事故')}
							</Button>
						}
					>
						{incidentsLoading ? (
							<Skeleton active paragraph={{ rows: 4 }} />
						) : recentIncidents.length === 0 ? (
							<div className="py-8 text-center text-neutral-600">
								{t('dashboard.noIncidents', '暂无事故记录')}
							</div>
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
					<Card title={t('dashboard.quickLinks', '快捷入口')}>
						<div className="grid grid-cols-2 gap-1">
							{quickLinks.map((link) => (
								<Button
									key={link.route}
									type="link"
									className="justify-start !px-0"
									icon={<ArrowRight size="1em" className="text-xs" />}
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
