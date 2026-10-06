'use client';

import React from 'react';
import { Card, Tag, Descriptions } from 'antd';
import {
	CloudServerOutlined,
	CheckCircleOutlined,
	CloseCircleOutlined,
	QuestionCircleOutlined,
} from '@ant-design/icons';
import { ConsolePageHeader } from '@autional/ui';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ops } from '@/lib/api.generated';
import { PageLoading } from '@autional/ui/antd';
import { ApiErrorState } from '@/components/ApiErrorState';

interface RateLimitData {
	available: boolean;
	providerName: string;
}

export default function SystemRateLimitsPage() {
	const { t } = useTranslation();

	const { data, isLoading, error, refetch } = useQuery<RateLimitData>({
		queryKey: ['system', 'rate-limits'],
		staleTime: 30000,
		queryFn: async () => {
			const raw = await ops.rateLimits();
			const inner = raw?.data ?? raw;
			return {
				available: inner?.available ?? false,
				providerName: inner?.providerName ?? inner?.provider_name ?? 'unknown',
			};
		},
	});

	if (isLoading) return <PageLoading />;

	return (
		<div>
			<ConsolePageHeader
				title={t('rateLimits.title', '限流状态')}
				description={t(
					'rateLimits.subtitle',
					'网关限流器提供方（provider）可用性状态；限流策略与命中统计暂未接入。',
				)}
			/>

			{error ? (
				<div className="mt-6">
					<ApiErrorState
						error={error}
						title={t('rateLimits.loadError', '加载限流状态失败')}
						onRetry={() => refetch()}
					/>
				</div>
			) : !data ? null : (
				<Card
					className="mt-6 max-w-lg"
					title={
						<span>
							<CloudServerOutlined className="mr-2" />
							{t('rateLimits.providerStatus', '提供方状态')}
						</span>
					}
				>
					<Descriptions bordered column={1} size="middle">
						<Descriptions.Item label={t('rateLimits.available', '是否可用')}>
							{data.available ? (
								<Tag icon={<CheckCircleOutlined />} color="success">
									{t('rateLimits.yes', '可用')}
								</Tag>
							) : (
								<Tag icon={<CloseCircleOutlined />} color="error">
									{t('rateLimits.no', '不可用')}
								</Tag>
							)}
						</Descriptions.Item>
						<Descriptions.Item label={t('rateLimits.provider', '提供方')}>
							<Tag icon={<QuestionCircleOutlined />} color="blue">
								{data.providerName}
							</Tag>
						</Descriptions.Item>
					</Descriptions>
				</Card>
			)}
		</div>
	);
}
