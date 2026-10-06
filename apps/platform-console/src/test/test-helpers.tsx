import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@autional/ui';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
	route?: string;
	queryClient?: QueryClient;
}

export function renderWithProviders(
	ui: ReactElement,
	{ route = '/', queryClient, ...renderOptions }: CustomRenderOptions = {},
) {
	const qc =
		queryClient ??
		new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});

	function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={qc}>
				<MemoryRouter initialEntries={[route]}>
					<ThemeProvider storageKey="platform-console-test-theme">{children}</ThemeProvider>
				</MemoryRouter>
			</QueryClientProvider>
		);
	}

	return {
		...render(ui, { wrapper: Wrapper, ...renderOptions }),
		queryClient: qc,
	};
}

export { renderWithProviders as render };
