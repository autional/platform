'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@autional/shared';
import { DataTable } from '@autional/ui/antd';
import { Alert, AppPageHeader } from '@autional/ui';
import { Card, Tabs, Tag, Input, Tooltip, Badge } from 'antd';
import {
	Cloud,
	Database,
	FlaskConical,
	MapPin,
	Search,
} from 'lucide-react';
import { ApiErrorState } from '@/components/ApiErrorState';
import {
	useServiceList,
	useEnvVars,
	useFeatureFlags,
	getInfraComponents,
	getStatusLabel,
	getFeatureLabel,
	type InfraComponent,
	type EnvVarItem,
	type FeatureFlagItem,
	type ServiceStatus,
	type FeatureStatus,
} from '@/hooks/use-system-config';

const { Search: SearchInput } = Input;

function ServicesTab() {
	const { t } = useTranslation();
	const { data: serviceList, isLoading, error, refetch } = useServiceList();

	if (error) {
		return (
			<ApiErrorState
				error={error}
				title={t('systemConfig.servicesLoadError')}
				onRetry={() => refetch()}
			/>
		);
	}

	const columns = [
		{
			title: t('systemConfig.colServiceName'),
			dataIndex: 'name',
			key: 'name',
			width: 200,
			render: (text: string) => <span className="font-mono text-sm">{text}</span>,
		},
		{
			title: t('systemConfig.colHttpPort'),
			dataIndex: 'httpPort',
			key: 'httpPort',
			width: 100,
			render: (v: number) => <code>{v}</code>,
		},
		{
			title: t('systemConfig.colGrpcPort'),
			dataIndex: 'grpcPort',
			key: 'grpcPort',
			width: 100,
			render: (v: number) => <code>{v || '—'}</code>,
		},
		{
			title: t('systemConfig.colCategory'),
			dataIndex: 'categoryLabel',
			key: 'categoryLabel',
			width: 100,
			render: (text: string) => <Tag>{text}</Tag>,
		},
		{
			title: t('common.status'),
			dataIndex: 'status',
			key: 'status',
			width: 100,
			render: (status: ServiceStatus) => (
				<Badge
					status={status === 'healthy' ? 'success' : status === 'unhealthy' ? 'error' : 'default'}
					text={getStatusLabel(status)}
				/>
			),
		},
		{
			title: t('systemConfig.colDescription'),
			dataIndex: 'description',
			key: 'description',
		},
	];

	return (
		<DataTable
			rowKey="key"
			columns={columns}
			dataSource={serviceList ?? []}
			loading={isLoading}
			pagination={false}
			size="middle"
			locale={{ emptyText: t('systemConfig.servicesEmpty') }}
		/>
	);
}

function InfrastructureTab() {
	const { t } = useTranslation();
	const columns = [
		{
			title: t('systemConfig.colComponentName'),
			dataIndex: 'name',
			key: 'name',
			width: 140,
			render: (text: string, record: InfraComponent) => {
				const icons: Record<string, React.ReactNode> = {
					postgres: <Database size="1em" className="mr-2 text-info" />,
					redis: <Database size="1em" className="mr-2 text-danger" />,
					rabbitmq: <Cloud size="1em" className="mr-2 text-warning" />,
					mongodb: <Database size="1em" className="mr-2 text-success" />,
					minio: <Cloud size="1em" className="mr-2 text-info" />,
				};
				return (
					<span>
						{icons[record.key]}
						{text}
					</span>
				);
			},
		},
		{
			title: t('systemConfig.colType'),
			dataIndex: 'typeLabel',
			key: 'typeLabel',
			width: 100,
			render: (text: string) => <Tag color="blue">{text}</Tag>,
		},
		{
			title: 'Host:Port',
			dataIndex: 'hostPort',
			key: 'hostPort',
			width: 240,
			render: (text: string) => <code className="text-xs">{text}</code>,
		},
		{
			title: t('systemConfig.colCredentialLocation'),
			dataIndex: 'credentialLocation',
			key: 'credentialLocation',
			width: 240,
			render: (text: string) => (
				<Tooltip title={text}>
					<code className="text-xs">{text}</code>
				</Tooltip>
			),
		},
		{
			title: t('systemConfig.colNotes'),
			dataIndex: 'description',
			key: 'description',
		},
	];

	return (
		<div>
			<Alert
				variant="warning"
				title={t('systemOverview.notConnected')}
				className="mb-4"
			>
				{t('systemConfig.infraAlertDetail')}
			</Alert>
			<DataTable
				rowKey="key"
				columns={columns}
				dataSource={getInfraComponents()}
				pagination={false}
				size="middle"
			/>
		</div>
	);
}

