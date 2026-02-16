import { useEffect, useMemo, useState } from "react";

import { reportsApi, type ReportsOverviewResponse } from "../../api/api";
import Card from "../../ui/Card";
import ErrorState from "../../ui/ErrorState";
import LoadingSpinner from "../../ui/LoadingSpinner";
import PageHeader from "../../ui/PageHeader";

export default function ReportsPage() {
  const supersetUrl = import.meta.env.VITE_SUPERSET_URL || "http://localhost:8088";
  const supersetEmbedPath = `${supersetUrl.replace(/\/$/, "")}/superset/welcome/`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string>("");
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<ReportsOverviewResponse | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reportsApi.getOverview(companyCode || undefined, days);
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load reports";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [companyCode, days]);

  const kpis = useMemo(
    () => [
      { label: "Revenue", value: data?.kpis.totalRevenue ?? 0, prefix: "$" },
      { label: "Bookings", value: data?.kpis.bookingsCount ?? 0, prefix: "" },
      { label: "Occupancy %", value: data?.kpis.avgOccupancyRate ?? 0, prefix: "" },
      { label: "ADR", value: data?.kpis.avgAdr ?? 0, prefix: "$" },
      { label: "RevPAR", value: data?.kpis.avgRevpar ?? 0, prefix: "$" },
    ],
    [data]
  );

  if (loading) {
    return <LoadingSpinner message="Loading reports..." />;
  }

  if (error) {
    return <ErrorState title="Reports Error" message={error} onRetry={() => void loadData()} />;
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Reports" subtitle="Analytics from mart layer" />

      <Card className="w-full" padding="md">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-gray-600 dark:text-gray-300">Company:</label>
          <select
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="">All</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
          <label className="text-sm text-gray-600 dark:text-gray-300">Window:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="w-full">
            <div className="text-xs uppercase tracking-wide text-gray-500">{kpi.label}</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">
              {kpi.prefix}
              {kpi.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="w-full" padding="lg">
          <h3 className="font-semibold mb-3">Revenue by Room Type</h3>
          <div className="space-y-2 max-h-72 overflow-auto">
            {(data?.roomTypeRevenue ?? []).map((item) => (
              <div key={`${item.company_code}-${item.room_type}`} className="flex justify-between text-sm">
                <span>{item.company_code} / {item.room_type}</span>
                <span>${item.total_revenue.toFixed(2)} ({item.bookings_count})</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="w-full" padding="lg">
          <h3 className="font-semibold mb-3">Loyalty Distribution</h3>
          <div className="space-y-2 max-h-72 overflow-auto">
            {(data?.loyalty ?? []).map((item) => (
              <div key={`${item.company_code}-${item.loyalty_tier}`} className="flex justify-between text-sm">
                <span>{item.company_code} / {item.loyalty_tier}</span>
                <span>{item.customers} customers</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="w-full" padding="lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Superset Dashboard</h3>
          <a
            href={supersetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            Open in new tab
          </a>
        </div>
        <iframe
          title="Superset Embedded"
          src={supersetEmbedPath}
          className="w-full min-h-[760px] rounded border border-gray-200 dark:border-gray-700"
        />
      </Card>
    </div>
  );
}
