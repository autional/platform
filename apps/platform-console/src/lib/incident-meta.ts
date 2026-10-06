import type { StatusVariant } from '@autional/ui';

// 事故严重级别 / 状态的呈现字典 —— incidents 页与仪表盘「最近事故」共用同一份，防两处漂移。
export const severityBadge: Record<string, StatusVariant> = {
	critical: 'danger',
	major: 'warning',
	minor: 'info',
	maintenance: 'info',
};

export const severityLabels: Record<string, string> = {
	critical: '严重',
	major: '重大',
	minor: '轻微',
	maintenance: '维护',
};

export const statusBadge: Record<string, StatusVariant> = {
	investigating: 'warning',
	identified: 'info',
	monitoring: 'info',
	resolved: 'success',
	draft: 'neutral',
};

export const statusLabels: Record<string, string> = {
	investigating: '调查中',
	identified: '已定位',
	monitoring: '监控中',
	resolved: '已解决',
	draft: '草稿',
};
