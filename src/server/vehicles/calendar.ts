import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";

// Availability calendar model: one entry per local day for whole months.
export type DayStatus = "available" | "booked" | "unavailable" | "past";
export type CalendarDay = { date: string; day: number; status: DayStatus };
export type CalendarMonth = { label: string; leadingBlanks: number; days: CalendarDay[] };
type Range = { start: Date; end: Date };

const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;

function nextDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

export function buildCalendar(input: { from: Date; months: number; timeZone: string; now: Date; windows: Range[]; busy: Range[] }): CalendarMonth[] {
  const startLocal = utcToZonedLocal(input.from, input.timeZone).slice(0, 7); // YYYY-MM
  const today = utcToZonedLocal(input.now, input.timeZone).slice(0, 10);
  const months: CalendarMonth[] = [];
  let [year, month] = startLocal.split("-").map(Number);
  for (let i = 0; i < input.months; i++) {
    const first = `${year}-${String(month).padStart(2, "0")}-01`;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days: CalendarDay[] = [];
    let date = first;
    for (let d = 1; d <= daysInMonth; d++) {
      const range = { start: zonedLocalToUtc(`${date}T00:00`, input.timeZone)!, end: zonedLocalToUtc(`${nextDate(date)}T00:00`, input.timeZone)! };
      let status: DayStatus = "unavailable";
      if (date < today) status = "past";
      else if (input.busy.some((b) => overlaps(b, range))) status = "booked";
      else if (input.windows.some((w) => overlaps(w, range))) status = "available";
      days.push({ date, day: d, status });
      date = nextDate(date);
    }
    months.push({
      label: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      leadingBlanks: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
      days,
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
