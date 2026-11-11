import { searchCustomers } from "@/server/accounts";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { ok, queryParam, route } from "@/server/http";

/** Customer accounts (page starts at 1). */
export const GET = route(async (request) => {
  await requireAdmin(request);
  return ok(
    await searchCustomers(await getDb(), {
      query: queryParam(request, "query")?.trim() || undefined,
      status: queryParam(request, "status"),
      page: Math.max(1, Number(queryParam(request, "page")) || 1),
      size: Math.min(
        50,
        Math.max(1, Number(queryParam(request, "size")) || 20),
      ),
    }),
  );
});
