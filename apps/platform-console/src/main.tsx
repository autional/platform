import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider, ToastProvider } from '@autional/ui';
import { isRetryableError } from '@autional/shared';
import { AntdAppProvider } from './lib/antd-app';
import './i18n';
import App from './App';
import './non-tenant-segments';
import './app/globals.css';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// 重试策略唯一实现：只重试「重试可能改变结果」的错误（@autional/shared/utils/query-state
			// 的 isRetryableError：无状态码 / 5xx / 408 / 429）；4xx（含 404/401/403）一律不重试。
			retry: (failureCount, error) => isRetryableError(error) && failureCount < 1,
			refetchOnWindowFocus: false,
		},
	},
});

const root = document.getElementById('root');
if (root) {
	createRoot(root).render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<BrowserRouter basename="/">
					<ThemeProvider storageKey="platform-console-theme">
						<AntdAppProvider>
							<ToastProvider>
								<App />
							</ToastProvider>
						</AntdAppProvider>
					</ThemeProvider>
				</BrowserRouter>
			</QueryClientProvider>
		</StrictMode>,
	);
}
