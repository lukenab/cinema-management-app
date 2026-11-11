import { ok, route } from '@/server/http';
import { publicOffers } from '@/server/promotions';

export const GET = route(async () => ok(publicOffers()));
