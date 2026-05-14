import { useEffect, useState } from "react";
import {
  pricingConfigApi,
  trainingApi,
  type HotelPricingConfig,
  type TrainingHotelOption,
  type UpdateHotelPricingConfig,
} from "../../api/api";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import ErrorState from "../../ui/ErrorState";
import LoadingSpinner from "../../ui/LoadingSpinner";
import PageHeader from "../../ui/PageHeader";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {hint && (
          <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">({hint})</span>
        )}
      </label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
    />
  );
}

function SliderInput({
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-blue-500"
      />
      <span className="w-14 text-right text-sm font-medium text-gray-800 dark:text-gray-200">
        {display}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function PricingConfigPage() {
  const [hotels, setHotels] = useState<TrainingHotelOption[]>([]);
  const [hotelId, setHotelId] = useState<number | null>(null);

  const [config, setConfig] = useState<HotelPricingConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Form state — kept in sync with fetched config
  const [form, setForm] = useState<UpdateHotelPricingConfig>({
    minPrice: 30,
    maxPrice: 1000,
    maxDailyChangePct: 15,
    weekendMultiplier: 1.2,
    holidayMultiplier: 1.3,
    rolloutFraction: 1.0,
  });

  const loadHotels = async () => {
    try {
      const data = await trainingApi.listHotels();
      setHotels(data);
      if (data.length > 0 && hotelId === null) setHotelId(data[0].hotelId);
    } catch {
      // silent
    }
  };

  const loadConfig = async (hid: number) => {
    setLoading(true);
    setError(null);
    setSavedOk(false);
    try {
      const data = await pricingConfigApi.getConfig(hid);
      setConfig(data);
      setForm({
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        maxDailyChangePct: data.maxDailyChangePct,
        weekendMultiplier: data.weekendMultiplier,
        holidayMultiplier: data.holidayMultiplier,
        rolloutFraction: data.rolloutFraction,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  };

  const handleHotelChange = (id: number) => {
    setHotelId(id);
    void loadConfig(id);
  };

  const handleSave = async () => {
    if (hotelId === null) return;
    if (form.minPrice >= form.maxPrice) {
      alert("Minimum price must be less than maximum price.");
      return;
    }
    setSaving(true);
    setSavedOk(false);
    try {
      const updated = await pricingConfigApi.updateConfig(hotelId, form);
      setConfig(updated);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!config) return;
    setForm({
      minPrice: config.minPrice,
      maxPrice: config.maxPrice,
      maxDailyChangePct: config.maxDailyChangePct,
      weekendMultiplier: config.weekendMultiplier,
      holidayMultiplier: config.holidayMultiplier,
      rolloutFraction: config.rolloutFraction,
    });
  };

  useEffect(() => {
    void loadHotels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hotelId !== null) void loadConfig(hotelId);
  }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedHotel = hotels.find((h) => h.hotelId === hotelId);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Engine Tuning"
        subtitle="Configure per-hotel pricing rules and control model rollout."
      />

      {/* Hotel selector */}
      <Card padding="md">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr] md:items-end">
          <Field label="Hotel">
            <select
              value={hotelId ?? ""}
              onChange={(e) => handleHotelChange(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {hotels.length === 0 && <option value="">Loading…</option>}
              {hotels.map((h) => (
                <option key={h.hotelId} value={h.hotelId}>
                  {h.hotelId} · {h.hotelName} ({h.hotelSegment})
                </option>
              ))}
            </select>
          </Field>

          {config && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>
                Config version:{" "}
                <strong className="text-gray-800 dark:text-gray-200">{config.configVersion}</strong>
              </span>
              <span>
                Active model:{" "}
                <strong className="font-mono text-gray-800 dark:text-gray-200 text-xs">
                  {config.activeModelVersion ?? "global (no per-hotel model)"}
                </strong>
              </span>
              {config.isDefault && (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Using global defaults — not yet saved for this hotel
                </span>
              )}
              {config.updatedAt && (
                <span>Last saved: {new Date(config.updatedAt).toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner message="Loading hotel config…" />
      ) : error ? (
        <ErrorState title="Config unavailable" message={error} onRetry={() => hotelId !== null && void loadConfig(hotelId)} />
      ) : (
        <>
          {/* Price bounds */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Price Bounds for{" "}
              <span className="text-blue-600 dark:text-blue-400">
                {selectedHotel?.hotelName ?? `Hotel ${hotelId}`}
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Minimum price" hint="€ floor">
                <NumberInput
                  value={form.minPrice}
                  onChange={(v) => setForm((f) => ({ ...f, minPrice: v }))}
                  min={0}
                  step={5}
                />
              </Field>
              <Field label="Maximum price" hint="€ ceiling">
                <NumberInput
                  value={form.maxPrice}
                  onChange={(v) => setForm((f) => ({ ...f, maxPrice: v }))}
                  min={1}
                  step={10}
                />
              </Field>
              <Field label="Max daily change" hint="% per day">
                <NumberInput
                  value={form.maxDailyChangePct}
                  onChange={(v) => setForm((f) => ({ ...f, maxDailyChangePct: v }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </Field>
            </div>
          </Card>

          {/* Multipliers */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Demand Multipliers
            </h3>
            <div className="space-y-5">
              <Field
                label="Weekend multiplier"
                hint={`×${form.weekendMultiplier.toFixed(2)} on Friday / Saturday nights`}
              >
                <SliderInput
                  value={form.weekendMultiplier}
                  onChange={(v) => setForm((f) => ({ ...f, weekendMultiplier: v }))}
                  min={1.0}
                  max={3.0}
                  step={0.05}
                  format={(v) => `×${v.toFixed(2)}`}
                />
              </Field>
              <Field
                label="Holiday multiplier"
                hint={`×${form.holidayMultiplier.toFixed(2)} on flagged holiday dates`}
              >
                <SliderInput
                  value={form.holidayMultiplier}
                  onChange={(v) => setForm((f) => ({ ...f, holidayMultiplier: v }))}
                  min={1.0}
                  max={3.0}
                  step={0.05}
                  format={(v) => `×${v.toFixed(2)}`}
                />
              </Field>
            </div>
          </Card>

          {/* Rollout */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Dynamic Pricing Rollout
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Fraction of inventory slots that use the dynamic price. Set to 0 to disable, 1 to
              enable fully.
            </p>
            <Field label="Rollout fraction" hint={`${(form.rolloutFraction * 100).toFixed(0)}% of slots`}>
              <SliderInput
                value={form.rolloutFraction}
                onChange={(v) => setForm((f) => ({ ...f, rolloutFraction: v }))}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </Field>
          </Card>

          {/* Save / reset */}
          <div className="flex items-center gap-4">
            <Button onClick={() => void handleSave()} disabled={saving || hotelId === null}>
              {saving ? "Saving…" : "Save config"}
            </Button>
            <Button variant="secondary" onClick={handleReset} disabled={saving}>
              Reset
            </Button>
            {savedOk && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Config saved successfully.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
