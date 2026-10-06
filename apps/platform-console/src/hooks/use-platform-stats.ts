'use client';

import { extractItem } from '@autional/shared';
import { queryKeys } from '@/lib/query-keys';
import type {
	CommunicationDashboardResponse,
	NotificationStatsResponse,
} from '@autional/shared/generated/types';
import { useQuery } from '@tanstack/react-query';
import { getPlatformCommunicationStats, getPlatformNotificationStats } from '@/lib/api.generated';

export function usePlatformCommunicationStats() {
	return useQuery({
		queryKey: queryKeys.platform.communicationStats,
		staleTime: 30000,
		queryFn: async () => {
			const res = await getPlatformCommunicationStats();
			const data = extractItem<CommunicationDashboardResponse>(res);
			return (
				data ?? {
					totalSent: 0,
					delivered: 0,
					failed: 0,
					deliveryRate: 0,
					byChannel: {},
					byStatus: {},
				}
			);
		},
	});
}

export function usePlatformNotificationStats() {
	return useQuery({
		queryKey: queryKeys.platform.notificationStats,
		staleTime: 30000,
		queryFn: async () => {
			const res = await getPlatformNotificationStats();
			const data = extractItem<NotificationStatsResponse>(res);
			// 不再 catch 吞错回退全 0：接口失败应走 error 态（notifications 页显示重试、
			// dashboard 显示「—」），此前会把故障谎报为“已发送 0 条”
			return data ?? { totalSent: 0, totalRead: 0, readRate: 0, byType: {} };
		},
	});
}
