'use client';

import React, { useMemo } from 'react';
import { DataTable } from '@autional/ui/antd';
import { Card, Statistic, Tag, Row, Col, Spin } from 'antd';
import {
	CheckCircleOutlined,
	CloseCircleOutlined,
	AppstoreOutlined,
	SettingOutlined,
	MinusOutlined,
} from '@ant-design/icons';
import { usePageTitle } from '@autional/shared';
import { Alert, ConsolePageHeader } from '@autional/ui';
import { adminFeatureFlags } from '@autional/shared/generated/api';
import { useQuery } from '@tanstack/react-query';
import { ApiErrorState } from '@/components/ApiErrorState';

interface FeatureFlagsResponse {
	services: {
		service: string;
		display_name?: string;
		port?: number;
		flags?: { key: string; value: string | boolean; description?: string; category?: string }[];
	}[];
}

export default function FeatureFlagsPage() {
	usePageTitle('功能开关');

	const { data, isLoading, error, refetch } = useQuery<FeatureFlagsResponse>({
		queryKey: ['feature-flags'],
		queryFn: async () => {
			const res = await adminFeatureFlags();
			const payload = res?.data ?? res;
			return payload as FeatureFlagsResponse;
		},
		staleTime: 30000,
	});

	const { columns, flagKeys } = useMemo(() => {
		if (!data?.services) {
			return { columns: [], flagKeys: [] as string[] };
		}

		// API 返回 services 数组 [{service, display_name, port, flags: [{key, value, ...}]}]
		// 转换为字典 {serviceName: {flagKey: boolean}} 供矩阵渲染（2026-08-16 修复：原假设
		// 为对象字典导致列全空 — P2 契约 bug）
		const servicesMap: Record<string, Record<string, boolean>> = {};
		for (const svc of data.services) {
			const flags: Record<string, boolean> = {};
			for (const f of svc.flags ?? []) {
				flags[f.key] = f.value === 'true' || f.value === true;
			}
			servicesMap[svc.service] = flags;
		}

		const serviceNames = Object.keys(servicesMap);
		const allKeys = new Set<string>();

		for (const svc of serviceNames) {
			const flags = servicesMap[svc];
			if (flags) {
				for (const k of Object.keys(flags)) {
					allKeys.add(k);
				}
			}
		}

		const keys = Array.from(allKeys).sort();

		return {
			flagKeys: keys,
			columns: [
				{
					title: '服务',
					dataIndex: 'service',
					key: 'service',
					fixed: 'left' as const,
					width: 220,
					render: (v: string) => <strong>{v}</strong>,
				},
				...keys.map((flag) => ({
					title: <span style={{ textTransform: 'capitalize' }}>{flag.replace(/_/g, ' ')}</span>,
					dataIndex: flag,
					key: flag,
					width: 140,
					align: 'center' as const,
					render: (v: boolean | undefined) => {
						if (v === true) {
							return (
								<Tag color="green" icon={<CheckCircleOutlined />}>
									启用
								</Tag>
							);
						}
						if (v === false) {
							return (
								<Tag color="default" icon={<CloseCircleOutlined />}>
									禁用
								</Tag>
							);
						}
						return <MinusOutlined style={{ color: 'var(--color-text-disabled)' }} />;
					},
				})),
			],
		};
	}, [data]);

	const tableData = useMemo(() => {
		if (!data?.services) return [];
		// 数组 → 字典 → rows（2026-08-16 修复）
		const servicesMap: Record<string, Record<string, boolean>> = {};
		for (const svc of data.services) {
			const flags: Record<string, boolean> = {};
			for (const f of svc.flags ?? []) {
				flags[f.key] = f.value === 'true' || f.value === true;
			}
			servicesMap[svc.service] = flags;
		}
		return Object.entries(servicesMap).map(([service, flags]) => ({
			service,
			...flags,
		}));
	}, [data]);

	const totalServices = Array.isArray(data?.services) ? data.services.length : 0;
	const totalFeaturesEnabled = useMemo(() => {
		if (!data?.services) return 0;
		let count = 0;
		for (const svc of data.services) {
			for (const f of svc.flags ?? []) {
				if (f.value === 'true' || f.value === true) count++;
			}
		}
		return count;
	}, [data]);

	return (
		<div>
			<div className="mb-6">
				<ConsolePageHeader
					title="功能开关矩阵"
					description="跨服务功能开关配置矩阵 —— 全部 21 个服务总览"
				/>
			</div>

			{/* PL-55：标明生效范围，避免误读为租户级开关（实为网关内置清单） */}
			<Alert
				variant="info"
				title="生效范围：当前部署（全部服务，非租户级）"
				className="mb-4"
			>
				本矩阵为网关内置的服务能力清单，随部署版本生效、所有租户共用，仅供总览、不在此页变更。
			</Alert>

			{error && !isLoading ? (
				<ApiErrorState error={error} title="加载功能开关失败" onRetry={() => refetch()} />
			) : (
				<>
					<Row gutter={[16, 16]} className="mb-6">
						<Col xs={24} sm={8}>
							<Card>
								<Statistic
									title="服务总数"
									value={isLoading ? '-' : totalServices}
									prefix={<AppstoreOutlined />}
								/>
							</Card>
						</Col>
						<Col xs={24} sm={8}>
							<Card>
								<Statistic
									title="功能键"
									value={isLoading ? '-' : flagKeys.length}
									prefix={<SettingOutlined />}
								/>
							</Card>
						</Col>
						<Col xs={24} sm={8}>
							<Card>
								<Statistic
									title="已启用功能"
									value={isLoading ? '-' : totalFeaturesEnabled}
									prefix={<CheckCircleOutlined />}
									valueStyle={{ color: 'var(--color-success-text)' }}
								/>
							</Card>
						</Col>
					</Row>

					<Spin spinning={isLoading}>
						<DataTable
							columns={columns}
							dataSource={tableData}
							rowKey="service"
							pagination={false}
							scroll={{ x: 'max-content' }}
							bordered
							size="small"
							locale={{ emptyText: '暂无功能开关数据' }}
						/>
					</Spin>
				</>
			)}
		</div>
	);
}
