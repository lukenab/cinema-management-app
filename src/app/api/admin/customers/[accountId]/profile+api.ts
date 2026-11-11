import { getCustomerProfile } from "@/server/accounts";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { ok, route } from "@/server/http";

/** A customer's personal profile (read-only for admins). */
export const GET = route(async (request, { accountId }) => {
  await requireAdmin(request);
  return ok(await getCustomerProfile(await getDb(), accountId));
});