function EnvironmentVariablesTab() {
	const { t } = useTranslation();
	const [searchText, setSearchText] = useState('');
	const { data: envVarList, isLoading, error, refetch } = useEnvVars();

	const filtered = useMemo(() => {
		if (!envVarList) return [];
		if (!searchText.trim()) return envVarList;
		const lower = searchText.toLowerCase();
		return envVarList.filter(
			(item) =>
				item.name.toLowerCase().includes(lower) ||
				item.source.toLowerCase().includes(lower) ||
				item.category.toLowerCase().includes(lower),
		);
	}, [searchText, envVarList]);

	if (error) {
		return (
			<ApiErrorState
				error={error}
				title={t('systemConfig.envVarsLoadError')}
				onRetry={() => refetch()}
			/>
		);
	}

	const columns = [
		{
			title: t('systemConfig.colVarName'),
			dataIndex: 'name',
			key: 'name',
			width: 240,
			render: (text: string) => <code className="text-xs">{text}</code>,
		},
		{
			title: t('systemConfig.colCurrentValue'),
			dataIndex: 'value',
			key: 'value',
			width: 300,
			render: (text: string, record: EnvVarItem) =>
				record.masked ? (
					<Tag color="orange" className="font-mono">
						••••••••
					</Tag>
				) : (
					<code className="text-xs">{text}</code>
				),
		},
		{
			title: t('systemConfig.colCategory'),
			dataIndex: 'category',
			key: 'category',
			width: 100,
			render: (text: string) => <Tag>{text}</Tag>,
		},
		{
			title: t('systemConfig.colSource'),
			dataIndex: 'source',
			key: 'source',
		},
		{
			title: t('systemConfig.sensitive'),
			dataIndex: 'masked',
			key: 'masked',
			width: 80,
			render: (masked: boolean) =>
				masked ? (
					<Tag color="red">{t('systemConfig.sensitive')}</Tag>
				) : (
					<Tag color="green">{t('systemConfig.public')}</Tag>
				),
		},
	];

	return (
		<div>
			<div className="mb-4">
				<SearchInput
					placeholder={t('systemConfig.envVarsSearchPlaceholder')}
					allowClear
					onChange={(e) => setSearchText(e.target.value)}
					value={searchText}
					prefix={<Search size="1em" />}
					style={{ maxWidth: 480 }}
				/>
			</div>
			<DataTable
				rowKey="key"
				columns={columns}
				dataSource={filtered}
				loading={isLoading}
				pagination={{
					pageSize: 20,
					showSizeChanger: true,
					showTotal: (total) => t('systemConfig.envVarsTotal', { total }),
				}}
				size="middle"
				locale={{ emptyText: t('systemConfig.envVarsEmptyFiltered') }}
			/>
		</div>
	);
}

