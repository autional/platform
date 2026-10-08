// Robot 状态机视图层单源（U408）：与后端 internal/robot/domain 对齐 ——
// commissioning → active ⇄ degraded → decommissioned → deleted。
// 列表/详情两页面共址，防止各自漂移（曾被 UI 锁 active、后端零守卫；列表还用过后端不存在的 offline/maintenance/provisioning）。

export type RobotStatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_VARIANT: Record<string, RobotStatusVariant> = {
	commissioning: 'info',
	active: 'success',
	degraded: 'warning',
	decommissioned: 'neutral',
	deleted: 'danger',
};

const STATUS_LABELS: Record<string, string> = {
	commissioning: '待启用',
	active: '活跃',
	degraded: '降级运行',
	decommissioned: '已停用',
	deleted: '已删除',
};

export function statusVariant(s: string | undefined): RobotStatusVariant {
	return (s && STATUS_VARIANT[s]) || 'neutral';
}

export function statusLabel(s: string | undefined): string {
	if (!s) return '-';
	return STATUS_LABELS[s] || s;
}

// 「启用状态：」提示 —— 全状态覆盖 + 兜底（旧实现条件链全不匹配时整块挂空）。
export interface RobotOperationHint {
	text: string;
	type: 'success' | 'warning' | 'danger' | 'secondary';
}

const OPERATION_HINTS: Record<string, RobotOperationHint> = {
	commissioning: { text: '待启用 —— 可点击「启用」上线', type: 'success' },
	active: { text: '活跃 —— 可停用、可签发 Intent', type: 'warning' },
	degraded: { text: '降级运行 —— 可停用、可签发 Intent', type: 'warning' },
	decommissioned: { text: '已停用 —— 不可再启用', type: 'secondary' },
	deleted: { text: '已删除', type: 'danger' },
};

export function operationHint(s: string | undefined): RobotOperationHint {
	if (s && OPERATION_HINTS[s]) return OPERATION_HINTS[s];
	return { text: s ? `未知状态（${s}）` : '未知状态', type: 'secondary' };
}
