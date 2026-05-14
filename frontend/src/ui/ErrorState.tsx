import Button from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  fullScreen?: boolean;
}

export default function ErrorState({
  title = "Error",
  message = "Something went wrong. Please try again.",
  onRetry,
  retryLabel = "Try again",
  fullScreen = false,
}: ErrorStateProps) {
  const containerClass = fullScreen
    ? "min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4"
    : "flex items-center justify-center py-12 px-4";

  return (
    <div className={containerClass}>
      <div className="text-center max-w-md w-full">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
