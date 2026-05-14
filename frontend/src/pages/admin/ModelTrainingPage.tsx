import { useEffect, useRef, useState } from "react";
import {
  trainingApi,
  type ModelRegistryEntry,
  type TrainingHotelOption,
  type TrainingJob,
} from "../../api/api";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import LoadingSpinner from "../../ui/LoadingSpinner";
import PageHeader from "../../ui/PageHeader";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function StatusBadge({ status }: { status: TrainingJob["status"] }) {
  const styles: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

function MetricBadge({ label, value }: { label: string; value: number | undefined }) {
  if (value === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
      <span className="font-medium text-gray-800 dark:text-gray-200">{label}</span>
      {value.toFixed(4)}
    </span>
  );
}

function formatDatetime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ------------------------------------------------------------------
// Section: Upload & Train
// ------------------------------------------------------------------

function UploadSection({
  hotels,
  hotelId,
  onHotelChange,
  onJobStarted,
}: {
  hotels: TrainingHotelOption[];
  hotelId: number | null;
  onHotelChange: (id: number) => void;
  onJobStarted: (job: TrainingJob) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [trainFraction, setTrainFraction] = useState(0.7);
  const [validFraction, setValidFraction] = useState(0.15);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!file || hotelId === null) return;
    setUploading(true);
    setUploadError(null);
    try {
      const job = await trainingApi.uploadAndTrain(hotelId, file, trainFraction, validFraction);
      onJobStarted(job);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Upload Dataset &amp; Train Model
      </h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Hotel selector */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Hotel
          </span>
          <select
            value={hotelId ?? ""}
            onChange={(e) => onHotelChange(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {hotels.length === 0 && <option value="">Loading…</option>}
            {hotels.map((h) => (
              <option key={h.hotelId} value={h.hotelId}>
                {h.hotelId} · {h.hotelName}
              </option>
            ))}
          </select>
        </label>

        {/* Train fraction */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Train fraction&nbsp;
            <span className="font-normal text-gray-500">({(trainFraction * 100).toFixed(0)}%)</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={0.85}
            step={0.05}
            value={trainFraction}
            onChange={(e) => setTrainFraction(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </label>

        {/* Validation fraction */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Validation fraction&nbsp;
            <span className="font-normal text-gray-500">({(validFraction * 100).toFixed(0)}%)</span>
          </span>
          <input
            type="range"
            min={0.05}
            max={0.25}
            step={0.05}
            value={validFraction}
            onChange={(e) => setValidFraction(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </label>

        {/* CSV file */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Training CSV
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/40 dark:file:text-blue-300"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Button
          onClick={() => void handleSubmit()}
          disabled={!file || hotelId === null || uploading}
        >
          {uploading ? "Uploading…" : "Upload & Train"}
        </Button>
        {file && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </span>
        )}
      </div>

      {uploadError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
      )}

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        The CSV must include all required feature columns defined in{" "}
        <code>feature_schema_v1.json</code>. Data is appended to{" "}
        <code>ml.pricingdata</code> and training starts immediately in the background.
      </p>
    </Card>
  );
}

// ------------------------------------------------------------------
// Section: Training Jobs
// ------------------------------------------------------------------

function JobsSection({
  jobs,
  loading,
  error,
  onRefresh,
}: {
  jobs: TrainingJob[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  if (loading) return <LoadingSpinner message="Loading training jobs…" />;
  if (error) return <ErrorState title="Could not load jobs" message={error} onRetry={onRefresh} />;

  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Training Jobs</h3>
        <Button size="sm" variant="secondary" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="p-6">
          <EmptyState title="No training jobs" message="Upload a dataset to start the first training run." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Job ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Hotel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Triggered</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Completed</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Rows</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Model version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">#{job.id}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{job.hotelId}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                    {job.status === "failed" && job.errorMessage && (
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400 max-w-xs truncate" title={job.errorMessage}>
                        {job.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDatetime(job.triggeredAt)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDatetime(job.completedAt)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{job.datasetRowCount ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {job.modelVersion ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------
// Section: Model Registry
// ------------------------------------------------------------------

function ModelsSection({
  models,
  loading,
  error,
  onRefresh,
  onPromote,
}: {
  models: ModelRegistryEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onPromote: (id: number) => void;
}) {
  if (loading) return <LoadingSpinner message="Loading model registry…" />;
  if (error)
    return <ErrorState title="Could not load models" message={error} onRetry={onRefresh} />;

  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Model Registry</h3>
        <Button size="sm" variant="secondary" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {models.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No models yet"
            message="Train a model to see it here. After training you can promote it to make it active."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Version</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Hotel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Rows</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Test metrics</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Trained</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Active</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {models.map((m) => {
                const testMetrics = m.metricsJson?.test as Record<string, number> | undefined;
                return (
                  <tr key={m.id} className={m.isActive ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate">
                      {m.modelVersion}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.hotelId}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.rowCount ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <MetricBadge label="AUC" value={testMetrics?.roc_auc} />
                        <MetricBadge label="LogLoss" value={testMetrics?.log_loss} />
                        <MetricBadge label="Brier" value={testMetrics?.brier_score} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDatetime(m.trainedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {m.isActive ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!m.isActive && (
                        <Button size="sm" onClick={() => onPromote(m.id)}>
                          Promote
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function ModelTrainingPage() {
  const [hotels, setHotels] = useState<TrainingHotelOption[]>([]);
  const [hotelId, setHotelId] = useState<number | null>(null);

  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [models, setModels] = useState<ModelRegistryEntry[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Track active job IDs for auto-polling
  const [pollingJobId, setPollingJobId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHotels = async () => {
    try {
      const data = await trainingApi.listHotels();
      setHotels(data);
      if (data.length > 0 && hotelId === null) {
        setHotelId(data[0].hotelId);
      }
    } catch {
      // Hotels list is best-effort; stay silent
    }
  };

  const loadJobs = async (hid = hotelId) => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const data = await trainingApi.listJobs(hid ?? undefined);
      setJobs(data);
      // Start polling if any job is still running/pending
      const activeJob = data.find((j) => j.status === "pending" || j.status === "running");
      if (activeJob) {
        setPollingJobId(activeJob.id);
      }
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : "Failed to load jobs.");
    } finally {
      setJobsLoading(false);
    }
  };

  const loadModels = async (hid = hotelId) => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await trainingApi.listModels(hid ?? undefined);
      setModels(data);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : "Failed to load models.");
    } finally {
      setModelsLoading(false);
    }
  };

  const handleHotelChange = (id: number) => {
    setHotelId(id);
    void loadJobs(id);
    void loadModels(id);
  };

  const handleJobStarted = (job: TrainingJob) => {
    setJobs((prev) => [job, ...prev]);
    setPollingJobId(job.id);
  };

  const handlePromote = async (modelId: number) => {
    try {
      await trainingApi.promoteModel(modelId);
      await loadModels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Promote failed.");
    }
  };

  // Auto-poll running job every 4 seconds
  useEffect(() => {
    if (pollingJobId === null) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const job = await trainingApi.getJob(pollingJobId);
        setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
        if (job.status === "completed" || job.status === "failed") {
          setPollingJobId(null);
          if (job.status === "completed") void loadModels();
        }
      } catch {
        setPollingJobId(null);
      }
    };

    pollRef.current = setInterval(() => void poll(), 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollingJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadHotels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hotelId !== null) {
      void loadJobs(hotelId);
      void loadModels(hotelId);
    }
  }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeJob = jobs.find((j) => j.status === "pending" || j.status === "running");

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Model Training"
        subtitle="Upload hotel-specific datasets and train per-hotel pricing models."
      />

      {activeJob && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-900" padding="md">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            Training job <strong>#{activeJob.id}</strong> is{" "}
            <strong>{activeJob.status}</strong> for hotel {activeJob.hotelId}. The table updates
            automatically every 4 seconds.
          </p>
        </Card>
      )}

      <UploadSection
        hotels={hotels}
        hotelId={hotelId}
        onHotelChange={handleHotelChange}
        onJobStarted={handleJobStarted}
      />

      <JobsSection
        jobs={jobs}
        loading={jobsLoading}
        error={jobsError}
        onRefresh={() => void loadJobs()}
      />

      <ModelsSection
        models={models}
        loading={modelsLoading}
        error={modelsError}
        onRefresh={() => void loadModels()}
        onPromote={(id) => void handlePromote(id)}
      />
    </div>
  );
}
