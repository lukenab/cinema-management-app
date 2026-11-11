import { SEED_CLUSTERS, clusterDto } from "@/server/cinema";
import { ok, route } from "@/server/http";

/** The CinePrime cinemas with their opening hours and rooms. */
export const GET = route(async () =>
  ok(SEED_CLUSTERS.map((c) => clusterDto(c))),
);
