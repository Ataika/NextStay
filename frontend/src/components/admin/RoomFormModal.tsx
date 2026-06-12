import { useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "../../mocks/rooms";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import { useI18n } from "../../i18n";
import { getAmenityIcon, inferRoomFloor } from "../../utils/roomDisplay";
import {
  BED_TYPE_OPTIONS,
  CUSTOM_CATEGORY_OPTION,
  DEFAULT_ROOM_CATEGORY,
  DESCRIPTION_MAX_LENGTH,
  MAX_ROOM_PHOTOS,
  PRESET_AMENITIES,
  ROOM_CATEGORIES,
  VIEW_TYPE_OPTIONS,
} from "../../constants/roomForm";
import toast from "react-hot-toast";

export type RoomFormValues = Omit<Room, "id">;

export const EMPTY_ROOM_FORM: RoomFormValues = {
  number: "",
  category: DEFAULT_ROOM_CATEGORY,
  status: "Available",
  price: null as unknown as number,
  capacity: null as unknown as number,
  description: "",
  amenities: [],
  photoUrl: null,
  areaSqm: null,
  bedType: null,
  viewType: null,
  floor: null,
};

const STATUS_DOT: Record<string, string> = {
  Available: "bg-emerald-500",
  Occupied: "bg-blue-500",
  Cleaning: "bg-amber-500",
  Maintenance: "bg-red-500",
};

interface RoomFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialValues: RoomFormValues;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: RoomFormValues) => void | Promise<void>;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

