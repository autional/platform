'use client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentTenantId, usePageTitle } from '@autional/shared';
import { DataTable } from '@autional/ui/antd';
import { Alert, AppPageHeader } from '@autional/ui';
import { Card, Switch, Space, App, Spin, Tag, Popconfirm, Button } from 'antd';
import { Lock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	adminBillingFeatureGates,
	adminBillingFeatureGatesOverrides,
	adminBillingFeatureGatesOverridesPut,
	adminBillingFeatureGatesOverridesByOverridesDelete,
} from '@autional/shared/generated/api';

export default function FeatureGatesPage() {
	const { t } = useTranslation();
	usePageTitle(t('featureGates.title', '功能门控'));
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
			message.success(t('featureGates.overrideUpdated', '功能门控覆盖已更新'));
		},
		onError: () => message.error(t('featureGates.overrideFailed', '更新覆盖失败')),
	});

	const overrideClearMutation = useMutation({
		mutationFn: async (gateKey: string) => {
			return adminBillingFeatureGatesOverridesByOverridesDelete(gateKey);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['feature-gates-overrides'] });
			message.success(t('featureGates.overrideCleared', '功能门控覆盖已清除'));
		},
		onError: () => message.error(t('featureGates.overrideClearFailed', '清除覆盖失败')),
	});

	const overrideMap = useMemo(() => {
		const map = new Map<string, boolean>();
		for (const o of (overrides ?? []) as any[]) {
			map.set(o.gateKey ?? o.gate_key, o.enabled);
		}
		return map;
	}, [overrides]);

	const planColumns = [
		{ title: '门控键', dataIndex: 'key', key: 'key' },
		{ title: '名称', dataIndex: 'name', key: 'name' },
		{
			title: '套餐默认',
			dataIndex: 'enabled',
			key: 'enabled',
			render: (v: boolean) => (
				<Space>
					<Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>
					<Lock size={12} style={{ color: '#999' }} />
				</Space>
			),
		},
	];

	const overrideColumns = [
		{ title: '门控键', dataIndex: 'key', key: 'key' },
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
						{currentOverride !== undefined && (
							<Popconfirm
								title={t('featureGates.clearOverrideTitle', '清除该门控的租户覆盖？')}
								description={t(
									'featureGates.clearOverrideDesc',
									'清除后将恢复为套餐默认权益。'
								)}
								onConfirm={() => overrideClearMutation.mutate(record.key)}
								okText={t('featureGates.clearOverrideOk', '清除')}
								okButtonProps={{ danger: true }}
								cancelText={t('featureGates.clearOverrideCancel', '取消')}
							>
								<Button
									size="small"
									type="link"
									loading={
										overrideClearMutation.isPending &&
										overrideClearMutation.variables === record.key
									}
								>
									{t('featureGates.clearOverride', '清除覆盖')}
								</Button>
							</Popconfirm>
						)}
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
			<AppPageHeader title={t('featureGates.title', '功能门控')} />
			{/* PL-55：标明生效范围，避免误以为改的是平台全局（判定为「当前租户」） */}
			<Alert
				variant="info"
				title={`生效范围：当前租户${tenantId ? `（${tenantId}）` : ''}`}
				className="mb-4"
			>
				门控判定按当前租户生效：先取套餐默认权益，存在租户覆盖时以覆盖为准。
			</Alert>
			<Space orientation="vertical" size="large" style={{ width: '100%' }}>
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
