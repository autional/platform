'use client';

import React, { useState, useMemo } from 'react';
import { DataTable } from '@autional/ui/antd';
import { Alert, AppPageHeader } from '@autional/ui';
import { Card, Tabs, Tag, Input, Tooltip, Badge } from 'antd';
import {
	CloudServerOutlined,
	DatabaseOutlined,
	EnvironmentOutlined,
	ExperimentOutlined,
	SearchOutlined,
} from '@ant-design/icons';
import { ApiErrorState } from '@/components/ApiErrorState';
import {
	useServiceList,
	useEnvVars,
	useFeatureFlags,
	infraComponents,
	getStatusLabel,
	getFeatureLabel,
	type InfraComponent,
	type EnvVarItem,
	type FeatureFlagItem,
	type ServiceStatus,
	type FeatureStatus,
} from '@/hooks/use-system-config';

const { Search } = Input;

function ServicesTab() {
	const { data: serviceList, isLoading, error, refetch } = useServiceList();

	if (error) {
		return <ApiErrorState error={error} title="加载服务列表失败" onRetry={() => refetch()} />;
	}

	const columns = [
		{
			title: '服务名称',
			dataIndex: 'name',
			key: 'name',
			width: 200,
			render: (text: string) => <span className="font-mono text-sm">{text}</span>,
		},
		{
			title: 'HTTP 端口',
			dataIndex: 'httpPort',
			key: 'httpPort',
			width: 100,
			render: (v: number) => <code>{v}</code>,
		},
		{
			title: 'gRPC 端口',
			dataIndex: 'grpcPort',
			key: 'grpcPort',
			width: 100,
			render: (v: number) => <code>{v || '—'}</code>,
		},
		{
			title: '分类',
			dataIndex: 'categoryLabel',
			key: 'categoryLabel',
			width: 100,
			render: (text: string) => <Tag>{text}</Tag>,
		},
		{
			title: '状态',
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
			title: '描述',
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
			locale={{ emptyText: '暂无服务数据' }}
		/>
	);
}

function InfrastructureTab() {
	const columns = [
		{
			title: '组件名称',
			dataIndex: 'name',
			key: 'name',
			width: 140,
			render: (text: string, record: InfraComponent) => {
				const icons: Record<string, React.ReactNode> = {
					postgres: <DatabaseOutlined className="mr-2 text-info" />,
					redis: <DatabaseOutlined className="mr-2 text-danger" />,
					rabbitmq: <CloudServerOutlined className="mr-2 text-warning" />,
					mongodb: <DatabaseOutlined className="mr-2 text-success" />,
					minio: <CloudServerOutlined className="mr-2 text-info" />,
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
			title: '类型',
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
			title: '凭证位置',
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
			title: '说明',
			dataIndex: 'description',
			key: 'description',
		},
	];

	return (
		<div>
			<Alert
				variant="warning"
				title="未接入"
				className="mb-4"
			>
				"中间件健康数据源尚未接入；下表为静态配置参考，非实时状态。"
			</Alert>
			<DataTable
				rowKey="key"
				columns={columns}
				dataSource={infraComponents}
				pagination={false}
				size="middle"
			/>
		</div>
	);
}

function EnvironmentVariablesTab() {
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
		return <ApiErrorState error={error} title="加载环境变量失败" onRetry={() => refetch()} />;
	}

	const columns = [
		{
			title: '变量名',
			dataIndex: 'name',
			key: 'name',
			width: 240,
			render: (text: string) => <code className="text-xs">{text}</code>,
		},
		{
			title: '当前值',
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
			title: '分类',
			dataIndex: 'category',
			key: 'category',
			width: 100,
			render: (text: string) => <Tag>{text}</Tag>,
		},
		{
			title: '来源',
			dataIndex: 'source',
			key: 'source',
		},
		{
			title: '敏感',
			dataIndex: 'masked',
			key: 'masked',
			width: 80,
			render: (masked: boolean) =>
				masked ? <Tag color="red">敏感</Tag> : <Tag color="green">公开</Tag>,
		},
	];

	return (
		<div>
			<div className="mb-4">
				<Search
					placeholder="搜索环境变量名称、来源或分类..."
					allowClear
					onChange={(e) => setSearchText(e.target.value)}
					value={searchText}
					prefix={<SearchOutlined />}
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
					showTotal: (total) => `共 ${total} 个变量`,
				}}
				size="middle"
				locale={{ emptyText: '未找到匹配的环境变量' }}
			/>
		</div>
	);
}

function FeatureFlagsTab() {
	const { data: flags, isLoading: flagsLoading, error: flagsError, refetch: refetchFlags } = useFeatureFlags();
	const { data: serviceList, isLoading: svcLoading, error: svcError, refetch: refetchServices } = useServiceList();

	const isLoading = flagsLoading || svcLoading;

	const columns = useMemo(() => {
		if (!serviceList) return [];
		const serviceKeys = serviceList.map((s) => s.key);
		const serviceNames = serviceList.map((s) => s.name);

		return [
			{
				title: '功能特性',
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
							title={status === 'enabled' ? '已启用' : status === 'disabled' ? '未启用' : '不适用'}
						>
							{label}
						</span>
					);
				},
			})),
		];
	}, [serviceList]);

	const error = flagsError ?? svcError;
	if (error) {
		return (
			<ApiErrorState
				error={error}
				title="加载功能标志失败"
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
				title="功能标志矩阵列出了各服务中功能的启用状态。此数据仅供查看，不在本页面提供启停操作。"
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
				locale={{ emptyText: '暂无功能标志数据' }}
			/>
			<div className="mt-3 text-xs text-neutral-600 flex gap-4">
				<span>✅ 已启用</span>
				<span>❌ 未启用</span>
				<span>— 不适用</span>
			</div>
		</div>
	);
}

export default function SystemConfigPage() {
	const tabItems = [
		{
			key: 'services',
			label: (
				<span>
					<CloudServerOutlined />
					服务列表
				</span>
			),
			children: <ServicesTab />,
		},
		{
			key: 'infrastructure',
			label: (
				<span>
					<DatabaseOutlined />
					基础设施
				</span>
			),
			children: <InfrastructureTab />,
		},
		{
			key: 'env-vars',
			label: (
				<span>
					<EnvironmentOutlined />
					环境变量
				</span>
			),
			children: <EnvironmentVariablesTab />,
		},
		{
			key: 'feature-flags',
			label: (
				<span>
					<ExperimentOutlined />
					功能标志
				</span>
			),
			children: <FeatureFlagsTab />,
		},
	];

	return (
		<div>
			<AppPageHeader
				title="系统配置"
				actions={
					<>
						<Tag color="red" className="text-xs">
							仅超级管理员可访问
						</Tag>
					</>
				}
			/>
			<Card>
				<Tabs defaultActiveKey="services" items={tabItems} />
			</Card>
		</div>
	);
}
