import PageHeader from "../../ui/PageHeader";
import Card from "../../ui/Card";

export default function ReportsPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Analytics and reports"
      />

      {/* Placeholder Dashboard - Superset style - fullscreen */}
      <Card className="bg-gray-900 dark:bg-gray-950 min-h-[600px] w-full" padding="lg">
        <div className="text-center py-12 sm:py-20">
          <div className="inline-block mb-6">
            <svg
              className="w-20 h-20 sm:w-24 sm:h-24 text-gray-600 dark:text-gray-500"
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
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-300 dark:text-gray-400 mb-2">
            Reports Dashboard
          </h2>
          <p className="text-gray-500 dark:text-gray-500">
            Analytics and reports module
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-600 mt-2">
            In development
          </p>
        </div>
      </Card>
    </div>
  );
}
