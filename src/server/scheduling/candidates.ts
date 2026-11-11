// Candidate factory (Java: AutoShowtimeCandidateFactory). For every day × cinema × movie × format × room,
// a slot starts every `timeSlotIntervalMinutes` from opening time while the show plus cleanup still ends
// before closing time. Movies without an open release plan, not released yet, or without a room for their
// formats are excluded for that day; slots that collide with showtimes already in the database are rejected.
import {
  addDays,
  capacityOf,
  fromVn,
  hoursOn,
  roomsOfCluster,
} from "../cinema";
import type { MovieDoc, ReleasePlanDoc } from "../models";
import { planCovers } from "../releasePlans";
import type {
  Candidate,
  Exclusion,
  Fixed,
  Rejection,
  SchedulingPolicy,
} from "./types";

export interface FactoryInput {
  startDate: string;
  days: number;
  clusterIds: number[];
  movies: MovieDoc[];
  plans: Map<string, ReleasePlanDoc>;
  fixed: Fixed[];
  policy: SchedulingPolicy;
  now: Date;
}

const FALLBACK_DURATION = 120;

export function buildCandidates(input: FactoryInput) {
  const { policy } = input;
  const candidates: Omit<Candidate, "score" | "breakdown">[] = [];
  const rejections: Rejection[] = [];
  const exclusions: Exclusion[] = [];
  const earliest = input.now.getTime() + policy.leadMinutes * 60_000;
  const cleanupMs = policy.cleanupMinutes * 60_000;

  const fixedByRoom = new Map<number, Fixed[]>();
  for (const f of input.fixed) {
    const list = fixedByRoom.get(f.roomId);
    if (list) list.push(f);
    else fixedByRoom.set(f.roomId, [f]);
  }
  const collides = (roomId: number, start: number, end: number) =>
    (fixedByRoom.get(roomId) ?? []).some(
      (f) => start < f.end + cleanupMs && f.start < end + cleanupMs,
    );

  let id = 0;
  for (let d = 0; d < input.days; d++) {
    const date = addDays(input.startDate, d);
    for (const clusterId of input.clusterIds) {
      const hours = hoursOn(clusterId, date);
      if (!hours) continue;
      const rooms = roomsOfCluster(clusterId);
      for (const movie of input.movies) {
        if (!planCovers(input.plans.get(`${movie._id}|${clusterId}`), date)) {
          exclusions.push({
            movieId: movie._id,
            clusterId,
            date,
            reason: "MOVIE_NOT_AVAILABLE",
          });
          continue;
        }
        if (movie.releaseDate && movie.releaseDate > date) {
          exclusions.push({
            movieId: movie._id,
            clusterId,
            date,
            reason: "NOT_RELEASED_YET",
          });
          continue;
        }
        const formats = movie.formats?.length ? movie.formats : ["2D"];
        const pairs = formats.flatMap((format) =>
          rooms
            .filter((r) => r.formats.includes(format))
            .map((room) => ({ format, room })),
        );
        if (!pairs.length) {
          exclusions.push({
            movieId: movie._id,
            clusterId,
            date,
            reason: "NO_ELIGIBLE_ROOM",
          });
          continue;
        }
        const duration = movie.durationMinutes || FALLBACK_DURATION;
        for (const { format, room } of pairs) {
          for (
            let m = hours.opens;
            m + duration + policy.cleanupMinutes <= hours.closes;
            m += policy.timeSlotIntervalMinutes
          ) {
            const start = fromVn(date, m).getTime();
            if (start < earliest) continue;
            const end = start + duration * 60_000;
            const c = {
              id: id++,
              movieId: movie._id,
              clusterId,
              roomId: room._id,
              date,
              startMinutes: m,
              start,
              end,
              format,
              capacity: capacityOf(room.layout),
            };
            if (collides(room._id, start, end)) {
              rejections.push({
                candidate: { ...c, score: 0, breakdown: emptyBreakdown },
                reason: "EXISTING_SHOWTIME_CONFLICT",
              });
              continue;
            }
            candidates.push(c);
          }
        }
      }
    }
  }
  return { candidates, rejections, exclusions };
}

const emptyBreakdown: Candidate["breakdown"] = {
  daypart: "",
  movie: 0,
  cluster: 0,
  time: 0,
  format: 0,
  roomFit: 0,
  expectedAttendance: 0,
};
