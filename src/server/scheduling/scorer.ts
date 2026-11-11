// Scorer (Java: AutoShowtimeCandidateScorer). Every candidate gets a 0..1 score from five weighted parts:
// movie demand, cinema demand, daypart demand, format priority and how well the room size fits the
// expected audience. Candidates are then ranked best first with a deterministic tie-break.
import { clusterOf, weekdayOf } from "../cinema";
import type { MovieDoc } from "../models";
import { WEIGHTS, type Candidate } from "./types";

/** Demand multipliers per daypart (Java: showtime_daypart_policy seed). Weekend = Saturday and Sunday. */
const DAYPARTS = [
  { code: "MORNING", from: 6 * 60, to: 12 * 60, weekday: 0.55, weekend: 0.75 },
  { code: "AFTERNOON", from: 12 * 60, to: 17 * 60, weekday: 0.7, weekend: 0.9 },
  { code: "EVENING", from: 17 * 60, to: 22 * 60, weekday: 1.0, weekend: 1.1 },
  {
    code: "LATE_NIGHT",
    from: 22 * 60,
    to: 30 * 60,
    weekday: 0.6,
    weekend: 0.75,
  },
];

/** Allocation priority per format (Java: showtime_allocation_format_priority). */
const FORMAT_PRIORITY: Record<string, number> = { "2D": 100, "3D": 80 };
const MAX_FORMAT_PRIORITY = Math.max(...Object.values(FORMAT_PRIORITY));

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

export const movieDemandOf = (
  m: Pick<MovieDoc, "priorityOverride" | "popularityScore">,
) => clamp((m.priorityOverride ?? m.popularityScore ?? 50) / 100, 0, 1);

export function scoreAndRank(
  raw: Omit<Candidate, "score" | "breakdown">[],
  movies: Map<number, MovieDoc>,
): Candidate[] {
  const maxCapacity = new Map<number, number>();
  for (const c of raw)
    maxCapacity.set(
      c.clusterId,
      Math.max(maxCapacity.get(c.clusterId) ?? 0, c.capacity),
    );
  const weekend = new Map<string, boolean>();

  const scored = raw.map((c): Candidate => {
    const movie = movieDemandOf(movies.get(c.movieId) ?? {});
    const cluster = clamp(
      (clusterOf(c.clusterId)?.demand?.score ?? 0) / 100,
      0,
      1,
    );
    if (!weekend.has(c.date)) {
      const day = weekdayOf(c.date);
      weekend.set(c.date, day === 0 || day === 6);
    }
    const startOfDay =
      c.startMinutes < 6 * 60 ? c.startMinutes + 24 * 60 : c.startMinutes;
    const part =
      DAYPARTS.find((p) => startOfDay >= p.from && startOfDay < p.to) ??
      DAYPARTS[3];
    const time = weekend.get(c.date) ? part.weekend : part.weekday;
    const format = (FORMAT_PRIORITY[c.format] ?? 50) / MAX_FORMAT_PRIORITY;

    const max = maxCapacity.get(c.clusterId) || c.capacity;
    const demand = clamp(
      (movie * 0.7 + cluster * 0.3) * time * (0.85 + format * 0.15),
      0.05,
      1,
    );
    const expectedAttendance = Math.round(demand * max);
    const overflow = Math.max(0, expectedAttendance - c.capacity);
    const empty = Math.max(0, c.capacity - expectedAttendance);
    const roomFit = clamp(1 - (overflow + 0.5 * empty) / max, 0, 1);

    const score =
      movie * WEIGHTS.movie +
      cluster * WEIGHTS.cluster +
      time * WEIGHTS.time +
      format * WEIGHTS.format +
      roomFit * WEIGHTS.roomFit;
    return {
      ...c,
      score: r4(score),
      breakdown: {
        daypart: part.code,
        movie: r4(movie),
        cluster: r4(cluster),
        time: r4(time),
        format: r4(format),
        roomFit: r4(roomFit),
        expectedAttendance,
      },
    };
  });

  return scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.clusterId - b.clusterId ||
      a.date.localeCompare(b.date) ||
      a.start - b.start ||
      a.roomId - b.roomId ||
      a.movieId - b.movieId ||
      a.format.localeCompare(b.format),
  );
}
