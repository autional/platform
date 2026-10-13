'use client';

import React, { useEffect } from 'react';
import { Form, InputNumber, Select, Button, Skeleton } from 'antd';
import { Save } from 'lucide-react';
import { usePageTitle } from '@autional/shared';
import { AppPageHeader, ErrorState, SectionCard } from '@autional/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminPoliciesNhi, adminPoliciesNhiPut } from '@autional/shared/generated/api';
import { message, modal } from '@/lib/antd-app';
import { handleApiError } from '@/lib/error-handler';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation();
	usePageTitle(t('policies.nhi.title'));
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
			message.success(t('policies.nhi.saveSuccess'));
		} catch (err) {
			handleApiError(err, t('common.saveFailed'));
		}
	};

	const handleSave = (values: NhiPolicy) => {
		const changes = diffNhiPolicy(policy ?? {}, values);
		if (changes.length === 0) {
			message.info(t('policies.nhi.noChanges'));
			return;
		}
		modal.confirm({
			title: t('policies.nhi.confirmSaveTitle'),
			content: (
				<div className="space-y-1">
					{changes.map((c) => (
						<div key={c.field}>
							{c.label}：{String(c.from ?? '—')} → <strong>{String(c.to)}</strong>
						</div>
					))}
				</div>
			),
			okText: t('common.save'),
			cancelText: t('common.cancel'),
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
					title={t('policies.nhi.loadError')}
					message={t('policies.nhi.retryHint')}
					onRetry={() => refetch()}
				/>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<AppPageHeader
					title={t('policies.nhi.header')}
					description={t('policies.nhi.description')}
				/>
			</div>

			<Form form={form} layout="vertical" onFinish={handleSave}>
				<SectionCard title={t('policies.nhi.agentDefaults')}>
					<Form.Item
						name="agentMaxCount"
						label={t('policies.nhi.field.agentMaxCount')}
						rules={[{ required: true, message: t('policies.nhi.required') }]}
					>
						<InputNumber min={1} max={10000} style={{ width: 200 }} />
					</Form.Item>
					<Form.Item
						name="agentDefaultTtl"
						label={t('policies.nhi.field.agentDefaultTtl')}
						rules={[{ required: true, message: t('policies.nhi.required') }]}
					>
						<Select
							style={{ width: 200 }}
							options={[
								{ value: '5m', label: t('policies.nhi.ttl5m') },
								{ value: '15m', label: t('policies.nhi.ttl15m') },
								{ value: '30m', label: t('policies.nhi.ttl30m') },
								{ value: '1h', label: t('policies.nhi.ttl1h') },
							]}
						/>
					</Form.Item>
				</SectionCard>

				<SectionCard title={t('policies.nhi.robotDefaults')} className="mt-6">
					<Form.Item
						name="robotMaxCount"
						label={t('policies.nhi.field.robotMaxCount')}
						rules={[{ required: true, message: t('policies.nhi.required') }]}
					>
						<InputNumber min={1} max={10000} style={{ width: 200 }} />
					</Form.Item>
				</SectionCard>

				<SectionCard title={t('policies.nhi.deviceDefaults')} className="mt-6">
					<Form.Item
						name="deviceMaxPerOwner"
						label={t('policies.nhi.field.deviceMaxPerOwner')}
						rules={[{ required: true, message: t('policies.nhi.required') }]}
					>
						<InputNumber min={1} max={1000} style={{ width: 200 }} />
					</Form.Item>
				</SectionCard>

				<SectionCard title={t('policies.nhi.securityDefaults')} className="mt-6">
					<Form.Item
						name="rotationDaysDefault"
						label={t('policies.nhi.field.rotationDaysDefault')}
						rules={[{ required: true, message: t('policies.nhi.required') }]}
					>
						<InputNumber min={1} max={365} style={{ width: 200 }} />
					</Form.Item>
				</SectionCard>

				<div className="mt-6">
					<Button
						type="primary"
						htmlType="submit"
						icon={<Save size="1em" />}
						loading={saveMut.isPending}
						size="large"
					>
						{t('policies.nhi.save')}
					</Button>
				</div>
			</Form>
		</div>
	);
}
