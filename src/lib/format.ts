const vnd = new Intl.NumberFormat("vi-VN");

export const formatMoney = (
  amount?: number | null,
  currency = "VND",
): string => {
  if (amount === undefined || amount === null) return "—";
  return currency === "VND"
    ? `${vnd.format(Math.round(amount))} ₫`
    : `${amount.toFixed(2)} ${currency}`;
};

/** "19:30:00" -> "19:30" */
export const formatTime = (time?: string | null): string =>
  time ? time.slice(0, 5) : "";

const WEEKDAYS = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

export const toIsoDate = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/** Parse "YYYY-MM-DD" as a local date (avoids UTC off-by-one). */
export const parseIsoDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** "Thứ Ba, 10 tháng 11, 2026" */
export const formatLongDate = (iso?: string | null): string => {
  if (!iso) return "";
  const d = parseIsoDate(iso.slice(0, 10));
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
};

/** "10/11/2026" */
export const formatShortDate = (iso?: string | null): string => {
  if (!iso) return "";
  const d = parseIsoDate(iso.slice(0, 10));
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export interface DayChip {
  iso: string;
  label: string; // "Hôm nay" / "Thứ Tư"
  date: string; // "11 / 11"
}

export const nextDays = (count: number): DayChip[] => {
  const base = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    return {
      iso: toIsoDate(d),
      label: i === 0 ? "Hôm nay" : WEEKDAYS[d.getDay()],
      date: `${d.getDate()} / ${d.getMonth() + 1}`,
    };
  });
};

export const formatDuration = (minutes?: number): string => {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} giờ ${m} phút` : `${m} phút`;
};

export const formatCountdown = (totalSeconds: number): string => {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** True when a showtime on `dateIso` starting at `time` has already begun. */
export const hasStarted = (
  dateIso: string,
  time: string,
  now = new Date(),
): boolean => {
  const [h, m] = time.split(":").map(Number);
  const start = parseIsoDate(dateIso);
  start.setHours(h ?? 0, m ?? 0, 0, 0);
  return start.getTime() <= now.getTime();
};
