// Robot 状态机视图层单源（U408）：与后端 internal/robot/domain 对齐 ——
// commissioning → active ⇄ degraded → decommissioned → deleted。
// 列表/详情两页面共址，防止各自漂移（曾被 UI 锁 active、后端零守卫；列表还用过后端不存在的 offline/maintenance/provisioning）。

import i18n from '@/i18n';

export type RobotStatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_VARIANT: Record<string, RobotStatusVariant> = {
	commissioning: 'info',
	active: 'success',
	degraded: 'warning',
	decommissioned: 'neutral',
	deleted: 'danger',
};

// 键映射 + 调用时求值（模块级无组件作用域）：未知状态回退原始值，语义同旧版 MAP[s] || s
const STATUS_LABEL_KEYS: Record<string, string> = {
	commissioning: 'robots.status.commissioning',
	active: 'robots.status.active',
	degraded: 'robots.status.degraded',
	decommissioned: 'robots.status.decommissioned',
	deleted: 'robots.status.deleted',
};

export function statusVariant(s: string | undefined): RobotStatusVariant {
	return (s && STATUS_VARIANT[s]) || 'neutral';
}

export function statusLabel(s: string | undefined): string {
	if (!s) return '-';
	const key = STATUS_LABEL_KEYS[s];
	return key ? i18n.t(key) : s;
}

// 「启用状态：」提示 —— 全状态覆盖 + 兜底（旧实现条件链全不匹配时整块挂空）。
export interface RobotOperationHint {
	text: string;
	type: 'success' | 'warning' | 'danger' | 'secondary';
}

const OPERATION_HINT_KEYS: Record<string, { key: string; type: RobotOperationHint['type'] }> = {
	commissioning: { key: 'robots.hint.commissioning', type: 'success' },
	active: { key: 'robots.hint.active', type: 'warning' },
	degraded: { key: 'robots.hint.degraded', type: 'warning' },
	decommissioned: { key: 'robots.hint.decommissioned', type: 'secondary' },
	deleted: { key: 'robots.hint.deleted', type: 'danger' },
};

export function operationHint(s: string | undefined): RobotOperationHint {
	const hint = s ? OPERATION_HINT_KEYS[s] : undefined;
	if (hint) return { text: i18n.t(hint.key), type: hint.type };
	return {
		text: s ? i18n.t('robots.unknownStatus', { s }) : i18n.t('robots.unknownStatusPlain'),
		type: 'secondary',
	};
}
