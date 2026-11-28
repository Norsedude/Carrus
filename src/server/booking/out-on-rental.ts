// "Out on rental now" for the partner dashboard. A car is out when it has been
// picked up (active) and is not yet due back, or when a confirmed or
// ready-for-pickup reservation is inside its rental window. Active bookings
// stop counting at return time until the return step (F7) ends them.
export type RentalState = { state: string; pickup_at: string; return_at: string };

export function isOutOnRental(b: RentalState, now: number): boolean {
  const pickup = new Date(b.pickup_at).getTime();
  const ret = new Date(b.return_at).getTime();
  if (b.state === "active") return ret > now;
  if (b.state === "confirmed" || b.state === "ready_for_pickup") return pickup <= now && ret > now;
  return false;
}
