import { ErrorState } from '@autional/ui';
import { apiErrorCopy, classifyApiError, extractApiErrorMessage } from '@/lib/error-handler';

interface ApiErrorStateProps {
	error: unknown;
	title?: string;
	onRetry?: () => void;
	className?: string;
}

export function ApiErrorState({ error, title, onRetry, className }: ApiErrorStateProps) {
	const copy = apiErrorCopy(classifyApiError(error));
	return (
		<ErrorState
			title={copy?.title || title}
			description={copy?.description || extractApiErrorMessage(error, '请稍后重试。')}
			onRetry={onRetry}
			className={className}
		/>
	);
}
