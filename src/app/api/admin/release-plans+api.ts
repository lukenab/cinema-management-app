import { z } from "zod";

import { requireAdmin } from "@/server/auth";
import { isIsoDate } from "@/server/cinema";
import { getDb } from "@/server/db";
import { intQuery, ok, parseBody, queryParam, route } from "@/server/http";
import { createPlans, listPlans, type PlanStatus } from "@/server/releasePlans";

const STATUSES = ["PLANNED", "OPEN", "SUSPENDED", "CLOSED"];

/** Release plans, filtered by `?clusterId=`, `?movieId=`, `?status=`. */
export const GET = route(async (request) => {
  await requireAdmin(request);
  const status = queryParam(request, "status");
  return ok(
    await listPlans(await getDb(), {
      clusterId: intQuery(request, "clusterId"),
      movieId: intQuery(request, "movieId"),
      status:
        status && STATUSES.includes(status)
          ? (status as PlanStatus)
          : undefined,
    }),
  );
});

const Body = z.object({
  movieId: z.number().int(),
  clusterIds: z.array(z.number().int()).min(1, "Chọn ít nhất một rạp."),
  showingStartDate: z.string().refine(isIsoDate, "Ngày bắt đầu không hợp lệ."),
  showingEndDate: z
    .string()
    .refine(isIsoDate, "Ngày kết thúc không hợp lệ.")
    .optional(),
  status: z.enum(["PLANNED", "OPEN"]).default("OPEN"),
  note: z.string().trim().max(300).optional(),
});

/** Opens (or plans) the right to show a movie at one or more cinemas. */
export const POST = route(async (request) => {
  await requireAdmin(request);
  return ok(
    await createPlans(await getDb(), await parseBody(request, Body)),
    201,
  );
});
