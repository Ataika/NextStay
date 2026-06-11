import { useState } from "react";
import { pricingPipelineApi } from "../../api/api";
import http from "../../api/http";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import PageHeader from "../../ui/PageHeader";
import { useI18n } from "../../i18n";

interface RoomTypeRow {
  id: number;
  name: string;
  count: number;
  base_price: number;
  capacity: number;
}

interface SetupResult {
  rooms_deleted: number;
  rooms_created: number;
  room_types: string[];
}

const DEFAULT_ROWS: RoomTypeRow[] = [
  { id: 1, name: "Economy",  count: 20,  base_price: 55,  capacity: 1 },
  { id: 2, name: "Standard", count: 30,  base_price: 90,  capacity: 2 },
  { id: 3, name: "Deluxe",   count: 15,  base_price: 160, capacity: 3 },
];

let nextId = 10;

export default function InventorySetupPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<RoomTypeRow[]>(DEFAULT_ROWS);
  const [hotelName, setHotelName] = useState("NextStay Hotel");
  const [rowsPerType, setRowsPerType] = useState(1200);

  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const updateRow = (id: number, field: keyof RoomTypeRow, value: string | number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: nextId++, name: "New Type", count: 10, base_price: 100, capacity: 2 },
    ]);
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const buildPayload = () => ({
    hotel_id: 1,
    hotel_name: hotelName,
    room_types: rows.map((r) => ({
      name: r.name,
      count: Number(r.count),
      base_price: Number(r.base_price),
      capacity: Number(r.capacity),
    })),
    rows_per_type: rowsPerType,
  });

  const handleApply = async () => {
    try {
      setSetupLoading(true);
      setSetupError(null);
      setSetupResult(null);
      const res = await http.post<SetupResult>("/inventory/setup", buildPayload());
      setSetupResult(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Setup failed.";
      setSetupError(msg);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDownloadDataset = async () => {
    try {
      setDatasetLoading(true);
      setDatasetError(null);
      const res = await http.post("/inventory/generate-dataset", buildPayload(), {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `hotel_1_training_dataset.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setDatasetError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDatasetLoading(false);
    }
  };

  const handleRunSnapshot = async () => {
    try {
      setSnapshotLoading(true);
      setSnapshotError(null);
      setSnapshotResult(null);
      const result = await pricingPipelineApi.runSnapshot(30);
      setSnapshotResult(
        `${result.decisions_written} prices generated using "${result.model_used}" for the next ${result.days_ahead} days.`
      );
    } catch (err: unknown) {
      setSnapshotError(err instanceof Error ? err.message : "Snapshot failed.");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const totalRooms = rows.reduce((s, r) => s + Number(r.count), 0);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t("inventorySetup.title")}
        subtitle={t("inventorySetup.subtitle")}
      />

      {/* Hotel name */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t("inventorySetup.hotelLabel")}</h2>
        <input
          type="text"
          value={hotelName}
          onChange={(e) => setHotelName(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          placeholder={t("inventorySetup.hotelPlaceholder")}
        />
      </Card>

      {/* Room type table */}
      <Card padding="none">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("inventorySetup.roomTypesTitle", { count: String(totalRooms) })}
          </h2>
          <Button size="sm" variant="secondary" onClick={addRow}>{t("inventorySetup.addType")}</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                {[
                  t("inventorySetup.colRoomType"),
                  t("inventorySetup.colCount"),
                  t("inventorySetup.colBasePrice"),
                  t("inventorySetup.colCapacity"),
                  "",
                ].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(row.id, "name", e.target.value)}
                      className="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={row.count}
                      onChange={(e) => updateRow(row.id, "count", e.target.value)}
                      className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={10}
                      value={row.base_price}
                      onChange={(e) => updateRow(row.id, "base_price", e.target.value)}
                      className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={row.capacity}
                      onChange={(e) => updateRow(row.id, "capacity", e.target.value)}
                      className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        {t("inventorySetup.remove")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Actions */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t("inventorySetup.actionsTitle")}</h2>

        <div className="flex flex-wrap gap-3 items-start">
          {/* Step 1 */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t("inventorySetup.step1")}</span>
            <Button onClick={() => void handleApply()} disabled={setupLoading}>
              {setupLoading ? t("inventorySetup.applying") : t("inventorySetup.applyToSite")}
            </Button>
            <span className="text-xs text-gray-400">{t("inventorySetup.applyHint")}</span>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t("inventorySetup.step2")}</span>
            <div className="flex items-center gap-2">
              <select
                value={rowsPerType}
                onChange={(e) => setRowsPerType(Number(e.target.value))}
                className="rounded border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value={500}>500 rows / type</option>
                <option value={1200}>1200 rows / type</option>
                <option value={2000}>2000 rows / type</option>
              </select>
              <Button variant="secondary" onClick={() => void handleDownloadDataset()} disabled={datasetLoading}>
                {datasetLoading ? t("inventorySetup.generating") : t("inventorySetup.downloadDataset")}
              </Button>
            </div>
            <span className="text-xs text-gray-400">{t("inventorySetup.downloadHint")}</span>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t("inventorySetup.step3")}</span>
            <Button variant="secondary" onClick={() => void handleRunSnapshot()} disabled={snapshotLoading}>
              {snapshotLoading ? t("inventorySetup.running") : t("inventorySetup.runSnapshot")}
            </Button>
            <span className="text-xs text-gray-400">{t("inventorySetup.snapshotHint")}</span>
          </div>
        </div>
      </Card>

      {/* Results */}
      {setupResult && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900" padding="md">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {t("inventorySetup.roomsApplied", {
              created: String(setupResult.rooms_created),
              deleted: String(setupResult.rooms_deleted),
            })}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
            {t("inventorySetup.typesLabel", { types: setupResult.room_types.join(", ") })}
          </p>
        </Card>
      )}

      {setupError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/40" padding="md">
          <p className="text-sm text-red-800 dark:text-red-200">{setupError}</p>
        </Card>
      )}

      {datasetError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/40" padding="md">
          <p className="text-sm text-red-800 dark:text-red-200">{datasetError}</p>
        </Card>
      )}

      {snapshotResult && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900" padding="md">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{t("inventorySetup.snapshotComplete")}</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">{snapshotResult}</p>
        </Card>
      )}

      {snapshotError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/40" padding="md">
          <p className="text-sm text-red-800 dark:text-red-200">{snapshotError}</p>
        </Card>
      )}

      {/* Guide */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t("inventorySetup.howItWorksTitle")}</h2>
        <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
          <li>{t("inventorySetup.step1Guide")}</li>
          <li>{t("inventorySetup.step2Guide")}</li>
          <li>{t("inventorySetup.step3Guide")}</li>
          <li>{t("inventorySetup.step4Guide")}</li>
          <li>{t("inventorySetup.step5Guide")}</li>
          <li>{t("inventorySetup.step6Guide")}</li>
        </ol>
      </Card>
    </div>
  );
}
