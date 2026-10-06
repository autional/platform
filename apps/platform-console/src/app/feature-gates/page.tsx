'use client';
import { useMemo } from 'react';
import { useCurrentTenantId } from '@autional/shared';
import { DataTable } from '@autional/ui/antd';
import { Alert } from '@autional/ui';
import { Card, Switch, Space, App, Typography, Spin, Tag } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	adminBillingFeatureGates,
	adminBillingFeatureGatesOverrides,
	adminBillingFeatureGatesOverridesPut,
} from '@autional/shared/generated/api';


const { Title } = Typography;

export default function FeatureGatesPage() {
	const { message } = App.useApp();
	const queryClient = useQueryClient();
	const tenantId = useCurrentTenantId() ?? '';

	const { data: planGates, isLoading: planLoading } = useQuery({
		queryKey: ['feature-gates', tenantId],
		queryFn: async () => {
			const res = (await adminBillingFeatureGates()) as any;
			return res?.featureGates ?? res?.feature_gates ?? [];
		},
		enabled: !!tenantId,
	});

	const { data: overrides, isLoading: overrideLoading } = useQuery({
		queryKey: ['feature-gates-overrides', tenantId],
		queryFn: async () => {
			const res = await adminBillingFeatureGatesOverrides();
			return res?.overrides ?? [];
		},
		enabled: !!tenantId,
	});

	const overrideMutation = useMutation({
		mutationFn: async ({ gateKey, enabled }: { gateKey: string; enabled: boolean }) => {
			return adminBillingFeatureGatesOverridesPut({ gate_key: gateKey, enabled } as any);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['feature-gates-overrides'] });
			message.success('功能开关覆盖已更新');
		},
		onError: () => message.error('更新覆盖失败'),
	});

	const overrideMap = useMemo(() => {
		const map = new Map<string, boolean>();
		for (const o of (overrides ?? []) as any[]) {
			map.set(o.gateKey ?? o.gate_key, o.enabled);
		}
		return map;
	}, [overrides]);

	const planColumns = [
		{ title: '开关键', dataIndex: 'key', key: 'key' },
		{ title: '名称', dataIndex: 'name', key: 'name' },
		{
			title: '套餐默认',
			dataIndex: 'enabled',
			key: 'enabled',
			render: (v: boolean) => (
				<Space>
					<Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>
					<LockOutlined style={{ color: '#999', fontSize: 12 }} />
				</Space>
			),
		},
	];

	const overrideColumns = [
		{ title: '开关键', dataIndex: 'key', key: 'key' },
		{
			title: '套餐默认',
			dataIndex: 'enabled',
			key: 'enabled',
			render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '开' : '关'}</Tag>,
		},
		{
			title: '租户覆盖',
			key: 'override',
			render: (_: unknown, record: { key: string; enabled: boolean }) => {
				const currentOverride = overrideMap.get(record.key);
				const effective = currentOverride !== undefined ? currentOverride : record.enabled;
				return (
					<Space>
						<Switch
							checked={effective}
							onChange={(checked) =>
								overrideMutation.mutate({ gateKey: record.key, enabled: checked })
							}
							loading={overrideMutation.isPending}
						/>
						<Tag color={currentOverride !== undefined ? 'blue' : 'default'}>
							{currentOverride !== undefined ? '自定义' : '默认'}
						</Tag>
					</Space>
				);
			},
		},
	];

	if (planLoading || overrideLoading) {
		return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />;
	}

	return (
		<div style={{ padding: 24 }}>
			<Title level={3}>功能开关</Title>
			{/* PL-55：标明生效范围，避免误以为改的是平台全局（判定为「当前租户」） */}
			<Alert
				variant="info"
				title={`生效范围：当前租户${tenantId ? `（${tenantId}）` : ''}`}
				className="mb-4"
			>
				开关判定按当前租户生效：先取套餐默认权益，存在租户覆盖时以覆盖为准。
			</Alert>
			<Space direction="vertical" size="large" style={{ width: '100%' }}>
				<Card title="套餐能力">
					<DataTable
						dataSource={planGates}
						columns={planColumns}
						rowKey="key"
						pagination={false}
						size="small"
					/>
				</Card>
				<Card title="租户覆盖">
					<DataTable
						dataSource={planGates}
						columns={overrideColumns}
						rowKey="key"
						pagination={false}
						size="small"
					/>
				</Card>
			</Space>
		</div>
	);
}
