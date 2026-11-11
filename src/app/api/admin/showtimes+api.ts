import { requireAdmin } from "@/server/auth";
import { isIsoDate } from "@/server/cinema";
import { getDb } from "@/server/db";
import { HttpError, intQuery, ok, queryParam, route } from "@/server/http";
import { vnToday } from "@/server/movies";
import { listShowtimesForAdmin } from "@/server/showtimes";

/** All showtimes of a day (default today) at a cinema (`?clusterId=`), whatever their status. */
export const GET = route(async (request) => {
  await requireAdmin(request);
  const date = queryParam(request, "date") ?? vnToday();
  if (!isIsoDate(date)) throw new HttpError(400, "Ngày không hợp lệ.");
  return ok(
    await listShowtimesForAdmin(
      await getDb(),
      date,
      intQuery(request, "clusterId"),
    ),
  );
});
