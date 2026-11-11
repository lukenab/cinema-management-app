// Selector (Java: AutoShowtimeCandidateSelector), two passes over the ranked candidates:
// 1. Round robin: each pass gives every (movie, cinema, day) at most one more show until it reaches its
//    minimum (max of policy coverage and the cinema's minDailyShows, capped by its maximum), so the
//    best-scoring movie cannot take every room before the others are seen.
// 2. The remaining candidates, best score first, get extra shows until the cinema's maxDailyShowsPerMovie.
// A candidate is only taken when it passes the hard rules: concurrent room share, start stagger of the same
// movie, and no overlap (plus cleanup) in the same room.
import { clusterOf } from '../cinema';
import type { Candidate, Fixed, Rejection, SchedulingPolicy } from './types';

type Placed = Pick<Fixed, 'movieId' | 'clusterId' | 'roomId' | 'date' | 'start' | 'end'>;

export function select(ranked: Candidate[], fixed: Fixed[], policy: SchedulingPolicy) {
  const selected: Candidate[] = [];
  const rejected: Rejection[] = [];
  const cleanupMs = policy.cleanupMinutes * 60_000;
  const staggerMs = policy.sameMovieStaggerMinutes * 60_000;

  const groupKey = (c: Placed) => `${c.movieId}|${c.clusterId}|${c.date}`;
  const clusterDay = (c: Placed) => `${c.clusterId}|${c.date}`;

  // Rooms that have at least one candidate in a cinema on a day: the base of maximum_room_share.
  const roomsByClusterDay = new Map<string, Set<number>>();
  for (const c of ranked) {
    const k = clusterDay(c);
    if (!roomsByClusterDay.has(k)) roomsByClusterDay.set(k, new Set());
    roomsByClusterDay.get(k)!.add(c.roomId);
  }

  // Existing showtimes count as already placed.
  const placedByRoom = new Map<number, Placed[]>();
  const placedByGroup = new Map<string, Placed[]>();
  const count = new Map<string, number>();
  const place = (p: Placed) => {
    pushTo(placedByRoom, p.roomId, p);
    const g = groupKey(p);
    pushTo(placedByGroup, g, p);
    count.set(g, (count.get(g) ?? 0) + 1);
  };
  fixed.forEach(place);

  const maxRoomsFor = (c: Candidate) => {
    const available = roomsByClusterDay.get(clusterDay(c))?.size ?? 0;
    return available ? Math.max(1, Math.floor(policy.maximumRoomShare * available)) : 0;
  };

  const attempt = (c: Candidate): boolean => {
    const sameMovie = placedByGroup.get(groupKey(c)) ?? [];
    const concurrentRooms = new Set(sameMovie.filter((p) => p.start < c.end && c.start < p.end).map((p) => p.roomId));
    if (!concurrentRooms.has(c.roomId) && concurrentRooms.size >= maxRoomsFor(c)) {
      rejected.push({ candidate: c, reason: 'MAXIMUM_ROOM_SHARE_REACHED' });
      return false;
    }
    if (staggerMs > 0 && sameMovie.some((p) => p.roomId !== c.roomId && Math.abs(p.start - c.start) < staggerMs)) {
      rejected.push({ candidate: c, reason: 'SAME_MOVIE_START_STAGGER_CONFLICT' });
      return false;
    }
    if ((placedByRoom.get(c.roomId) ?? []).some((p) => c.start < p.end + cleanupMs && p.start < c.end + cleanupMs)) {
      rejected.push({ candidate: c, reason: 'CLEANUP_BUFFER_CONFLICT' });
      return false;
    }
    selected.push(c);
    place(c);
    return true;
  };

  // Group candidates by (movie, cinema, day), keeping the ranking order inside each group.
  const groups = new Map<string, Candidate[]>();
  for (const c of ranked) {
    const demand = clusterOf(c.clusterId)?.demand;
    if (!demand) {
      rejected.push({ candidate: c, reason: 'MISSING_DEMAND_PROFILE' });
      continue;
    }
    const g = groupKey(c);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }
  const demandOf = (g: string) => clusterOf(Number(g.split('|')[1]))!.demand!;
  const minimumOf = (g: string) => {
    const d = demandOf(g);
    return Math.min(Math.max(policy.minimumCoverage, d.minDailyShows), d.maxDailyShowsPerMovie);
  };

  // Pass 1: round robin up to the minimum.
  const next = new Map<string, number>();
  let progress: boolean;
  do {
    progress = false;
    for (const [g, list] of groups) {
      if ((count.get(g) ?? 0) >= minimumOf(g)) continue;
      let i = next.get(g) ?? 0;
      while (i < list.length) {
        const c = list[i++];
        next.set(g, i);
        if (attempt(c)) {
          progress = true;
          break;
        }
      }
    }
  } while (progress);

  // Pass 2: whatever was not looked at yet, best score first, up to the daily maximum.
  const rest: Candidate[] = [];
  for (const [g, list] of groups) rest.push(...list.slice(next.get(g) ?? 0));
  rest.sort((a, b) => b.score - a.score || a.id - b.id);
  for (const c of rest) {
    const g = groupKey(c);
    if ((count.get(g) ?? 0) >= demandOf(g).maxDailyShowsPerMovie) {
      rejected.push({ candidate: c, reason: 'MAX_DAILY_SHOWS_PER_MOVIE_REACHED' });
      continue;
    }
    attempt(c);
  }

  return { selected, rejected };
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
