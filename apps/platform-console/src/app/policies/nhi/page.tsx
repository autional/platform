'use client';

import React, { useEffect } from 'react';
import { Form, InputNumber, Select, Button, Skeleton } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { usePageTitle } from '@autional/shared';
import { ConsolePageHeader, ErrorState, SectionCard } from '@autional/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminPoliciesNhi, adminPoliciesNhiPut } from '@autional/shared/generated/api';
import { message, modal } from '@/lib/antd-app';
import { handleApiError } from '@/lib/error-handler';
import { queryKeys } from '@/lib/query-keys';
import { diffNhiPolicy, normalizeNhiPolicy, type NhiPolicy } from '@/lib/nhi-policy';

async function fetchNhiPolicy(): Promise<NhiPolicy> {
	const data = await adminPoliciesNhi();
	return normalizeNhiPolicy((data?.data ?? data) as Record<string, unknown>);
}

async function saveNhiPolicy(values: NhiPolicy): Promise<NhiPolicy> {
	const data = await adminPoliciesNhiPut(values as any);
	return normalizeNhiPolicy((data?.data ?? data) as Record<string, unknown>);
}

export default function NhiPolicyPage() {
	usePageTitle('NHI 策略');
	const queryClient = useQueryClient();
	const [form] = Form.useForm<NhiPolicy>();

	const {
		data: policy,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.nhiPolicy.all,
		queryFn: fetchNhiPolicy,
		staleTime: 300000,
	});

	useEffect(() => {
		if (policy) {
			form.setFieldsValue(policy);
		}
	}, [policy, form]);

	const saveMut = useMutation({
		mutationFn: saveNhiPolicy,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.nhiPolicy.all });
		},
	});

	const performSave = async (values: NhiPolicy) => {
		try {
			await saveMut.mutateAsync(values);
			message.success('NHI 策略保存成功');
		} catch (err) {
			handleApiError(err, '保存失败');
		}
	};

	const handleSave = (values: NhiPolicy) => {
		const changes = diffNhiPolicy(policy ?? {}, values);
		if (changes.length === 0) {
			message.info('策略未变更，未提交');
			return;
		}
		modal.confirm({
			title: '确认保存以下变更？',
			content: (
				<div className="space-y-1">
					{changes.map((c) => (
						<div key={c.field}>
							{c.label}：{String(c.from ?? '—')} → <strong>{String(c.to)}</strong>
						</div>
					))}
				</div>
			),
			okText: '保存',
			cancelText: '取消',
			onOk: () => performSave(values),
		});
	};

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton active />
				<Skeleton active />
				<Skeleton active />
			</div>
		);
	}

	if (error && !policy) {
		return (
			<div>
				<ErrorState
					title="加载 NHI 策略失败"
					message="请检查网络连接后重试。"
					onRetry={() => refetch()}
				/>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<ConsolePageHeader
					title="NHI 策略配置"
					description="配置租户级的非人类身份（NHI）生命周期管理默认值。"
				/>
			</div>

			<Form form={form} layout="vertical" onFinish={handleSave}>
				<SectionCard title="Agent 默认值">
					<Form.Item
						name="agentMaxCount"
						label="Agent 数量上限"
						rules={[{ required: true, message: '必填' }]}
					>
						<InputNumber min={1} max={10000} style={{ width: 200 }} />
					</Form.Item>
					<Form.Item
						name="agentDefaultTtl"
						label="Agent 默认 TTL"
						rules={[{ required: true, message: '必填' }]}
					>
						<Select
							style={{ width: 200 }}
							options={[
								{ value: '5m', label: '5 分钟' },
								{ value: '15m', label: '15 分钟' },
								{ value: '30m', label: '30 分钟' },
								{ value: '1h', label: '1 小时' },
							]}
						/>
					</Form.Item>
				</SectionCard>

				<SectionCard title="Robot 默认值" className="mt-6">
					<Form.Item
						name="robotMaxCount"
						label="Robot 数量上限"
						rules={[{ required: true, message: '必填' }]}
					>
						<InputNumber min={1} max={10000} style={{ width: 200 }} />
					</Form.Item>
				</SectionCard>

				<SectionCard title="Device 默认值" className="mt-6">
					<Form.Item
						name="deviceMaxPerOwner"
						label="每个所有者 Device 上限"
						rules={[{ required: true, message: '必填' }]}
					>
						<InputNumber min={1} max={1000} style={{ width: 200 }} />
					</Form.Item>
				</SectionCard>

				<SectionCard title="安全默认值" className="mt-6">
					<Form.Item
						name="rotationDaysDefault"
						label="默认轮换周期（天）"
						rules={[{ required: true, message: '必填' }]}
					>
						<InputNumber min={1} max={365} style={{ width: 200 }} />
					</Form.Item>
				</SectionCard>

				<div className="mt-6">
					<Button
						type="primary"
						htmlType="submit"
						icon={<SaveOutlined />}
						loading={saveMut.isPending}
						size="large"
					>
						保存策略
					</Button>
				</div>
			</Form>
		</div>
	);
}
