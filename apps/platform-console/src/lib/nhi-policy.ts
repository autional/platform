// NHI 策略读侧归一与保存前 diff（PL-33）。
// 契约：apiClient 响应拦截器已递归 camel 化，应用层读键一律 camel；
// 此处保留 snake 兜底，防止后端契约回退时再次断链（曾致 robot 上限显示初始值 50、真值 100 被静默覆盖）。

import i18n from '@/i18n';

export interface NhiPolicy {
	agentMaxCount?: number;
	agentDefaultTtl?: string;
	robotMaxCount?: number;
	deviceMaxPerOwner?: number;
	rotationDaysDefault?: number;
}

type RawPolicy = Record<string, unknown>;

function pick<T>(raw: RawPolicy, camel: string, snake: string): T | undefined {
	return (raw[camel] as T | undefined) ?? (raw[snake] as T | undefined);
}

export function normalizeNhiPolicy(raw: RawPolicy | null | undefined): NhiPolicy {
	if (!raw || typeof raw !== 'object') return {};
	const out: NhiPolicy = {};
	const agentMaxCount = pick<number>(raw, 'agentMaxCount', 'agent_max_count');
	if (agentMaxCount != null) out.agentMaxCount = agentMaxCount;
	const agentDefaultTtl = pick<string>(raw, 'agentDefaultTtl', 'agent_default_ttl');
	if (agentDefaultTtl != null) out.agentDefaultTtl = agentDefaultTtl;
	const robotMaxCount = pick<number>(raw, 'robotMaxCount', 'robot_max_count');
	if (robotMaxCount != null) out.robotMaxCount = robotMaxCount;
	const deviceMaxPerOwner = pick<number>(raw, 'deviceMaxPerOwner', 'device_max_per_owner');
	if (deviceMaxPerOwner != null) out.deviceMaxPerOwner = deviceMaxPerOwner;
	const rotationDaysDefault = pick<number>(raw, 'rotationDaysDefault', 'rotation_days_default');
	if (rotationDaysDefault != null) out.rotationDaysDefault = rotationDaysDefault;
	return out;
}

// 键映射 + 调用时求值（模块级无组件作用域）：diff 时用 i18n.t 解析为展示文案
export const NHI_POLICY_FIELDS: Array<{ key: keyof NhiPolicy; labelKey: string }> = [
	{ key: 'agentMaxCount', labelKey: 'policies.nhi.field.agentMaxCount' },
	{ key: 'agentDefaultTtl', labelKey: 'policies.nhi.field.agentDefaultTtl' },
	{ key: 'robotMaxCount', labelKey: 'policies.nhi.field.robotMaxCount' },
	{ key: 'deviceMaxPerOwner', labelKey: 'policies.nhi.field.deviceMaxPerOwner' },
	{ key: 'rotationDaysDefault', labelKey: 'policies.nhi.field.rotationDaysDefault' },
];

export interface NhiPolicyChange {
	field: keyof NhiPolicy;
	label: string;
	from: number | string | undefined;
	to: number | string | undefined;
}

export function diffNhiPolicy(current: NhiPolicy, next: NhiPolicy): NhiPolicyChange[] {
	const changes: NhiPolicyChange[] = [];
	for (const { key, labelKey } of NHI_POLICY_FIELDS) {
		const to = next[key];
		if (to === undefined) continue;
		const from = current[key];
		if (from !== to) changes.push({ field: key, label: i18n.t(labelKey), from, to });
	}
	return changes;
}
