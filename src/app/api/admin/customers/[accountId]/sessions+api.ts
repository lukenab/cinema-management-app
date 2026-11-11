import { revokeCustomerSessions } from '@/server/accounts';
import { requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { ok, route } from '@/server/http';

/** Signs the customer out of every device. */
export const DELETE = route(async (request, { accountId }) => {
  await requireAdmin(request);
  await revokeCustomerSessions(await getDb(), accountId);
  return ok({});
});
