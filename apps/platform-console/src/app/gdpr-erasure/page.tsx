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

const STATUS_LABEL: Record<ErasureRequest['status'], string> = {
	pending: '待处理',
	approved: '已批准',
	executing: '执行中',
	completed: '已完成',
	rejected: '已拒绝',
};

export default function GdprErasurePage() {
	usePageTitle('GDPR 被遗忘权');
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
			message.success('擦除执行成功');
			if (result?.results) {
				setExecutionResults(result.results);
				setResultModalOpen(true);
			}
		},
		onError: (err) => {
			handleApiError(err, '执行擦除失败');
		},
	});

	const filteredItems = useMemo(() => {
		if (!statusFilter) return items;
		return items.filter((item) => item.status === statusFilter);
	}, [items, statusFilter]);

	const columns = [
		{
			title: '用户 ID',
			key: 'user_id',
			ellipsis: true,
			render: (_: unknown, r: any) =>
				(r.userId as string) ?? (r.user_id as string) ?? '-',
		},
		{
			title: '租户 ID',
			key: 'tenant_id',
			ellipsis: true,
			render: (_: unknown, r: any) =>
				(r.tenantId as string) ?? (r.tenant_id as string) ?? '-',
		},
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: ErasureRequest['status']) => (
				<StatusBadge variant={STATUS_VARIANT[v]}>{STATUS_LABEL[v]}</StatusBadge>
			),
		},
		{
			title: '请求时间',
			key: 'requested_at',
			render: (_: unknown, r: any) => {
				const v = (r.requestedAt as string) ?? (r.requested_at as string) ?? '';
				return v ? new Date(v).toLocaleString('zh-CN') : '-';
			},
		},
		{
			title: '原因',
			dataIndex: 'reason',
			key: 'reason',
			ellipsis: true,
		},
		{
			title: '操作',
			key: 'action',
			render: (_: unknown, record: ErasureRequest) =>
				record.status === 'approved' ? (
					<Popconfirm
						title="确认执行擦除"
						description={`这将永久擦除用户 ${record.userId ?? record.user_id ?? ''} 在身份、资料、会话、MFA、OAuth、积分与通知服务中的数据。此操作不可撤销。`}
						onConfirm={() => executeMutation.mutate(record.id)}
						okText="执行"
						okButtonProps={{ danger: true }}
						cancelText="取消"
					>
						<Button type="link" danger loading={executeMutation.isPending}>
							执行
						</Button>
					</Popconfirm>
				) : null,
		},
	];

	const resultColumns = [
		{ title: '服务', dataIndex: 'service', key: 'service' },
		{
			title: '状态',
			dataIndex: 'status',
			key: 'status',
			render: (v: string) => (
				<StatusBadge variant={v === 'success' ? 'success' : 'danger'}>{v}</StatusBadge>
			),
		},
	];

	return (
		<div>
			<AppPageHeader title="GDPR 被遗忘权" />

			<SectionCard className="mt-6">
				<Alert
					variant="warning"
					title="擦除不可撤销"
					className="mb-4"
				>
					擦除操作不可撤销。执行前请确认已通知用户，且等待期已结束。
				</Alert>

				<div className="flex items-center justify-between mb-4">
					<Select
						placeholder="按状态筛选"
						allowClear
						value={statusFilter}
						onChange={setStatusFilter}
						style={{ width: 200 }}
						options={[
							{ value: 'pending', label: '待处理' },
							{ value: 'approved', label: '已批准' },
							{ value: 'executing', label: '执行中' },
							{ value: 'completed', label: '已完成' },
							{ value: 'rejected', label: '已拒绝' },
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
								title="暂无擦除请求"
								description="未找到 GDPR 被遗忘权请求。"
							/>
						),
					}}
				/>
			</SectionCard>

			<Modal
				title="擦除执行结果"
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
					<Empty description="暂无结果" />
				)}
			</Modal>
		</div>
	);
}
