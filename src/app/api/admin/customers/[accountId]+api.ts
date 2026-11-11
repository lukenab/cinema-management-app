import { z } from 'zod';

import { getCustomer, setCustomerStatus } from '@/server/accounts';
import { requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';

export const GET = route(async (request, { accountId }) => {
  await requireAdmin(request);
  return ok(await getCustomer(await getDb(), accountId));
});

const Body = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });

/** Activate or deactivate a customer account. */
export const PATCH = route(async (request, { accountId }) => {
  await requireAdmin(request);
  const { status } = await parseBody(request, Body);
  return ok(await setCustomerStatus(await getDb(), accountId, status));
});
