import { useTranslation } from 'react-i18next';
import { ErrorState } from '@autional/ui';
import { apiErrorCopy, classifyApiError, extractApiErrorMessage } from '@/lib/error-handler';

interface ApiErrorStateProps {
	error: unknown;
	title?: string;
	onRetry?: () => void;
	className?: string;
}

export function ApiErrorState({ error, title, onRetry, className }: ApiErrorStateProps) {
	const { t } = useTranslation();
	const copy = apiErrorCopy(classifyApiError(error));
	return (
		<ErrorState
			title={copy?.title || title}
			description={
				copy?.description ||
				extractApiErrorMessage(error, t('common.retryLater', '请稍后重试。'))
			}
			onRetry={onRetry}
			className={className}
		/>
	);
}
