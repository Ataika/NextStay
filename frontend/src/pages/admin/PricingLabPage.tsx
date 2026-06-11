import { useEffect, useEffectEvent, useState } from "react";
import {
  pricingLabApi,
  pricingPipelineApi,
  type PricingLabDecisionResponse,
  type PricingLabHotelOption,
  type PricingLabPublishedRow,
  type SnapshotSummary,
} from "../../api/api";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import LoadingSpinner from "../../ui/LoadingSpinner";
import PageHeader from "../../ui/PageHeader";
import { useAuthStore, canManageEngine } from "../../store/authStore";
import { useI18n } from "../../i18n";

const DEFAULT_STAY_DATE = new Date().toISOString().slice(0, 10);
const IS_MOCK_MODE = String(import.meta.env.VITE_USE_MOCK_API).toLowerCase() !== "false";

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return String(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function DetailBlock({ title, data }: { title: string; data: Record<string, unknown> | null | undefined }) {
  const { t } = useI18n();
  return (
    <Card className="h-full" padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {!data || Object.keys(data).length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("pricingLab.noData")}</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[140px_1fr] gap-3 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{key}</span>
              <span className="text-gray-900 dark:text-gray-100 break-all">{formatNumber(value)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function PricingLabPage() {
  const { t } = useI18n();
  const role      = useAuthStore((s) => s.role);
  const canManage = canManageEngine(role);
  const [hotelId, setHotelId] = useState<number>(1);
  const [stayDate, setStayDate] = useState(DEFAULT_STAY_DATE);
  const [availableHotels, setAvailableHotels] = useState<PricingLabHotelOption[]>([]);
  const [rows, setRows] = useState<PricingLabPublishedRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<PricingLabPublishedRow | null>(null);
  const [decision, setDecision] = useState<PricingLabDecisionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotRunning, setSnapshotRunning] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<SnapshotSummary | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const loadPublished = async (nextHotelId = hotelId, nextStayDate = stayDate) => {
    try {
      setLoading(true);
      setError(null);
      const response = await pricingLabApi.getPublished(nextHotelId, nextStayDate, 100);
      setAvailableHotels(response.availableHotels);
      setRows(response.rows);

      if (!response.availableHotels.some((hotel) => hotel.hotelId === nextHotelId) && response.availableHotels[0]) {
        setHotelId(response.availableHotels[0].hotelId);
      }

      if (response.rows.length === 0) {
        setSelectedRow(null);
        setDecision(null);
        return;
      }

      const initialRow = response.rows[0];
      setSelectedRow(initialRow);
      try {
        await loadDecision(initialRow, false);
      } catch {
        setDecision(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load pricing lab data.";
      setError(message);
      setRows([]);
      setSelectedRow(null);
      setDecision(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDecision = async (row: PricingLabPublishedRow, showLoader = true) => {
    try {
      if (showLoader) setDetailsLoading(true);
      const response = await pricingLabApi.getDecision(row.hotelId, row.roomTypeId, row.stayDate, row.snapshotDate);
      setSelectedRow(row);
      setDecision(response);
    } catch (err) {
      setDecision(null);
      throw err;
    } finally {
      if (showLoader) setDetailsLoading(false);
    }
  };

  const runSnapshot = async () => {
    try {
      setSnapshotRunning(true);
      setSnapshotError(null);
      setSnapshotResult(null);
      const result = await pricingPipelineApi.runSnapshot(30);
      setSnapshotResult(result);
      await loadPublished(hotelId, stayDate);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Snapshot failed.");
    } finally {
      setSnapshotRunning(false);
    }
  };

  const loadInitialPublished = useEffectEvent(() => {
    void loadPublished();
  });

  useEffect(() => {
    loadInitialPublished();
  }, []);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t("pricingLab.title")}
        subtitle={t("pricingLab.subtitle")}
        action={
          <div className="flex gap-2">
            {canManage && (
              <Button
                variant="primary"
                onClick={() => void runSnapshot()}
                disabled={snapshotRunning}
              >
                {snapshotRunning ? t("pricingLab.running") : t("pricingLab.runSnapshot")}
              </Button>
            )}
            <Button variant="secondary" onClick={() => void loadPublished()}>
              {t("pricingLab.refresh")}
            </Button>
          </div>
        }
      />

      {snapshotResult && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900" padding="md">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
            {t("pricingLab.snapshotComplete", {
              count: String(snapshotResult.decisions_written),
              model: snapshotResult.model_used,
            })}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            {Object.entries(snapshotResult.rows_by_category).map(([cat, n]) => `${cat}: ${n}`).join(" · ")}
            {" · "}{snapshotResult.days_ahead} days ahead
          </p>
        </Card>
      )}

      {snapshotError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900" padding="md">
          <p className="text-sm text-red-800 dark:text-red-200">{snapshotError}</p>
        </Card>
      )}

      {IS_MOCK_MODE && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-900" padding="md">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            {t("pricingLab.mockModeNotice")}
          </p>
        </Card>
      )}

      <Card padding="md">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_220px_auto] md:items-end">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t("pricingLab.hotelLabel")}</span>
            <select
              value={hotelId}
              onChange={(event) => setHotelId(Number(event.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {availableHotels.length === 0 && <option value={hotelId}>Hotel {hotelId}</option>}
              {availableHotels.map((hotel) => (
                <option key={hotel.hotelId} value={hotel.hotelId}>
                  {hotel.hotelId} · {hotel.hotelName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t("pricingLab.stayDateLabel")}</span>
            <input
              type="date"
              value={stayDate}
              onChange={(event) => setStayDate(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>

          <div className="flex items-center gap-3">
            <Button onClick={() => void loadPublished(hotelId, stayDate)}>{t("pricingLab.loadPrices")}</Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("pricingLab.guestFacingUntouched")}</span>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner message={t("pricingLab.loading")} />
      ) : error ? (
        <ErrorState
          title={t("pricingLab.unavailableTitle")}
          message={error}
          onRetry={() => void loadPublished(hotelId, stayDate)}
        />
      ) : rows.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title={t("pricingLab.noPricesTitle")}
            message={t("pricingLab.noPricesMessage")}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card padding="md">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("pricingLab.publishedRows")}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{rows.length}</p>
            </Card>
            <Card padding="md">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("pricingLab.avgDynamicPrice")}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(
                  rows.reduce((sum, row) => sum + row.dynamicPrice, 0) / Math.max(rows.length, 1)
                )}
              </p>
            </Card>
            <Card padding="md">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("pricingLab.avgDelta")}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatPercent(
                  rows.reduce((sum, row) => sum + (row.priceDeltaPct ?? 0), 0) / Math.max(rows.length, 1)
                )}
              </p>
            </Card>
          </div>

          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t("pricingLab.colRoomType")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t("pricingLab.colBase")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t("pricingLab.colDynamic")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t("pricingLab.colDelta")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t("pricingLab.colInventory")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t("pricingLab.colModel")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t("pricingLab.colStatus")}</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">{t("pricingLab.colDetails")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {rows.map((row) => {
                    const isSelected =
                      selectedRow?.hotelId === row.hotelId &&
                      selectedRow?.roomTypeId === row.roomTypeId &&
                      selectedRow?.stayDate === row.stayDate &&
                      selectedRow?.snapshotDate === row.snapshotDate;

                    return (
                      <tr
                        key={`${row.hotelId}-${row.roomTypeId}-${row.stayDate}-${row.snapshotDate}`}
                        className={isSelected ? "bg-blue-50 dark:bg-blue-950/30" : ""}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{row.roomTypeName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Snapshot {row.snapshotDate}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(row.basePrice)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {formatCurrency(row.dynamicPrice)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              (row.priceDeltaPct ?? 0) >= 0
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
                            {formatPercent(row.priceDeltaPct)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {formatNumber(row.availableRooms)} / {formatNumber(row.totalInventory)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.modelVersion || "N/A"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            {row.inferenceStatus || "unknown"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant={isSelected ? "secondary" : "primary"} onClick={() => void loadDecision(row)}>
                            {t("pricingLab.inspect")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {detailsLoading ? (
            <LoadingSpinner message={t("pricingLab.loadingDetails")} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              <DetailBlock title={t("pricingLab.publishedRow")} data={decision?.published} />
              <DetailBlock title={t("pricingLab.decisionRow")} data={decision?.decision} />
              <DetailBlock title={t("pricingLab.inputContext")} data={decision?.context} />
            </div>
          )}

          <DetailBlock title={t("pricingLab.ruleMetadata")} data={decision?.ruleMetadata} />
        </>
      )}
    </div>
  );
}
