import type { CalendarMonth, DayStatus } from "@/server/vehicles/calendar";

const STYLE: Record<DayStatus, string> = {
  available: "bg-accent-soft text-gray-900",
  booked: "bg-gray-200 text-gray-400 line-through",
  unavailable: "text-gray-300",
  past: "text-gray-300",
};
const LABEL: Record<DayStatus, string> = { available: "available", booked: "booked", unavailable: "not offered", past: "past" };

/** Month grids showing which days this car can be rented. */
export function AvailabilityCalendar({ months, selected }: { months: CalendarMonth[]; selected?: { from: string; to: string } }) {
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        {months.map((m) => (
          <div key={m.label}>
            <p className="mb-2 font-semibold text-gray-900">{m.label}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs" role="grid" aria-label={m.label}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} aria-hidden className="py-1 text-gray-400">{d}</span>
              ))}
              {Array.from({ length: m.leadingBlanks }, (_, i) => <span key={`b${i}`} aria-hidden />)}
              {m.days.map((d) => {
                const inTrip = selected && d.date >= selected.from && d.date <= selected.to;
                return (
                  <span
                    key={d.date}
                    role="gridcell"
                    aria-label={`${d.date}: ${LABEL[d.status]}${inTrip ? ", in your trip" : ""}`}
                    data-status={d.status}
                    className={`rounded-md py-1.5 tabular-nums ${STYLE[d.status]} ${inTrip ? "ring-2 ring-accent" : ""}`}
                  >
                    {d.day}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-accent-soft" /> Available</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-gray-200" /> Booked</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded border hairline" /> Not offered</span>
        {selected && <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-accent" /> Your trip</span>}
      </p>
    </div>
  );
}
