'use client';

import React, { useState, useMemo } from 'react';
import { DataTable, Modal } from '@autional/ui/antd';
import { Button, Select, Popconfirm, Empty } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, usePageTitle } from '@autional/shared';
import { Alert, AppPageHeader, EmptyState, SectionCard, StatusBadge } from '@autional/ui';
import {
	adminComplianceGdprRightToErasure,
	adminComplianceGdprRightToErasurePost,
} from '@autional/shared/generated/api';
import { message } from '@/lib/antd-app';
import { handleApiError } from '@/lib/error-handler';
import { useTranslation } from 'react-i18next';
import type { StatusVariant } from '@autional/ui';

interface ErasureRequest {
	id: string;
	userId?: string;
	user_id?: string;
	tenant_id: string;
	status: 'pending' | 'approved' | 'executing' | 'completed' | 'rejected';
	requested_at: string;
	reason: string;
}

interface ExecutionResult {
	service: string;
	status: string;
}

const STATUS_VARIANT: Record<ErasureRequest['status'], StatusVariant> = {
	pending: 'warning',
	approved: 'info',
	executing: 'neutral',
	completed: 'success',
	rejected: 'danger',
};

// 键映射 + 调用时求值（组件内渲染处用组件 t）
const STATUS_LABEL_KEYS: Record<ErasureRequest['status'], string> = {
	pending: 'gdprErasure.status.pending',
	approved: 'gdprErasure.status.approved',
	executing: 'gdprErasure.status.executing',
	completed: 'gdprErasure.status.completed',
	rejected: 'gdprErasure.status.rejected',
};

export default function GdprErasurePage() {
	const { t } = useTranslation();
	usePageTitle(t('gdprErasure.title'));
	const queryClient = useQueryClient();
	const [statusFilter, setStatusFilter] = useState<ErasureRequest['status'] | undefined>();
	const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
	const [resultModalOpen, setResultModalOpen] = useState(false);

	const { data: items = [], isLoading } = useQuery<ErasureRequest[]>({
		queryKey: ['gdpr-erasure'],
		queryFn: async () => {
			const data = await adminComplianceGdprRightToErasure();
			return (data?.items ?? []) as ErasureRequest[];
		},
	});

	const executeMutation = useMutation({
		mutationFn: async (id: string) => {
			const data = await adminComplianceGdprRightToErasurePost(id);
			return data as { status: string; results: ExecutionResult[] };
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ['gdpr-erasure'] });
			message.success(t('gdprErasure.executeSuccess'));
			if (result?.results) {
				setExecutionResults(result.results);
				setResultModalOpen(true);
			}
		},
		onError: (err) => {
			handleApiError(err, t('gdprErasure.executeFailed'));
		},
	});

	const filteredItems = useMemo(() => {
		if (!statusFilter) return items;
		return items.filter((item) => item.status === statusFilter);
	}, [items, statusFilter]);

	const columns = [
		{
			title: t('gdprErasure.colUserId'),
			key: 'user_id',
			ellipsis: true,
			render: (_: unknown, r: any) =>
				(r.userId as string) ?? (r.user_id as string) ?? '-',
		},
		{
			title: t('gdprErasure.colTenantId'),
			key: 'tenant_id',
			ellipsis: true,
			render: (_: unknown, r: any) =>
				(r.tenantId as string) ?? (r.tenant_id as string) ?? '-',
		},
		{
			title: t('common.status'),
			dataIndex: 'status',
			key: 'status',
			render: (v: ErasureRequest['status']) => (
				<StatusBadge variant={STATUS_VARIANT[v]}>{t(STATUS_LABEL_KEYS[v])}</StatusBadge>
			),
		},
		{
			title: t('gdprErasure.colRequestedAt'),
			key: 'requested_at',
			render: (_: unknown, r: any) => {
				const v = (r.requestedAt as string) ?? (r.requested_at as string) ?? '';
				return v ? new Date(v).toLocaleString('zh-CN') : '-';
			},
		},
		{
			title: t('gdprErasure.colReason'),
			dataIndex: 'reason',
			key: 'reason',
			ellipsis: true,
		},
		{
			title: t('common.actions'),
			key: 'action',
			render: (_: unknown, record: ErasureRequest) =>
				record.status === 'approved' ? (
					<Popconfirm
						title={t('gdprErasure.confirmTitle')}
						description={t('gdprErasure.confirmDesc', {
							userId: record.userId ?? record.user_id ?? '',
						})}
						onConfirm={() => executeMutation.mutate(record.id)}
						okText={t('gdprErasure.execute')}
						okButtonProps={{ danger: true }}
						cancelText={t('common.cancel')}
					>
						<Button type="link" danger loading={executeMutation.isPending}>
							{t('gdprErasure.execute')}
						</Button>
					</Popconfirm>
				) : null,
		},
	];

	const resultColumns = [
		{ title: t('gdprErasure.colService'), dataIndex: 'service', key: 'service' },
		{
			title: t('common.status'),
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => (
				<StatusBadge variant={v === 'success' ? 'success' : 'danger'}>{v}</StatusBadge>
			),
		},
	];

	return (
		<div>
			<AppPageHeader title={t('gdprErasure.title')} />

			<SectionCard className="mt-6">
				<Alert
					variant="warning"
					title={t('gdprErasure.alertTitle')}
					className="mb-4"
				>
					{t('gdprErasure.alertDesc')}
				</Alert>

				<div className="flex items-center justify-between mb-4">
					<Select
						placeholder={t('gdprErasure.filterPlaceholder')}
						allowClear
						value={statusFilter}
						onChange={setStatusFilter}
						style={{ width: 200 }}
						options={[
							{ value: 'pending', label: t('gdprErasure.status.pending') },
							{ value: 'approved', label: t('gdprErasure.status.approved') },
							{ value: 'executing', label: t('gdprErasure.status.executing') },
							{ value: 'completed', label: t('gdprErasure.status.completed') },
							{ value: 'rejected', label: t('gdprErasure.status.rejected') },
						]}
					/>
				</div>

				<DataTable
					rowKey="id"
					columns={columns}
					dataSource={filteredItems}
					loading={isLoading}
					pagination={{ pageSize: 10 }}
					locale={{
						emptyText: (
							<EmptyState
								title={t('gdprErasure.emptyTitle')}
								description={t('gdprErasure.emptyDesc')}
							/>
						),
					}}
				/>
			</SectionCard>

			<Modal
				title={t('gdprErasure.resultTitle')}
				open={resultModalOpen}
				onCancel={() => setResultModalOpen(false)}
				footer={null}
				width={600}
			>
				{executionResults.length > 0 ? (
					<DataTable
						dataSource={executionResults}
						columns={resultColumns}
						rowKey="service"
						pagination={false}
						size="small"
					/>
				) : (
					<Empty description={t('gdprErasure.resultEmpty')} />
				)}
			</Modal>
		</div>
	);
}
