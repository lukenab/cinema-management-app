// Which approved movies can get showtimes for a date range and a set of cinemas. A movie needs an OPEN release
// plan at one of the chosen cinemas that overlaps the range (and the movie must already be released inside it).
// The scheduling form uses this to disable movies, and a run refuses movies that fail it.
import type { Db } from "mongodb";

import { clusterNameOf } from "../cinema";
import type { MovieDoc, ReleasePlanDoc } from "../models";
import { movieTitleOf } from "../showtimes";

export type EligibilityReason =
  | "NO_PLAN"
  | "PLAN_NOT_OPEN"
  | "PLAN_OUTSIDE_RANGE"
  | "NOT_RELEASED";

export interface ClusterWindow {
  clusterId: number;
  name: string;
  /** First and last day in the range on which this cinema may show the movie. */
  from: string;
  to: string;
}

export interface MovieEligibility {
  movieId: number;
  title: string;
  posterUrl?: string;
  durationMinutes?: number;
  releaseDate?: string;
  eligible: boolean;
  reason?: EligibilityReason;
  /** Why the movie cannot be scheduled (Vietnamese, shown to the admin). */
  message?: string;
  /** Chosen cinemas where the movie may be scheduled, with the days that apply. */
  clusters: ClusterWindow[];
  /** Cinemas outside the selection that do have an open plan for the movie. */
  otherClusters: { clusterId: number; name: string }[];
}

const dmy = (iso: string) => iso.split("-").reverse().join("/");
const max = (a: string, b: string) => (a > b ? a : b);
const min = (a: string, b: string) => (a < b ? a : b);

export async function movieEligibility(
  db: Db,
  range: { startDate: string; endDate: string; clusterIds: number[] },
  movieIds?: number[],
): Promise<MovieEligibility[]> {
  const movies = await db
    .collection<MovieDoc>("movies")
    .find({
      status: "APPROVED",
      ...(movieIds ? { _id: { $in: movieIds } } : {}),
    })
    .sort({ _id: -1 })
    .toArray();
  const plans = await db
    .collection<ReleasePlanDoc>("release_plans")
    .find({ movieId: { $in: movies.map((m) => m._id) } })
    .toArray();
  const plansOf = new Map<number, ReleasePlanDoc[]>();
  for (const p of plans) {
    const list = plansOf.get(p.movieId);
    if (list) list.push(p);
    else plansOf.set(p.movieId, [p]);
  }

  return movies.map((m): MovieEligibility => {
    const mine = plansOf.get(m._id) ?? [];
    const chosen = mine.filter((p) => range.clusterIds.includes(p.clusterId));
    const open = chosen.filter((p) => p.status === "OPEN");
    const otherClusters = mine
      .filter(
        (p) => p.status === "OPEN" && !range.clusterIds.includes(p.clusterId),
      )
      .map((p) => ({ clusterId: p.clusterId, name: clusterNameOf(p.clusterId) }));

    const clusters: ClusterWindow[] = [];
    let planOverlapsRange = false;
    for (const p of open) {
      const from = max(p.showingStartDate, range.startDate);
      const to = min(p.showingEndDate ?? range.endDate, range.endDate);
      if (from > to) continue;
      planOverlapsRange = true;
      // The scheduler skips the days before the movie's release date.
      const released = m.releaseDate ? max(from, m.releaseDate) : from;
      if (released <= to) {
        clusters.push({
          clusterId: p.clusterId,
          name: clusterNameOf(p.clusterId),
          from: released,
          to,
        });
      }
    }

    const base = {
      movieId: m._id,
      title: movieTitleOf(m),
      posterUrl: m.thumbnailUrl ?? m.posterUrl,
      durationMinutes: m.durationMinutes,
      releaseDate: m.releaseDate,
      clusters: clusters.sort((a, b) => a.clusterId - b.clusterId),
      otherClusters,
    };
    if (clusters.length) return { ...base, eligible: true };

    const elsewhere = otherClusters.length
      ? ` Phim đang khai thác tại: ${otherClusters.map((c) => c.name.replace("CinePrime ", "")).join(", ")}.`
      : "";
    if (!chosen.length) {
      return {
        ...base,
        eligible: false,
        reason: "NO_PLAN",
        message: `Chưa có kế hoạch phát hành tại các rạp đã chọn.${elsewhere}`,
      };
    }
    if (!open.length) {
      return {
        ...base,
        eligible: false,
        reason: "PLAN_NOT_OPEN",
        message: `Kế hoạch phát hành tại các rạp đã chọn chưa ở trạng thái Đang khai thác.${elsewhere}`,
      };
    }
    if (!planOverlapsRange) {
      const earliest = open
        .map((p) => p.showingStartDate)
        .sort()[0];
      return {
        ...base,
        eligible: false,
        reason: "PLAN_OUTSIDE_RANGE",
        message: `Kế hoạch phát hành không trùng khoảng ngày đã chọn (khai thác từ ${dmy(earliest)}).`,
      };
    }
    return {
      ...base,
      eligible: false,
      reason: "NOT_RELEASED",
      message: `Phim khởi chiếu ngày ${dmy(m.releaseDate ?? "")}, sau khoảng ngày đã chọn.`,
    };
  });
}
