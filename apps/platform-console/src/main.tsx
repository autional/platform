import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider, ToastProvider } from '@autional/ui';
import { AntdAppProvider } from './lib/antd-app';
import './i18n';
import App from './App';
import './non-tenant-segments';
import './app/globals.css';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
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
