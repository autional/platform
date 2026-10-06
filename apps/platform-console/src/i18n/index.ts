import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { registerUiI18n } from '@autional/ui/i18n';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: {
			'zh-CN': { translation: zhCN },
			en: { translation: enUS },
			// LanguageSwitcher 切 'en-US'；别名指向同一资源，避免切换“无效果”
			'en-US': { translation: enUS },
		},
		fallbackLng: 'zh-CN',
		keySeparator: false,
		interpolation: { escapeValue: false },
	});

registerUiI18n(i18n);

// 同步 <html lang> 与 dayjs 区 —— 换语言后必须更新 documentElement.lang：
// ① a11y：WCAG 3.1.1 要求页面声明的语言与正文一致；index.html 里硬编码的是 zh-CN，
//    切成英文后那个声明就是错的（读屏器会按中文念英文）。
// ② 设计系统的 ErrorBoundary 字典按这个属性选语言 —— 没有它，错误页永远只会是中文。
// dayjs 区：antd 的 ConfigProvider locale 只管控件内置文案，日期面板的表头
// （年/月）由 dayjs 全局 locale 渲染 —— 不注册就出现「2026年Oct」中英混排（PL-28）。
const syncLocale = (lng: string | undefined) => {
	if (typeof document !== 'undefined') {
		document.documentElement.lang = lng || 'zh-CN';
	}
	dayjs.locale((lng || '').toLowerCase().startsWith('zh') ? 'zh-cn' : 'en');
};
i18n.on('languageChanged', (lng: string) => syncLocale(lng));
// 初始化完成后立即同步一次（覆盖 index.html 硬编码的 lang 与 dayjs 默认 en 区）。
// 注意 initialized 事件的载荷是 init options 对象而非语言串，必须显式取 i18n.language。
if (i18n.isInitialized) {
	syncLocale(i18n.language);
} else {
	i18n.on('initialized', () => syncLocale(i18n.language));
}

export default i18n;
