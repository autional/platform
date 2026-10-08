// Agent 状态机视图层单源（U410）：与后端 internal/agent/domain.AgentStatus 对齐 ——
// provisioning → active ⇄ rotating → revoked → deleted。
// 列表/详情两页面共址，防止各自漂移（曾被两页各持一份缺键映射：rotating/revoked/deleted 裸英文外露，
// 且表里含后端不存在的 disabled/suspended）。

export type AgentStatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_VARIANT: Record<string, AgentStatusVariant> = {
	provisioning: 'info',
	active: 'success',
	rotating: 'warning',
	revoked: 'danger',
	deleted: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
	provisioning: '配置中',
	active: '活跃',
	rotating: '凭证轮换中',
	revoked: '已吊销',
	deleted: '已删除',
};

export function statusVariant(s: string | undefined): AgentStatusVariant {
	return (s && STATUS_VARIANT[s]) || 'neutral';
}

export function statusLabel(s: string | undefined): string {
	if (!s) return '-';
	return STATUS_LABELS[s] || s;
}
