import type { ReactNode } from 'react';
import { PlatformGuard } from '@autional/shared';
import { usePlatformMember } from './usePlatformMember';

interface PlatformMemberGuardProps {
	children: ReactNode;
	/** 非平台成员 / 不可判时的落点（本站一律 ForbiddenRedirect → /<slug>/403） */
	fallback: ReactNode;
}

/**
 * 平台成员门（PL-77）：非平台成员不得渲染控制台页面 —— 判据、后端同谓词镜像与
 * tri-state 语义见 usePlatformMember 头注释。
 *
 * 'unknown'（未可判）不裁决（null 输出）：防合法成员冷启动被 fallback 导航走
 * （闪 403 且导航后无法自愈）。member 再叠 PlatformGuard 角色码门
 * （super_admin|admin，既有语义）。
 */
export function PlatformMemberGuard({ children, fallback }: PlatformMemberGuardProps) {
	const membership = usePlatformMember();

	if (membership === 'member') return <PlatformGuard fallback={fallback}>{children}</PlatformGuard>;
	if (membership === 'non-member') return <>{fallback}</>;
	return null;
}
