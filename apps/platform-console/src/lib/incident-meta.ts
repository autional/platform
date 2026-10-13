import type { StatusVariant } from '@autional/ui';
import i18n from '@/i18n';

// 事故严重级别 / 状态的呈现字典 —— incidents 页与仪表盘「最近事故」共用同一份，防两处漂移。
export const severityBadge: Record<string, StatusVariant> = {
	critical: 'danger',
	major: 'warning',
	minor: 'info',
	maintenance: 'info',
};

// 键映射 + 调用时求值（模块级无组件作用域）：映射表存 i18n 键名，取值时经 i18n.t 解析为展示文案。
// 未知键不落属性 → 调用方 `MAP[s] || s` 回退原始值，语义同旧版。
const SEVERITY_LABEL_KEYS: Record<string, string> = {
	critical: 'incidents.severity.critical',
	major: 'incidents.severity.major',
	minor: 'incidents.severity.minor',
	maintenance: 'incidents.severity.maintenance',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
	investigating: 'incidents.status.investigating',
	identified: 'incidents.status.identified',
	monitoring: 'incidents.status.monitoring',
	resolved: 'incidents.status.resolved',
	draft: 'incidents.status.draft',
};

// 访问器视图：labels[s] 每次取值都经 i18n.t（语言切换随渲染刷新），
// 保留原映射表的索引调用形态（incidents 页与仪表盘两处消费方零改动）。
function labelAccessors(keys: Record<string, string>): Record<string, string> {
	const labels: Record<string, string> = {};
	for (const [value, key] of Object.entries(keys)) {
		Object.defineProperty(labels, value, {
			enumerable: true,
			get: () => i18n.t(key),
		});
	}
	return labels;
}

export const severityLabels: Record<string, string> = labelAccessors(SEVERITY_LABEL_KEYS);

export const statusBadge: Record<string, StatusVariant> = {
	investigating: 'warning',
	identified: 'info',
	monitoring: 'info',
	resolved: 'success',
	draft: 'neutral',
};

export const statusLabels: Record<string, string> = labelAccessors(STATUS_LABEL_KEYS);
