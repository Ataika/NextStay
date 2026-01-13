export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Аналитика и отчеты</p>
        </div>
      </div>

      {/* Placeholder Dashboard - Superset style */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-8 min-h-[600px]">
        <div className="text-center py-20">
          <div className="inline-block mb-6">
            <svg
              className="w-24 h-24 text-gray-600 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-300 dark:text-gray-400 mb-2">
            Reports Dashboard
          </h2>
          <p className="text-gray-500 dark:text-gray-500">
            Модуль аналитики и отчетов
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-600 mt-2">
            В разработке
          </p>
        </div>
      </div>
    </div>
  );
}
