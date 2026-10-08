import { Card, Descriptions } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth, usePageTitle } from '@autional/shared';
import { AppPageHeader, LanguageSwitcher, ThemeToggle } from '@autional/ui';

// PL-71：此前整页只有 <h3>设置</h3>（常驻死链）。实装最小设置面：
// 账户信息（只读）+ 偏好（语言 / 主题）—— 改密/个人资料属 auth 侧自助流程，另立专项。
export default function SettingsPage() {
	const { t } = useTranslation();
	usePageTitle(t('settings.title', '设置'));
	const { user } = useAuth();

	return (
		<div>
			<AppPageHeader title={t('settings.title', '设置')} />

			<Card title={t('settings.account', '账户信息')} className="max-w-2xl">
				<Descriptions column={1} size="small">
					<Descriptions.Item label={t('settings.name', '名称')}>
						{user?.displayName || user?.username || '-'}
					</Descriptions.Item>
					<Descriptions.Item label={t('settings.email', '邮箱')}>{user?.email || '-'}</Descriptions.Item>
				</Descriptions>
			</Card>

			<Card title={t('settings.preferences', '偏好设置')} className="max-w-2xl mt-4">
				<div className="flex items-center justify-between py-2">
					<span>{t('settings.language', '界面语言')}</span>
					<LanguageSwitcher />
				</div>
				<div className="flex items-center justify-between border-t border-neutral-100 py-2">
					<span>{t('settings.theme', '外观主题')}</span>
					<ThemeToggle />
				</div>
			</Card>
		</div>
	);
}
