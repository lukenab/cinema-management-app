import { getDb } from '@/server/db';
import { intQuery, ok, route } from '@/server/http';
import { listPublicMovies } from '@/server/movies';

/** Movies customers can see (`?clusterId=` limits it to one cinema's open release plans). */
export const GET = route(async (request) => ok(await listPublicMovies(await getDb(), intQuery(request, 'clusterId'))));
