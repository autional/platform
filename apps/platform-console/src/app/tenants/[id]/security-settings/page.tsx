'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Form, Select, Button, Card, Spin, Descriptions, Tag } from 'antd';
import { message } from '@/lib/antd-app';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { extractItem, usePageTitle } from '@autional/shared';
import { apiClient, API_PATHS } from '@autional/shared';
import { handleApiError } from '@/lib/error-handler';
import { PageError } from '@autional/ui/antd';
import { ConsolePageHeader } from '@autional/ui';

interface SodConfigData {
	sod_mode: 'single' | 'strict';
}

export default function SecuritySettingsPage() {
	usePageTitle('安全设置 — 职责分离（SoD）');
	const { id: tenantId } = useParams<{ id: string }>();
	const [form] = Form.useForm<SodConfigData>();
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchConfig = async () => {
		if (!tenantId) return;
		setLoading(true);
		setError(null);
		try {
			const res = await apiClient.get(API_PATHS.TENANT.SOD_CONFIG(tenantId));
			// U99：响应经 camelCaseKeys 拦截器，读取侧键为 sodMode；写入侧仍用 snake_case。
			const item = extractItem<{ sodMode?: string }>(res);
			if (item) {
				form.setFieldsValue({ sod_mode: item.sodMode as 'single' | 'strict' });
			}
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

	const handleSave = async (values: SodConfigData) => {
		if (!tenantId) return;
		setSaving(true);
		try {
			await apiClient.put(API_PATHS.TENANT.SOD_CONFIG(tenantId), { sod_mode: values.sod_mode });
			message.success('SoD 配置已保存');
		} catch (err) {
			handleApiError(err, '保存 SoD 配置失败');
		} finally {
			setSaving(false);
		}
	};

	if (!tenantId) {
		return null;
	}

	return (
		<div className="max-w-2xl">
			<ConsolePageHeader
				title="职责分离配置 (SoD)"
				actions={
					<>
						<Button icon={<ReloadOutlined />} onClick={fetchConfig} loading={loading}>
							刷新
						</Button>
					</>
				}
			/>

			{error && <PageError message="加载 SoD 配置失败" retry={fetchConfig} className="mb-4" />}

			<Spin spinning={loading}>
				<Card className="mb-6">
					<Descriptions column={1} size="small" className="mb-4">
						<Descriptions.Item label="租户 ID">
							<Tag className="font-mono text-xs">{tenantId}</Tag>
						</Descriptions.Item>
					</Descriptions>

					<div className="mb-4 p-3 bg-info-soft rounded text-sm text-info-text">
						<strong>SoD (职责分离)</strong> 决定 <code>admin</code> 角色能否查看审计数据详情：
						<ul className="mt-1 ml-4 list-disc">
							<li>
								<strong>single</strong> — admin 可查看审计统计和操作反馈（适合小团队）
							</li>
							<li>
								<strong>strict</strong> — admin 仅可查看审计统计数量（适合受监管企业）
							</li>
						</ul>
					</div>

					<Form
						form={form}
						layout="vertical"
						onFinish={handleSave}
						initialValues={{ sod_mode: 'single' }}
					>
						<Form.Item
							label="SoD 模式"
							name="sod_mode"
							rules={[{ required: true, message: '请选择 SoD 模式' }]}
						>
							<Select>
								<Select.Option value="single">single — 单角色模式（默认）</Select.Option>
								<Select.Option value="strict">strict — 严格模式</Select.Option>
							</Select>
						</Form.Item>

						<Form.Item>
							<Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
								保存配置
							</Button>
						</Form.Item>
					</Form>
				</Card>
			</Spin>
		</div>
	);
}
