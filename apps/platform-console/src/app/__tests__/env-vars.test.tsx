/**
 * Part B: Environment Variables Page Rendering Tests
 *
 * Test the EnvVars page renders correctly with mocked API data,
 * search filtering works, and loading/error states display properly.
 *
 * Run: pnpm test -- -t "EnvVarsPage"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EnvVarsPage from '../env-vars/page';

vi.mock('@autional/shared', () => ({
	apiClient: {
		get: vi.fn(),
	},
	usePageTitle: vi.fn(),
}));

function defaultQueryClient() {
	return new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
}

function createWrapper(client?: QueryClient) {
	const qc = client ?? defaultQueryClient();
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
	};
}

const mockVariables = [
	{ key: 'JWT_SECRET', value: 'super-secret-jwt-key-12345', source_file: '.env' },
	{ key: 'DATABASE_URL', value: 'postgres://localhost:5432/autional', source_file: '.env.local' },
	{ key: 'REDIS_URL', value: 'redis://localhost:6379', source_file: '.env' },
	{ key: 'SMTP_PASSWORD', value: 'mail-password-abcdef', source_file: '.env' },
	{ key: 'API_GATEWAY_PORT', value: '11080', source_file: 'docker-compose.yml' },
];

describe('EnvVarsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the page header', () => {
		render(<EnvVarsPage />, { wrapper: createWrapper() });

		expect(screen.getByText('环境变量')).toBeInTheDocument();
	});

	it('renders a search input when data is loaded', async () => {
		const qc = defaultQueryClient();
		qc.setQueryData(['platform', 'env-vars'], mockVariables);

		render(<EnvVarsPage />, { wrapper: createWrapper(qc) });

		await waitFor(() => {
			expect(screen.getByPlaceholderText('按键名搜索…')).toBeInTheDocument();
		});
	});

	it('renders table with mock data when useQuery returns data', async () => {
		const qc = defaultQueryClient();

		qc.setQueryData(['platform', 'env-vars'], mockVariables);

		render(<EnvVarsPage />, { wrapper: createWrapper(qc) });

		await waitFor(() => {
			expect(screen.getByText('JWT_SECRET')).toBeInTheDocument();
		});

		expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
		expect(screen.getByText('REDIS_URL')).toBeInTheDocument();
		expect(screen.getByText('SMTP_PASSWORD')).toBeInTheDocument();
		expect(screen.getByText('API_GATEWAY_PORT')).toBeInTheDocument();

		expect(screen.getAllByText('.env').length).toBeGreaterThanOrEqual(2);
		expect(screen.getByText('.env.local')).toBeInTheDocument();
		expect(screen.getByText('docker-compose.yml')).toBeInTheDocument();
	});

	it('shows masked values by default (bullet dots)', async () => {
		const qc = defaultQueryClient();

		qc.setQueryData(['platform', 'env-vars'], mockVariables);

		render(<EnvVarsPage />, { wrapper: createWrapper(qc) });

		await waitFor(() => {
			expect(screen.getByText('JWT_SECRET')).toBeInTheDocument();
		});

		const bulletCells = screen.getAllByText('••••••••••••');
		expect(bulletCells.length).toBeGreaterThanOrEqual(3);
	});

	it('reveals value on eye icon click and hides on second click', async () => {
		const qc = defaultQueryClient();
		qc.setQueryData(['platform', 'env-vars'], mockVariables);

		render(<EnvVarsPage />, { wrapper: createWrapper(qc) });

		await waitFor(() => {
			expect(screen.getByText('JWT_SECRET')).toBeInTheDocument();
		});

		const revealButtons = screen.getAllByTitle('显示值');
		expect(revealButtons.length).toBeGreaterThan(0);

		const firstReveal = revealButtons[0];
		await userEvent.click(firstReveal);

		await waitFor(() => {
			expect(screen.getByText('super-secret-jwt-key-12345')).toBeInTheDocument();
		});

		const hideButtons = screen.getAllByTitle('隐藏值');
		expect(hideButtons.length).toBeGreaterThan(0);

		await userEvent.click(hideButtons[0]);

		await waitFor(() => {
			expect(screen.queryByText('super-secret-jwt-key-12345')).not.toBeInTheDocument();
		});
	});

	it('filters the table by search text', async () => {
		const qc = defaultQueryClient();
		qc.setQueryData(['platform', 'env-vars'], mockVariables);

		render(<EnvVarsPage />, { wrapper: createWrapper(qc) });

		await waitFor(() => {
			expect(screen.getByText('JWT_SECRET')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('按键名搜索…');
		await userEvent.type(searchInput, 'DATABASE');

		await waitFor(() => {
			expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
			expect(screen.queryByText('JWT_SECRET')).not.toBeInTheDocument();
			expect(screen.queryByText('REDIS_URL')).not.toBeInTheDocument();
		});
	});

	it('shows empty state when no rows match search', async () => {
		const qc = defaultQueryClient();
		qc.setQueryData(['platform', 'env-vars'], mockVariables);

		render(<EnvVarsPage />, { wrapper: createWrapper(qc) });

		await waitFor(() => {
			expect(screen.getByText('JWT_SECRET')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('按键名搜索…');
		await userEvent.type(searchInput, 'NONEXISTENT');

		await waitFor(() => {
			expect(screen.getByText('无匹配的变量')).toBeInTheDocument();
		});
	});

	it('shows empty state when no env vars are loaded', async () => {
		const qc = defaultQueryClient();
		qc.setQueryData(['platform', 'env-vars'], []);

		render(<EnvVarsPage />, { wrapper: createWrapper(qc) });

		await waitFor(() => {
			expect(screen.getByText('暂无环境变量')).toBeInTheDocument();
		});
	});

	it('clears search filter to show all rows again', async () => {
		const qc = defaultQueryClient();
		qc.setQueryData(['platform', 'env-vars'], mockVariables);

		render(<EnvVarsPage />, { wrapper: createWrapper(qc) });

		await waitFor(() => {
			expect(screen.getByText('JWT_SECRET')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('按键名搜索…');
		await userEvent.type(searchInput, 'DATABASE');

		await waitFor(() => {
			expect(screen.queryByText('JWT_SECRET')).not.toBeInTheDocument();
		});

		const clearButton = document.querySelector('.ant-input-clear-icon') as HTMLElement;
		if (clearButton) {
			await userEvent.click(clearButton);

			await waitFor(() => {
				expect(screen.getByText('JWT_SECRET')).toBeInTheDocument();
				expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
			});
		}
	});
});
