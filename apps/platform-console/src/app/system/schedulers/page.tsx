'use client';

import { Card, Tag, Badge, Statistic, Row, Col, Button } from 'antd';
import {
	CheckCircle2,
	Clock,
	MinusCircle,
	RefreshCw,
	XCircle,
} from 'lucide-react';
import { AppPageHeader } from '@autional/ui';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@autional/shared';
import { PageLoading, DataTable } from '@autional/ui/antd';
import { useSchedulers } from '@/hooks/use-schedulers';
import { ApiErrorState } from '@/components/ApiErrorState';
import { formatDateTime } from '@/lib/format';

const statusConfig: Record<string, { labelKey: string; label: string }> = {
	running: { labelKey: 'schedulers.statusRunning', label: '运行中' },
	paused: { labelKey: 'schedulers.statusPaused', label: '已暂停' },
	failed: { labelKey: 'schedulers.statusFailed', label: '失败' },
	disabled: { labelKey: 'schedulers.statusDisabled', label: '已禁用' },
};

export default function SystemSchedulersPage() {
	const { t } = useTranslation();
	usePageTitle(t('schedulers.title', '系统作业'));
	const { data, isLoading, error, refetch } = useSchedulers();

	if (isLoading) return <PageLoading />;

	const stats = {
		running: data.filter((s) => s.status === 'running').length,
		paused: data.filter((s) => s.status === 'paused').length,
		failed: data.filter((s) => s.status === 'failed').length,
		disabled: data.filter((s) => s.status === 'disabled').length,
	};

	const columns = [
		{
			title: t('schedulers.name', '名称'),
			dataIndex: 'name',
			key: 'name',
			render: (name: string) => <strong style={{ fontFamily: 'monospace' }}>{name}</strong>,
		},
		{
			title: t('schedulers.service', '服务'),
			dataIndex: 'service',
			key: 'service',
			render: (svc: string) => <Tag>{svc}</Tag>,
		},
		{
			title: t('schedulers.interval', '间隔'),
			dataIndex: 'interval',
			key: 'interval',
			render: (interval: string) => (
				<span>
					<Clock size="1em" style={{ marginRight: 6 }} />
					{interval || '—'}
				</span>
			),
		},
		{
			title: t('schedulers.status', '状态'),
			dataIndex: 'status',
			key: 'status',
			render: (status: string) => {
				const cfg = statusConfig[status] || statusConfig.disabled;
				return (
					<Badge
						status={
							status === 'running' ? 'success' : status === 'paused' ? 'warning' : 'error'
						}
						text={t(cfg.labelKey, cfg.label)}
					/>
				);
			},
		},
		{
			title: t('schedulers.lastRun', '上次运行'),
			dataIndex: 'lastRun',
			key: 'lastRun',
			// 后端 last_run 为 ISO 串；零值（从未运行）为 Go 零时间 "0001-01-01T00:00:00Z"，兜底为「—」
			render: (v: string) => (v && !v.startsWith('0001-01-01') ? formatDateTime(v) : '—'),
		},
	];

	return (
		<div>
			<AppPageHeader
				title={t('schedulers.title', '系统作业')}
				description={t('schedulers.subtitle', '各服务后台调度器的运行状态（只读）。')}
			/>

			{error ? (
				<div className="mt-6">
					<ApiErrorState
						error={error}
						title={t('schedulers.loadError', '加载调度器状态失败')}
						onRetry={() => refetch()}
					/>
				</div>
			) : (
				<>
					<Row gutter={16} style={{ marginBottom: 24 }}>
						<Col span={6}>
							<Card>
								<Statistic
									title={t('schedulers.statusRunning', '运行中')}
									value={stats.running}
									styles={{ content: { color: 'var(--color-success)' } }}
									prefix={<CheckCircle2 size="1em" />}
								/>
							</Card>
						</Col>
						<Col span={6}>
							<Card>
								<Statistic
									title={t('schedulers.statusPaused', '已暂停')}
									value={stats.paused}
									styles={{ content: { color: 'var(--color-warning)' } }}
									prefix={<MinusCircle size="1em" />}
								/>
							</Card>
						</Col>
						<Col span={6}>
							<Card>
								<Statistic
									title={t('schedulers.statusFailed', '失败')}
									value={stats.failed}
									styles={{ content: { color: 'var(--color-danger)' } }}
									prefix={<XCircle size="1em" />}
								/>
							</Card>
						</Col>
						<Col span={6}>
							<Card>
								<Statistic
									title={t('schedulers.statusDisabled', '已禁用')}
									value={stats.disabled}
									styles={{ content: { color: 'var(--color-text-disabled)' } }}
									prefix={<XCircle size="1em" />}
								/>
							</Card>
						</Col>
					</Row>

					<Card
						title={t('schedulers.list', '调度器列表')}
						extra={
							<Button icon={<RefreshCw size="1em" />} onClick={() => refetch()}>
								{t('common.refresh', '刷新')}
							</Button>
						}
					>
						<DataTable
							dataSource={data}
							columns={columns}
							rowKey="id"
							pagination={{ pageSize: 20 }}
							size="middle"
						/>
					</Card>
				</>
			)}
		</div>
	);
}
