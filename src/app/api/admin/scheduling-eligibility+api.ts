import { requireAdmin } from "@/server/auth";
import { isIsoDate } from "@/server/cinema";
import { getDb } from "@/server/db";
import { HttpError, ok, queryParam, route } from "@/server/http";
import { movieEligibility } from "@/server/scheduling/eligibility";

/**
 * Which approved movies can get showtimes for the chosen dates and cinemas, and why the others cannot
 * (`?startDate=&endDate=&clusterIds=1,2,3`).
 */
export const GET = route(async (request) => {
  await requireAdmin(request);
  const startDate = queryParam(request, "startDate") ?? "";
  const endDate = queryParam(request, "endDate") ?? "";
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) {
    throw new HttpError(400, "Khoảng ngày không hợp lệ.");
  }
  const clusterIds = (queryParam(request, "clusterIds") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!clusterIds.length) throw new HttpError(400, "Chọn ít nhất một rạp.");
  return ok(await movieEligibility(await getDb(), { startDate, endDate, clusterIds }));
});
