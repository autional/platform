'use client';

import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { Form, InputNumber, Button, Card, Spin, Descriptions, Tag } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { message } from '@/lib/antd-app';
import { RefreshCw, Save } from 'lucide-react';
import { usePageTitle } from '@autional/shared';
import { updateTenantQuota } from '@/lib/api.generated';
import { handleApiError } from '@/lib/error-handler';
import { PageError } from '@autional/ui/antd';
import { AppPageHeader } from '@autional/ui';
import { useTenant } from '@/hooks/use-tenants';
import { queryKeys } from '@/lib/query-keys';
import { gbFromBytes, resolveMaxStorageBytes } from '@/lib/quota';

interface QuotaFormValues {
	usersLimit?: number;
	storageGb?: number;
	apiCallsPerMonth?: number;
}

interface TenantDetailShape {
	name?: string;
	plan?: string;
	maxUsers?: number;
	maxStorage?: number;
	maxBandwidth?: number;
	maxApiRequests?: number;
}

export default function QuotaPage() {
	usePageTitle('资源配额');
	const { id: tenantId } = useParams<{ id: string }>();
	const [form] = Form.useForm<QuotaFormValues>();
	const queryClient = useQueryClient();

	const { data: tenant, isLoading, error, refetch } = useTenant(tenantId || '');
	const detail = (tenant ?? undefined) as TenantDetailShape | undefined;

	const maxStorageBytes = typeof detail?.maxStorage === 'number' ? detail.maxStorage : undefined;
	const initialGb = maxStorageBytes != null ? gbFromBytes(maxStorageBytes) : undefined;

	useEffect(() => {
		if (!detail) return;
		form.setFieldsValue({
			usersLimit: detail.maxUsers,
			storageGb: initialGb,
			apiCallsPerMonth: detail.maxApiRequests,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [detail]);

	const handleSave = async (values: QuotaFormValues) => {
		if (!tenantId || !detail) return;
		try {
			await updateTenantQuota(tenantId, {
				maxUsers: values.usersLimit,
				maxStorage: resolveMaxStorageBytes(values.storageGb, initialGb, maxStorageBytes),
				// 带宽不在此表单编辑；后端为整表覆盖语义，必须原样回发现值，否则会被清零
				maxBandwidth: detail.maxBandwidth,
				maxApiRequests: values.apiCallsPerMonth,
			});
			message.success('资源配额更新成功');
			queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(tenantId) });
		} catch (err) {
			handleApiError(err, '保存失败');
		}
	};

	return (
		<div>
			<AppPageHeader
				title="资源配额"
				// PL-13：此前页面只暴露路由里的原始 ULID，看不出在给哪个租户配置
				description={detail?.name ? `租户：${detail.name}` : tenantId ? `租户 ID：${tenantId}` : undefined}
				actions={
					<>
						<Button icon={<RefreshCw size="1em" />} onClick={() => refetch()}>
							刷新
						</Button>
					</>
				}
			/>

			{error && <PageError message="加载资源配额失败" retry={() => refetch()} className="mb-4" />}

			<Spin spinning={isLoading}>
				{detail && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<Card title="当前用量">
							<Descriptions column={1} bordered size="small">
								<Descriptions.Item label="当前套餐">
									<Tag color="blue">{detail.plan || '-'}</Tag>
								</Descriptions.Item>
								{/* 用量三行恒显示 —：配额接口的 used_* 字段后端未填充（恒零值，
								    非真实用量），照搬会谎报“已用 0”（旧版「0/0 GB」误导性） */}
								<Descriptions.Item label="活跃用户">
									— / {detail.maxUsers ?? '-'}
								</Descriptions.Item>
								<Descriptions.Item label="已用存储">
									— / {initialGb ?? '-'} GB
								</Descriptions.Item>
								<Descriptions.Item label="API 调用量">
									— / {detail.maxApiRequests ?? '-'}
								</Descriptions.Item>
							</Descriptions>
						</Card>

						<Card title="配额设置">
							<Form form={form} layout="vertical" onFinish={handleSave}>
								<Form.Item
									name="usersLimit"
									label="最大用户数"
									rules={[{ required: true, message: '请输入最大用户数' }]}
								>
									<InputNumber min={1} max={1000000} style={{ width: '100%' }} placeholder="100" />
								</Form.Item>

								<Form.Item
									name="storageGb"
									label="最大存储 (GB)"
									rules={[{ required: true, message: '请输入最大存储容量' }]}
								>
									{/* min=0：现存 tenant 有 100MB 级配额（0.098 GB），min=1 会把它
									    判成越界红字（PL-16） */}
									<InputNumber min={0} max={100000} style={{ width: '100%' }} placeholder="50" />
								</Form.Item>

								<Form.Item
									name="apiCallsPerMonth"
									label="最大 API 请求数 (次/月)"
									rules={[{ required: true, message: '请输入最大 API 请求数' }]}
								>
									<InputNumber
										min={1}
										max={100000000}
										style={{ width: '100%' }}
										placeholder="10000"
									/>
								</Form.Item>

								<Button type="primary" htmlType="submit" icon={<Save size="1em" />}>
									保存配置
								</Button>
							</Form>
						</Card>
					</div>
				)}
			</Spin>
		</div>
	);
}