function FeatureFlagsTab() {
	const { t } = useTranslation();
	const { data: flags, isLoading: flagsLoading, error: flagsError, refetch: refetchFlags } = useFeatureFlags();
	const { data: serviceList, isLoading: svcLoading, error: svcError, refetch: refetchServices } = useServiceList();

	const isLoading = flagsLoading || svcLoading;

	const columns = useMemo(() => {
		if (!serviceList) return [];
		const serviceKeys = serviceList.map((s) => s.key);
		const serviceNames = serviceList.map((s) => s.name);

		return [
			{
				title: t('systemConfig.colFeature'),
				dataIndex: 'name',
				key: 'name',
				width: 180,
				fixed: 'left' as const,
				render: (text: string, record: FeatureFlagItem) => (
					<div>
						<div className="font-medium">{text}</div>
						<div className="text-xs text-neutral-600">{record.description}</div>
					</div>
				),
			},
			...serviceKeys.map((sk, idx) => ({
				title: (
					<Tooltip title={sk}>
						<span className="text-xs">{serviceNames[idx].replace('-service', '')}</span>
					</Tooltip>
				),
				dataIndex: ['services', sk],
				key: sk,
				width: 72,
				align: 'center' as const,
				render: (status: FeatureStatus) => {
					const label = getFeatureLabel(status);
					const color =
						status === 'enabled'
							? 'var(--color-success)'
							: status === 'disabled'
								? 'var(--color-text-disabled)'
								: undefined;
					return (
						<span
							style={{ color, fontSize: 16 }}
							title={
								status === 'enabled'
									? t('systemConfig.enabled')
									: status === 'disabled'
										? t('systemConfig.disabled')
										: t('systemConfig.notApplicable')
							}
						>
							{label}
						</span>
					);
				},
			})),
		];
	}, [serviceList, t]);

	const error = flagsError ?? svcError;
	if (error) {
		return (
			<ApiErrorState
				error={error}
				title={t('systemConfig.flagsLoadError')}
				onRetry={() => {
					refetchFlags();
					refetchServices();
				}}
			/>
		);
	}

	return (
		<div>
			<Alert
				variant="info"
				title={t('systemConfig.flagsAlertDetail')}
				className="mb-4"
			 />
			<DataTable
				rowKey="key"
				columns={columns}
				dataSource={flags ?? []}
				loading={isLoading}
				pagination={false}
				size="small"
				scroll={{ x: 'max-content' }}
				locale={{ emptyText: t('systemConfig.flagsEmpty') }}
			/>
			<div className="mt-3 text-xs text-neutral-600 flex gap-4">
				<span>✅ {t('systemConfig.enabled')}</span>
				<span>❌ {t('systemConfig.disabled')}</span>
				<span>— {t('systemConfig.notApplicable')}</span>
			</div>
		</div>
	);
}

export default function SystemConfigPage() {
	const { t } = useTranslation();
	usePageTitle(t('systemConfig.title', '系统配置'));
	const tabItems = [
		{
			key: 'services',
			label: (
				<span>
					<Cloud size="1em" />
					{t('systemConfig.tabServices')}
				</span>
			),
			children: <ServicesTab />,
		},
		{
			key: 'infrastructure',
			label: (
				<span>
					<Database size="1em" />
					{t('systemOverview.infrastructure')}
				</span>
			),
			children: <InfrastructureTab />,
		},
		{
			key: 'env-vars',
			label: (
				<span>
					<MapPin size="1em" />
					{t('systemConfig.tabEnvVars')}
				</span>
			),
			children: <EnvironmentVariablesTab />,
		},
		{
			key: 'feature-flags',
			label: (
				<span>
					<FlaskConical size="1em" />
					{t('systemConfig.tabFeatureFlags')}
				</span>
			),
			children: <FeatureFlagsTab />,
		},
	];

	return (
		<div>
			{/* PL-66：此前的「仅超级管理员可访问」红标与实际门禁不符
			    （PlatformMemberGuard 对 super_admin 与 admin 均放行），与 URL/环境变量/调度器等
			    同级页对齐后移除 */}
			<AppPageHeader title={t('systemConfig.title', '系统配置')} />
			<Card>
				<Tabs defaultActiveKey="services" items={tabItems} />
			</Card>
		</div>
	);
}
