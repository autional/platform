import { Button } from 'antd';
import { Result } from '@autional/ui';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useLogout, usePageTitle, useTenantSlug } from '@autional/shared';
import { buildNavHref } from '@/lib/nav';
import { usePlatformMember } from '@/components/auth/usePlatformMember';

export default function ForbiddenPage() {
	const { t } = useTranslation();
	usePageTitle(t('forbidden.title', '403 禁止访问'));
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	const logout = useLogout();
	const membership = usePlatformMember();

	return (
		<Result
			variant="warning"
			className="mx-auto max-w-md"
			title={<span className="text-4xl font-bold">403</span>}
			description={t('forbidden.description', '抱歉，你没有权限访问此页面。')}
			action={[
				<Button type="primary" key="switch-account" onClick={logout}>
					{t('forbidden.switchAccount', '切换账号')}
				</Button>,
				// 非平台成员点「返回仪表盘」只会被同一守卫送回 403（回环）；
				// 只有已确认的平台成员（缺具体角色）才有可达的仪表盘。
				membership === 'member' ? (
					<Button key="back-dashboard" onClick={() => navigate(buildNavHref('/', tenantSlug))}>
						{t('forbidden.back', '返回仪表盘')}
					</Button>
				) : null,
			]}
		/>
	);
}
