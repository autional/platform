import { Button } from 'antd';
import { Result } from '@autional/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { usePageTitle, useTenantSlug } from '@autional/shared';
import { buildNavHref } from '@/lib/nav';

export default function NotFoundPage() {
	const { t } = useTranslation();
	usePageTitle(t('notFound.title', '页面不存在'));
	const navigate = useNavigate();
	const tenantSlug = useTenantSlug();
	return (
		<Result
			variant="info"
			className="mx-auto max-w-md"
			title={<span className="text-4xl font-bold">404</span>}
			description={t('notFound.description')}
			action={
				<Button type="primary" onClick={() => navigate(buildNavHref('/', tenantSlug))}>
					{t('notFound.back')}
				</Button>
			}
		/>
	);
}
