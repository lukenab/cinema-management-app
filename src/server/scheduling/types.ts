import type { SkipReason } from "../models";

/** Tunables of a run (Java: showtime_allocation_policy). */
export interface SchedulingPolicy {
  /** Slots start every N minutes from opening time. */
  timeSlotIntervalMinutes: number;
  /** Room cleaning time between two shows in the same room. */
  cleanupMinutes: number;
  /** The same movie must not start in two rooms of a cinema within this many minutes. */
  sameMovieStaggerMinutes: number;
  /** Share of a cinema's rooms one movie may occupy at the same moment (floored, at least one room). */
  maximumRoomShare: number;
  /** Shows per movie, cinema and day guaranteed before extra shows are handed out by score. */
  minimumCoverage: number;
  /** A showtime today must start at least this long from now. */
  leadMinutes: number;
}

export const DEFAULT_POLICY: SchedulingPolicy = {
  timeSlotIntervalMinutes: 15,
  cleanupMinutes: 15,
  sameMovieStaggerMinutes: 20,
  maximumRoomShare: 0.6,
  minimumCoverage: 1,
  leadMinutes: 30,
};

/** Scoring weights (Java policy: movie / cluster / time slot / format / room capacity demand weights). */
export const WEIGHTS = {
  movie: 0.4,
  cluster: 0.25,
  time: 0.15,
  format: 0.1,
  roomFit: 0.1,
};

export interface Candidate {
  id: number;
  movieId: number;
  clusterId: number;
  roomId: number;
  date: string;
  /** Minutes after midnight on `date` (may pass 1440 for late shows). */
  startMinutes: number;
  start: number; // epoch ms
  end: number; // epoch ms
  format: string;
  capacity: number;
  score: number;
  breakdown: {
    daypart: string;
    movie: number;
    cluster: number;
    time: number;
    format: number;
    roomFit: number;
    expectedAttendance: number;
  };
}

export interface Rejection {
  candidate: Candidate;
  reason: SkipReason;
}

export interface Exclusion {
  movieId: number;
  clusterId: number;
  date: string;
  reason: SkipReason;
}

/** A showtime that already exists in the range; it blocks its room and counts towards quotas. */
export interface Fixed {
  movieId: number;
  clusterId: number;
  roomId: number;
  date: string;
  start: number;
  end: number;
}
