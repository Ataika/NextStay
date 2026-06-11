/** Format an ISO date string using the given BCP 47 locale. */
export function formatDate(
  iso: string | Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

/** Format a date as a short time (HH:mm) in the given locale. */
export function formatTime(iso: string | Date, locale: string): string {
  return formatDate(iso, locale, { hour: "2-digit", minute: "2-digit" });
}

/** Format a monetary amount using ISO 4217 currency and locale. */
export function formatCurrency(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Human-readable duration between two dates (e.g. "2 days 3 hours"). */
export function formatDuration(from: Date, to: Date): string {
  const totalSeconds = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

/** Relative label: today / yesterday / date. */
export function formatRelativeDay(iso: string | Date, locale: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(iso, locale, { month: "short", day: "numeric", year: "numeric" });
}
