import Card from "../../ui/Card";
import { useI18n } from "../../i18n";

interface AdminStatsCardsProps {
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
}

export default function AdminStatsCards({
  total,
  available,
  occupied,
  cleaning,
}: AdminStatsCardsProps) {
  const { t } = useI18n();

  const cards = [
    {
      label: t("admin.totalRooms"),
      value: total,
      hint: null,
      icon: "🏨",
      accent: "text-gray-900 dark:text-white",
      bg: "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
    },
    {
      label: t("admin.available"),
      value: available,
      hint: t("admin.readyToSell"),
      icon: "✅",
      accent: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
    },
    {
      label: t("admin.occupied"),
      value: occupied,
      hint: t("admin.currentlyOccupied"),
      icon: "👤",
      accent: "text-blue-700 dark:text-blue-300",
      bg: "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    },
    {
      label: t("admin.cleaning"),
      value: cleaning,
      hint: t("admin.beingCleaned"),
      icon: "🧹",
      accent: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50/80 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} padding="sm" className={`border ${card.bg}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
              <p className={`text-2xl font-bold tabular-nums leading-none ${card.accent}`}>
                {card.value}
              </p>
              {card.hint && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 truncate">
                  {card.hint}
                </p>
              )}
            </div>
            <span className="text-xl shrink-0 opacity-90">{card.icon}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
