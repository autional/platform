'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Form, InputNumber, Select, Button, Card, Spin } from 'antd';
import { message } from '@/lib/antd-app';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { extractItem, usePageTitle } from '@autional/shared';
import { getInvitationConfig, updateInvitationConfig } from '@/lib/api.generated';
import { handleApiError } from '@/lib/error-handler';
import { PageError } from '@autional/ui/antd';
import { Alert, ConsolePageHeader } from '@autional/ui';
import { useTenant } from '@/hooks/use-tenants';

interface InvitationConfigData {
	inviteExpiryDays?: number;
	defaultInviteRole?: string;
}

export default function InvitationConfigPage() {
	usePageTitle('邀请配置');
	const { id: tenantId } = useParams<{ id: string }>();
	// PL-13：页面此前只暴露路由里的原始 ULID，取租户名做上下文（失败时回落显示 ID）
	const { data: tenant } = useTenant(tenantId || '');
	const tenantName = typeof tenant?.name === 'string' ? tenant.name : undefined;
	const [form] = Form.useForm<InvitationConfigData>();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [data, setData] = useState<InvitationConfigData>({
		inviteExpiryDays: 7,
		defaultInviteRole: 'member',
	});

	const fetchConfig = async () => {
		if (!tenantId) return;
		setLoading(true);
		setError(null);
		try {
			const res = await getInvitationConfig(tenantId);
			const item = extractItem<InvitationConfigData>(res);
			// PL-14：空响应按失败处理——否则表单会带前端默认值（member/7 天）可提交，
			// 把「没读到配置」静默写回后端。
			if (!item) throw new Error('邀请配置响应为空');
			setData(item);
			form.setFieldsValue(item);
		} catch (err) {
			setError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchConfig();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tenantId]);

	const handleSave = async (values: InvitationConfigData) => {
		if (!tenantId) return;
		try {
			await updateInvitationConfig(tenantId, {
				inviteExpiryDays: values.inviteExpiryDays,
				defaultInviteRole: values.defaultInviteRole,
			});
			message.success('邀请配置保存成功');
		} catch (err) {
			handleApiError(err, '保存失败');
		}
	};

	return (
		<div>
			<ConsolePageHeader
				title="邀请配置"
				description={tenantName ? `租户：${tenantName}` : tenantId ? `租户 ID：${tenantId}` : undefined}
				actions={
					<>
						<Button icon={<ReloadOutlined />} onClick={fetchConfig}>
							刷新
						</Button>
					</>
				}
			/>

			{error ? (
				// PL-14：失败态只给错误与重试；此前表单照常渲染且带默认值，可直接保存
				<PageError message="加载邀请配置失败" retry={fetchConfig} className="mb-4" />
			) : (
				<Spin spinning={loading}>
					<Card title="邀请设置" className="max-w-2xl">
						<Form form={form} layout="vertical" onFinish={handleSave} initialValues={data}>
							<Form.Item
								name="inviteExpiryDays"
								label="邀请过期天数"
								rules={[{ required: true, message: '请输入邀请过期天数' }]}
							>
								<InputNumber min={1} max={180} style={{ width: '100%' }} placeholder="7" />
							</Form.Item>

							<Form.Item
								name="defaultInviteRole"
								label="默认邀请角色"
								rules={[{ required: true, message: '请选择默认角色' }]}
							>
								<Select placeholder="选择角色">
									<Select.Option value="member">成员 (Member)</Select.Option>
									<Select.Option value="admin">管理员 (Admin)</Select.Option>
								</Select>
							</Form.Item>

							<Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
								保存配置
							</Button>

							<Alert
								variant="info"
								title="每日邀请上限 — 未接入"
								className="mt-4"
							>
								"后端邀请配置接口暂未提供每日邀请上限字段；接入后在此展示并支持配置。"
							</Alert>
						</Form>
					</Card>
				</Spin>
			)}
		</div>
	);
}
