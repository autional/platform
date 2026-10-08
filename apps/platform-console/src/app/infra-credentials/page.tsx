'use client';

import React, { useMemo } from 'react';
import { DataTable } from '@autional/ui/antd';
import { Tag, Skeleton } from 'antd';
import {
	Cloud,
	Database,
	Globe,
	HardDrive,
	ShieldCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@autional/shared';
import { adminInfraCredentials } from '@autional/shared/generated/api';
import { AppPageHeader, EmptyState, SectionCard } from '@autional/ui';
import { ApiErrorState } from '@/components/ApiErrorState';
import { queryKeys } from '@/lib/query-keys';

interface CredentialRecord {
	name: string;
	key?: string;
	infrastructure?: string;
	container?: string;
	source_file?: string;
	consumers?: string[] | null;
	category?: string;
	location?: string;
	type?: string;
}

const TYPE_LABELS: Record<string, string> = {
	database: '数据库',
	cache: '缓存',
	mq: '消息队列',
	storage: '存储',
	monitoring: '监控',
	security: '安全',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
	database: <Database size="1em" />,
	cache: <HardDrive size="1em" />,
	mq: <Cloud size="1em" />,
	storage: <Cloud size="1em" />,
	monitoring: <Cloud size="1em" />,
	security: <ShieldCheck size="1em" />,
};

const TYPE_COLORS: Record<string, string> = {
	database: 'blue',
	cache: 'red',
	mq: 'orange',
	storage: 'cyan',
	monitoring: 'purple',
	security: 'green',
};

const TYPE_ORDER = ['database', 'cache', 'mq', 'storage', 'monitoring', 'security'];

async function fetchInfraCredentials(): Promise<CredentialRecord[]> {
	const data = await adminInfraCredentials();
	if (data?.credentials && Array.isArray(data.credentials)) return data.credentials;
	if (Array.isArray(data)) return data;
	return [];
}

export default function InfraCredentialsPage() {
	const { t } = useTranslation();
	usePageTitle(t('infraCredentials.title', '基础设施凭证'));

	const {
		data = [],
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.platform.infraCredentials(),
		queryFn: fetchInfraCredentials,
		staleTime: 60000,
	});

	const groupedByType = useMemo(() => {
		const groups: Record<string, CredentialRecord[]> = {};
		for (const cred of data) {
			const type = cred.category || cred.type || 'Other';
			(groups[type] ??= []).push(cred);
		}
		return groups;
	}, [data]);

	const sortedTypes = useMemo(() => {
		const present = Object.keys(groupedByType);
		return TYPE_ORDER.filter((tp) => present.includes(tp)).concat(
			present.filter((tp) => !TYPE_ORDER.includes(tp)),
		);
	}, [groupedByType]);

	const columns = [
		{
			title: t('infraCredentials.colName', '名称'),
			dataIndex: 'name',
			key: 'name',
			render: (v: string) => (
				<code className="text-xs font-mono bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded-xs">
					{v}
				</code>
			),
		},
		{
			title: t('infraCredentials.colLocation', '位置'),
			key: 'location',
			render: (_: unknown, r: CredentialRecord) => (
				<code className="text-xs font-mono text-neutral-600">
					{r.container || r.location || '—'}
				</code>
			),
		},
	];

	return (
		<div>
			<AppPageHeader
				title={t('infraCredentials.title', '基础设施凭证')}
				description={t(
					'infraCredentials.description',
					'数据库、缓存、消息队列、存储与 API 服务的基础设施凭证总览。',
				)}
			/>

			<div className="mt-6">
				{isLoading && (
					<div className="space-y-3">
						<Skeleton active />
						<Skeleton active />
						<Skeleton active />
					</div>
				)}

				{!isLoading && error && (
					<ApiErrorState
						error={error}
						title={t('infraCredentials.loadError', '加载基础设施凭证失败')}
						onRetry={() => refetch()}
					/>
				)}

				{!isLoading && !error && data.length === 0 && (
					<EmptyState
						title={t('infraCredentials.emptyTitle', '暂无基础设施凭证')}
						description={t('infraCredentials.emptyDesc', '当前尚未配置任何基础设施凭证。')}
					/>
				)}

				{!isLoading && !error && data.length > 0 && (
					<div className="space-y-6">
						{sortedTypes.map((type) => {
							const items = groupedByType[type];
							const label = t(`infraCredentials.type.${type}`, TYPE_LABELS[type] || type);
							const icon = TYPE_ICONS[type] || <Globe size="1em" />;
							const color = TYPE_COLORS[type] || 'default';

							return (
								<SectionCard key={type}>
									<div className="flex items-center gap-2 mb-4">
										<span className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
											{icon}
											{label}
											<Tag color={color} className="ml-2">
												{items.length}
											</Tag>
										</span>
									</div>
									<DataTable
										rowKey="name"
										columns={columns}
										dataSource={items}
										pagination={false}
										size="small"
									/>
								</SectionCard>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
