import { holdPolicy } from '@/server/bookings';
import { ok, route } from '@/server/http';

/** How long chosen seats are held and how many may be booked at once. */
export const GET = route(async () => ok(holdPolicy()));