export default function RoomFormModal({
  isOpen,
  isEditing,
  initialValues,
  saving = false,
  onClose,
  onSubmit,
}: RoomFormModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<RoomFormValues>(initialValues);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState("");
  const [customAmenity, setCustomAmenity] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const isPresetCategory = (ROOM_CATEGORIES as readonly string[]).includes(initialValues.category);
    setForm({
      ...initialValues,
      category: isPresetCategory ? initialValues.category : DEFAULT_ROOM_CATEGORY,
    });
    setUseCustomCategory(Boolean(initialValues.category) && !isPresetCategory);
    setCustomCategory(isPresetCategory ? "" : initialValues.category);
    setPhotoUrls(initialValues.photoUrl ? [initialValues.photoUrl] : []);
    setPhotoInput("");
    setCustomAmenity("");
    setShowDetails(
      Boolean(initialValues.areaSqm || initialValues.bedType || initialValues.viewType || initialValues.floor)
    );
  }, [isOpen, initialValues]);

  const toggleAmenity = (amenity: string) => {
    setForm((prev) => {
      const has = prev.amenities?.includes(amenity);
      const next = has
        ? (prev.amenities ?? []).filter((a) => a !== amenity)
        : [...(prev.amenities ?? []), amenity];
      return { ...prev, amenities: next };
    });
  };

  const addCustomAmenity = () => {
    const label = customAmenity.trim();
    if (!label) return;
    if (!(form.amenities ?? []).includes(label)) {
      setForm((prev) => ({ ...prev, amenities: [...(prev.amenities ?? []), label] }));
    }
    setCustomAmenity("");
  };

  const addPhotoUrl = () => {
    const url = photoInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error(t("admin.photoUrlInvalid"));
      return;
    }
    if (photoUrls.length >= MAX_ROOM_PHOTOS) {
      toast.error(t("admin.photoLimit", { count: String(MAX_ROOM_PHOTOS) }));
      return;
    }
    setPhotoUrls((prev) => [...prev, url]);
    setPhotoInput("");
    if (photoUrls.length === 0) {
      setForm((prev) => ({ ...prev, photoUrl: url }));
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setForm((f) => ({ ...f, photoUrl: next[0] ?? null }));
      return next;
    });
  };

  const summaryStatusLabel =
    form.status === "Available"
      ? t("admin.available")
      : form.status === "Occupied"
        ? t("admin.occupied")
        : form.status === "Cleaning"
          ? t("admin.cleaning")
          : t("admin.maintenance");

  const inferredFloor = useMemo(() => {
    if (form.floor != null) return form.floor;
    if (!form.number.trim()) return null;
    return inferRoomFloor({ ...form, id: 0 } as Room);
  }, [form]);

  const resolvedCategory = useCustomCategory
    ? customCategory.trim()
    : form.category || DEFAULT_ROOM_CATEGORY;

  const handleSubmit = () => {
    void onSubmit({
      ...form,
      category: resolvedCategory,
      photoUrl: photoUrls[0] ?? null,
      floor: form.floor ?? inferredFloor,
      amenities: form.amenities ?? [],
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t("admin.editRoom", { number: form.number || "—" }) : t("admin.addNewRoom")}
      size="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {isEditing ? t("admin.saveChanges") : t("admin.createRoom")}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1 mb-4">
        {t("admin.roomFormSubtitle")}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {t("admin.basicInformation")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel required>{t("admin.roomNumber")}</FieldLabel>
                <input
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder={t("admin.roomNumberPlaceholder")}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel required>{t("admin.category")}</FieldLabel>
                <select
                  value={useCustomCategory ? CUSTOM_CATEGORY_OPTION : form.category}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM_CATEGORY_OPTION) {
                      setUseCustomCategory(true);
                      return;
                    }
                    setUseCustomCategory(false);
                    setCustomCategory("");
                    setForm({ ...form, category: e.target.value });
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {ROOM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value={CUSTOM_CATEGORY_OPTION}>{t("admin.customCategory")}</option>
                </select>
                {useCustomCategory && (
                  <input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder={t("admin.customCategoryPlaceholder")}
                    className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              </div>
              <div>
                <FieldLabel required>{t("admin.status")}</FieldLabel>
                <div className="relative">
                  <span
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${STATUS_DOT[form.status] ?? "bg-gray-400"}`}
                  />
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as Room["status"] })
                    }
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="Available">{t("admin.available")}</option>
                    <option value="Occupied">{t("admin.occupied")}</option>
                    <option value="Cleaning">{t("admin.cleaning")}</option>
                    <option value="Maintenance">{t("admin.maintenance")}</option>
                  </select>
                </div>
              </div>
              <div>
                <FieldLabel required>{t("admin.capacity")}</FieldLabel>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.capacity ?? ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setForm({
                      ...form,
                      capacity: value === "" ? (null as unknown as number) : Number(value),
                    });
                  }}
                  placeholder={t("admin.capacityPlaceholder")}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel required>{t("admin.pricePerNight")}</FieldLabel>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.price ?? ""}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, "");
                      setForm({
                        ...form,
                        price: value === "" ? (null as unknown as number) : Number(value),
                      });
                    }}
                    placeholder={t("admin.pricePlaceholder")}
                    className="w-full pr-8 pl-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {t("admin.roomPhotos")}
            </h3>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-5 text-center bg-gray-50/50 dark:bg-gray-900/30 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              onClick={() => fileInputRef.current?.focus()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                toast(t("admin.photoUrlHint"));
              }}
            >
              <p className="text-2xl mb-2">📷</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t("admin.uploadPhotos")}
              </p>
              <p className="text-xs text-gray-500 mt-1">{t("admin.photoDropHint")}</p>
              <div className="mt-3 flex gap-2 max-w-md mx-auto">
                <input
                  ref={fileInputRef}
                  type="url"
                  value={photoInput}
                  onChange={(e) => setPhotoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhotoUrl())}
                  placeholder="https://..."
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <Button type="button" size="sm" variant="secondary" onClick={addPhotoUrl}>
                  +
                </Button>
              </div>
              <input type="file" accept="image/*" className="hidden" />
            </div>
            {photoUrls.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {photoUrls.map((url, index) => (
                  <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photoUrls.length < MAX_ROOM_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.focus()}
                    className="w-16 h-16 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-xl"
                  >
                    +
                  </button>
                )}
              </div>
            )}
          </section>

          <section>
            <FieldLabel>{t("admin.description")}</FieldLabel>
            <textarea
              value={form.description ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value.slice(0, DESCRIPTION_MAX_LENGTH),
                })
              }
              rows={4}
              placeholder={t("admin.roomDescPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
            <p className="text-[11px] text-gray-400 text-right mt-1">
              {(form.description ?? "").length}/{DESCRIPTION_MAX_LENGTH}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {t("admin.amenities")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMENITIES.map((amenity) => {
                const selected = (form.amenities ?? []).includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400"
                    }`}
                  >
                    <span>{getAmenityIcon(amenity)}</span>
                    {amenity}
                  </button>
                );
              })}
              {(form.amenities ?? [])
                .filter((a) => !(PRESET_AMENITIES as readonly string[]).includes(a))
                .map((amenity) => (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-blue-600 text-white border-blue-600"
                  >
                    {amenity} ×
                  </button>
                ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                value={customAmenity}
                onChange={(e) => setCustomAmenity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomAmenity())}
                placeholder={t("admin.customAmenityPlaceholder")}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addCustomAmenity}>
                {t("admin.addCustomAmenity")}
              </Button>
            </div>
          </section>

          <section>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showDetails ? t("admin.hideRoomDetails") : t("admin.showRoomDetails")}
            </button>
            {showDetails && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <FieldLabel>{t("admin.areaSqm")}</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={form.areaSqm ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, areaSqm: e.target.value ? Number(e.target.value) : null })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <FieldLabel>{t("admin.floor")}</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.floor ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, floor: e.target.value ? Number(e.target.value) : null })
                    }
                    placeholder={inferredFloor != null ? String(inferredFloor) : "—"}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <FieldLabel>{t("admin.bedType")}</FieldLabel>
                  <select
                    value={form.bedType ?? ""}
                    onChange={(e) => setForm({ ...form, bedType: e.target.value || null })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="">—</option>
                    {BED_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>{t("admin.viewType")}</FieldLabel>
                  <select
                    value={form.viewType ?? ""}
                    onChange={(e) => setForm({ ...form, viewType: e.target.value || null })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="">—</option>
                    {VIEW_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 h-fit lg:sticky lg:top-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {t("admin.roomSummary")}
          </h3>
          <dl className="space-y-2.5 text-sm">
            {[
              { label: t("admin.category"), value: resolvedCategory || "—" },
              { label: t("admin.status"), value: summaryStatusLabel },
              {
                label: t("admin.capacity"),
                value: form.capacity ? t("admin.people", { count: String(form.capacity) }) : "—",
              },
              {
                label: t("admin.pricePerNight"),
                value: form.price != null ? `$${form.price}` : "—",
              },
              {
                label: t("admin.amenities"),
                value: String((form.amenities ?? []).length),
              },
              { label: t("admin.roomPhotos"), value: String(photoUrls.length) },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">{row.label}</dt>
                <dd className="font-medium text-gray-900 dark:text-white text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </Modal>
  );
}
