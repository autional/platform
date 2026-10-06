import { Button } from 'antd';
import { Result } from '@autional/ui';
import { useNavigate } from 'react-router';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { buildNavHref } from '@/lib/nav';

export default function ForbiddenPage() {
	usePageTitle('403 禁止访问');
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();

	return (
		<Result
			variant="warning"
			className="mx-auto max-w-md"
			title={<span className="text-4xl font-bold">403</span>}
			description="抱歉，你没有权限访问此页面。"
			action={
				<Button type="primary" onClick={() => navigate(buildNavHref('/', tenantSlug))}>
					返回仪表盘
				</Button>
			}
		/>
	);
}
