'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { DataTable } from '@autional/ui/antd';
import { Input, Button, Skeleton } from 'antd';
import { Eye, EyeOff, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@autional/shared';
import { adminEnvVars } from '@autional/shared/generated/api';
import { AppPageHeader, EmptyState } from '@autional/ui';
import { ApiErrorState } from '@/components/ApiErrorState';
import { queryKeys } from '@/lib/query-keys';

interface EnvVarRecord {
	key: string;
	value: string;
	source_file?: string;
	source?: string;
	masked?: boolean;
	category?: string;
}

function maskValue(value: string): string {
	if (!value) return '';
	return '•'.repeat(12);
}

async function fetchEnvVars(): Promise<EnvVarRecord[]> {
	const data = await adminEnvVars();
	if (data?.variables && Array.isArray(data.variables)) return data.variables;
	if (Array.isArray(data)) return data;
	return [];
}

export default function EnvVarsPage() {
	const { t } = useTranslation();
	usePageTitle(t('envVars.title', '环境变量'));
	const [searchText, setSearchText] = useState('');
	const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

	const {
		data = [],
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.platform.envVars(),
		queryFn: fetchEnvVars,
		staleTime: 60000,
	});

	const filtered = useMemo(() => {
		if (!searchText.trim()) return data;
		const lower = searchText.toLowerCase();
		return data.filter((v) => v.key.toLowerCase().includes(lower));
	}, [data, searchText]);

	const toggleReveal = useCallback((key: string) => {
		setRevealedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}, []);

	const columns = [
		{
			title: t('envVars.colKey', '键'),
			dataIndex: 'key',
			key: 'key',
			width: 320,
			render: (v: string) => (
				<code className="text-xs font-mono bg-neutral-200 dark:bg-neutral-900 px-2 py-0.5 rounded-xs">
					{v}
				</code>
			),
		},
		{
			title: t('envVars.colValue', '值'),
			dataIndex: 'value',
			key: 'value',
			render: (v: string, record: EnvVarRecord) => {
				const revealed = revealedKeys.has(record.key);
				return (
					<div className="flex items-center gap-2">
						<code className="text-xs font-mono">{revealed ? v : maskValue(v)}</code>
						<Button
							type="text"
							size="small"
							icon={revealed ? <EyeOff size="1em" /> : <Eye size="1em" />}
							onClick={() => toggleReveal(record.key)}
							title={revealed ? t('envVars.hide', '隐藏值') : t('envVars.reveal', '显示值')}
						/>
					</div>
				);
			},
		},
		{
			title: t('envVars.colSource', '来源文件'),
			key: 'source',
			render: (_: unknown, r: EnvVarRecord) => (
				<code className="text-xs font-mono text-neutral-600">{r.source || r.source_file || '—'}</code>
			),
			width: 240,
		},
	];

	return (
		<div>
			<AppPageHeader
				title={t('envVars.title', '环境变量')}
				description={t('envVars.subtitle', '查看各服务运行时加载的全部环境变量。')}
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
					<ApiErrorState error={error} title={t('envVars.loadError', '加载环境变量失败')} onRetry={() => refetch()} />
				)}

				{!isLoading && !error && (
					<>
						<div className="mb-4">
							<Input
								placeholder={t('envVars.searchPlaceholder', '按键名搜索…')}
								allowClear
								prefix={<Search size="1em" />}
								value={searchText}
								onChange={(e) => setSearchText(e.target.value)}
								style={{ maxWidth: 480 }}
							/>
						</div>

						{filtered.length === 0 && data.length > 0 ? (
							<EmptyState
								title={t('envVars.emptyFilteredTitle', '无匹配的变量')}
								description={t('envVars.emptyFilteredDesc', '请尝试调整搜索条件。')}
							/>
						) : filtered.length === 0 ? (
							<EmptyState
								title={t('envVars.emptyTitle', '暂无环境变量')}
								description={t('envVars.emptyDesc', '当前没有加载任何环境变量。')}
							/>
						) : (
							<DataTable
								rowKey="key"
								columns={columns}
								dataSource={filtered}
								pagination={{ pageSize: 20, showSizeChanger: true }}
								size="middle"
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
}
