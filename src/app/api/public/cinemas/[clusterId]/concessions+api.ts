import { catalog } from '@/server/concessions';
import { ok, route } from '@/server/http';

/** Food and drink menu (every cinema sells the same menu). */
export const GET = route(async () => ok(catalog()));
