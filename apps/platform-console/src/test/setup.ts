import '@testing-library/jest-dom/vitest';
// jsdom 的缺口（matchMedia / ResizeObserver）不再各站各抄一份 —— 由设计系统统一提供。
// 实测：三个控制台各抄了一份、user 漏了 ResizeObserver，于是 user 接入 antd 的当天，
// 8 个既有用例一起红在「ResizeObserver is not defined」上。
import '@autional/ui/test-setup';
// 真实 i18n 初始化并钉死 zh-CN：断言全按中文文案写，而 jsdom 的 navigator.language 是
// en-US —— LanguageDetector 会把它选成界面语言，不钉死就按 en 资源渲染（dashboard
// 断言「租户总数」实测找不到元素）。走真实链路（非 mock）：{{}} 插值只有真 i18n 才生效，
// 未初始化时 react-i18next 的 notReady fallback 会原样吐出 defaultValue 不插值。
import i18n from '@/i18n';

if (!i18n.isInitialized) {
	await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
}
await i18n.changeLanguage('zh-CN');
