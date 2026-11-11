import { authenticate } from '@/server/auth';
import { ok, route } from '@/server/http';
import { accountDto } from '@/server/users';

/** The signed-in account. */
export const GET = route(async (request) => ok(accountDto((await authenticate(request)).user)));
