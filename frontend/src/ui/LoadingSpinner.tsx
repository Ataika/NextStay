interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  message = "Loading...",
  fullScreen = false
}: LoadingSpinnerProps) {
  const containerClass = fullScreen
    ? "min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"
    : "flex items-center justify-center py-12";

  return (
    <div className={containerClass}>
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-500 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}
