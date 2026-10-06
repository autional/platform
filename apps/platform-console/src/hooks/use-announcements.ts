'use client';

import { extractList } from '@autional/shared';
import { queryKeys } from '@/lib/query-keys';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	getAnnouncements,
	createAnnouncement,
	updateAnnouncement,
	deleteAnnouncement,
	publishAnnouncement,
	unpublishAnnouncement,
} from '@/lib/api.generated';

// PL-18/PL-76：此前 type/targets/publishedAt 均为后端不存在的幻影字段
// （AnnouncementResponse 无 type/targets，状态枚举为 draft/scheduled/published/expired）。
// 定向语义由真实字段 targetRoles 推导：空 = 全员广播。
export interface AnnouncementRecord {
	id: string;
	title: string;
	status: 'draft' | 'scheduled' | 'published' | 'expired';
	content?: string;
	targetRoles?: string[];
	publishAt?: string;
	createdAt?: string;
}

export function useAnnouncements() {
	return useQuery({
		queryKey: queryKeys.announcements.all,
		staleTime: 300000,
		queryFn: async () => {
			const res = await getAnnouncements();
			return extractList<AnnouncementRecord>(res);
		},
	});
}

export function useCreateAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createAnnouncement,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),
	});
}

export function useUpdateAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
			updateAnnouncement(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),
	});
}

export function useDeleteAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteAnnouncement,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),
	});
}

export function usePublishAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: publishAnnouncement,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),
	});
}

export function useUnpublishAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: unpublishAnnouncement,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),
	});
}
