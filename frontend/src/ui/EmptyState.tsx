interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({
  title = "No data",
  message = "There's nothing here yet.",
  icon,
  action,
}: EmptyStateProps) {
  const defaultIcon = (
    <svg
      className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );

  return (
    <div className="text-center py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="mb-4">{icon || defaultIcon}</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
