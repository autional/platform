/**
 * U412 源码扫描守卫（antd 弃用 API / 静态 message / forceRender 预挂载锁）。
 *
 * - Statistic `valueStyle`（antd 6 弃用 → `styles={{ content: ... }}`）
 * - Space `direction`（antd 6 弃用 → `orientation`）
 * - `message` 从 'antd' 静态导入（antd v6 静态方法不消费 App 上下文；须走 '@/lib/antd-app'）
 * - 弹窗位点的 `forceRender`（U412①：防「useForm 未挂载即调用」告警回归——移除 prop 即红）
 *
 * 说明：前三项为 dev-only console 弃用告警（生产包剥离），jsdom 行为探针无法稳定覆盖
 * 弃用面，故以源码扫描为定点锁；新增代码命中即红，翻红时按提示迁移至新 API。
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 由 vitest 以应用根目录为 cwd 运行（vitest.config.ts 在应用根）
const APP_DIR = join(process.cwd(), 'src', 'app');

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === '__tests__' || name === 'node_modules') continue;
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(tsx|ts)$/.test(name)) out.push(p);
	}
	return out;
}

const FILES = walk(APP_DIR);

interface Hit {
	file: string;
	line: number;
	text: string;
}

function scan(re: RegExp): Hit[] {
	const hits: Hit[] = [];
	for (const file of FILES) {
		const lines = readFileSync(file, 'utf8').split(/\r?\n/);
		lines.forEach((text, i) => {
			if (re.test(text)) hits.push({ file: file.replace(APP_DIR, 'src/app'), line: i + 1, text: text.trim() });
		});
	}
	return hits;
}

describe('antd 弃用 API / 静态 message 守卫（U412）', () => {
	it('无 Statistic `valueStyle`（弃用 → styles.content）', () => {
		expect(scan(/valueStyle=/)).toEqual([]);
	});

	it('无 `<Space direction=`（弃用 → orientation）', () => {
		expect(scan(/\sdirection=/)).toEqual([]);
	});

	it("无 `message` 从 'antd' 静态导入（须走 @/lib/antd-app）", () => {
		const hits: Hit[] = [];
		for (const file of FILES) {
			const text = readFileSync(file, 'utf8');
			const re = /import\s*\{([\s\S]*?)\}\s*from\s*'antd'/g;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text))) {
				if (/\bmessage\b/.test(m[1])) {
					const line = text.slice(0, m.index).split(/\r?\n/).length;
					hits.push({
						file: file.replace(APP_DIR, 'src/app'),
						line,
						text: m[0].replace(/\s+/g, ' ').slice(0, 120),
					});
				}
			}
		}
		expect(hits).toEqual([]);
	});
});

describe('U412① forceRender 预挂载锁（弹窗位点删除 prop 即红）', () => {
	// 位点清单 = 11 文件 13 弹窗（含 Form 实例且在首开前被调用）
	const SITES: Array<[string, number]> = [
		['status/incidents/page.tsx', 1],
		['status/maintenances/page.tsx', 1],
		['tenants/page.tsx', 1],
		['announcements/page.tsx', 1],
		['agents/page.tsx', 1],
		['agents/[id]/page.tsx', 1],
		['robots/page.tsx', 1],
		['robots/[id]/page.tsx', 2],
		['devices/page.tsx', 1],
		['devices/[id]/page.tsx', 1],
		['compliance/page.tsx', 2],
	];
	it.each(SITES)('%s 的 forceRender 独立属性行 ≥ %i', (rel, min) => {
		const text = readFileSync(join(APP_DIR, rel), 'utf8');
		const propLines = text.split(/\r?\n/).filter((l) => l.trim() === 'forceRender');
		expect(propLines.length).toBeGreaterThanOrEqual(min);
	});
});
