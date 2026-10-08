'use client';

import React, { useMemo } from 'react';
import { DataTable } from '@autional/ui/antd';
import { Tag, Skeleton } from 'antd';
import {
	DatabaseOutlined,
	CloudServerOutlined,
	HddOutlined,
	GlobalOutlined,
	SafetyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
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
	database: <DatabaseOutlined />,
	cache: <HddOutlined />,
	mq: <CloudServerOutlined />,
	storage: <CloudServerOutlined />,
	monitoring: <CloudServerOutlined />,
	security: <SafetyOutlined />,
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

const columns = [
	{
		title: '名称',
		dataIndex: 'name',
		key: 'name',
		render: (v: string) => (
			<code className="text-xs font-mono bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded">
				{v}
			</code>
		),
	},
	{
		title: '位置',
		key: 'location',
		render: (_: unknown, r: CredentialRecord) => (
			<code className="text-xs font-mono text-neutral-600">
				{r.container || r.location || '—'}
			</code>
		),
	},
];

export default function InfraCredentialsPage() {
	usePageTitle('基础设施凭据');

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
		return TYPE_ORDER.filter((t) => present.includes(t)).concat(
			present.filter((t) => !TYPE_ORDER.includes(t)),
		);
	}, [groupedByType]);

	return (
		<div>
			<AppPageHeader
				title="基础设施凭据"
				description="数据库、缓存、消息队列、存储与 API 服务的基础设施凭据总览。"
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
					<ApiErrorState error={error} title="加载基础设施凭据失败" onRetry={() => refetch()} />
				)}

				{!isLoading && !error && data.length === 0 && (
					<EmptyState
						title="暂无基础设施凭据"
						description="当前尚未配置任何基础设施凭据。"
					/>
				)}

				{!isLoading && !error && data.length > 0 && (
					<div className="space-y-6">
						{sortedTypes.map((type) => {
							const items = groupedByType[type];
							const label = TYPE_LABELS[type] || type;
							const icon = TYPE_ICONS[type] || <GlobalOutlined />;
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
