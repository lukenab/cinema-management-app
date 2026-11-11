// Cinemas, rooms, seat layouts and Vietnam-time helpers.
import type { ClusterDoc, RoomDoc, SeatType } from "./models";

// ── Seed data: five CinePrime cinemas in Cần Thơ ────────────────────────────
// Opening hours follow the usual public hours of cinemas in Cần Thơ: from about 8:00–9:00 until
// 23:00–24:00, later on Friday–Sunday. Addresses are district level only (fictional brand).

const hours = (weekday: [string, string], weekend: [string, string]) =>
  [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const [opensAt, closesAt] =
      dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6 ? weekend : weekday;
    return { dayOfWeek, opensAt, closesAt };
  });

export const SEED_CLUSTERS: Omit<ClusterDoc, "status">[] = [
  {
    _id: 1,
    clusterCode: "CP-NK",
    clusterName: "CinePrime Ninh Kiều",
    province: "Cần Thơ",
    address: "Quận Ninh Kiều, TP. Cần Thơ",
    operatingHours: hours(["08:30", "23:30"], ["08:00", "24:00"]),
    demand: {
      tier: "HIGH",
      score: 90,
      minDailyShows: 2,
      maxDailyShowsPerMovie: 8,
    },
  },
  {
    _id: 2,
    clusterCode: "CP-CR",
    clusterName: "CinePrime Cái Răng",
    province: "Cần Thơ",
    address: "Quận Cái Răng, TP. Cần Thơ",
    operatingHours: hours(["08:30", "23:30"], ["08:00", "24:00"]),
    demand: {
      tier: "MEDIUM",
      score: 70,
      minDailyShows: 2,
      maxDailyShowsPerMovie: 6,
    },
  },
  {
    _id: 3,
    clusterCode: "CP-BT",
    clusterName: "CinePrime Bình Thủy",
    province: "Cần Thơ",
    address: "Quận Bình Thủy, TP. Cần Thơ",
    operatingHours: hours(["09:00", "23:00"], ["08:30", "23:30"]),
    demand: {
      tier: "MEDIUM",
      score: 60,
      minDailyShows: 1,
      maxDailyShowsPerMovie: 5,
    },
  },
  {
    _id: 4,
    clusterCode: "CP-OM",
    clusterName: "CinePrime Ô Môn",
    province: "Cần Thơ",
    address: "Quận Ô Môn, TP. Cần Thơ",
    operatingHours: hours(["09:00", "23:00"], ["08:30", "23:30"]),
    demand: {
      tier: "LOW",
      score: 40,
      minDailyShows: 1,
      maxDailyShowsPerMovie: 4,
    },
  },
  {
    _id: 5,
    clusterCode: "CP-TN",
    clusterName: "CinePrime Thốt Nốt",
    province: "Cần Thơ",
    address: "Quận Thốt Nốt, TP. Cần Thơ",
    operatingHours: hours(["09:00", "22:30"], ["08:30", "23:00"]),
    demand: {
      tier: "LOW",
      score: 35,
      minDailyShows: 1,
      maxDailyShowsPerMovie: 3,
    },
  },
];

const room = (
  _id: number,
  clusterId: number,
  name: string,
  layout: RoomDoc["layout"],
  formats: string[],
): RoomDoc => ({
  _id,
  clusterId,
  name,
  layout,
  formats,
  status: "ACTIVE",
});

/** Rooms 1–3 keep the ids and layout of the first version so its showtimes and bookings stay valid. */
export const SEED_ROOMS: RoomDoc[] = [
  room(1, 1, "Phòng 1", "STANDARD", ["2D"]),
  room(2, 1, "Phòng 2", "STANDARD", ["2D"]),
  room(3, 1, "Phòng 3", "STANDARD", ["2D", "3D"]),
  room(4, 1, "Phòng 4", "LARGE", ["2D", "3D"]),
  room(5, 2, "Phòng 1", "LARGE", ["2D", "3D"]),
  room(6, 2, "Phòng 2", "STANDARD", ["2D"]),
  room(7, 2, "Phòng 3", "SMALL", ["2D"]),
  room(8, 3, "Phòng 1", "STANDARD", ["2D", "3D"]),
  room(9, 3, "Phòng 2", "STANDARD", ["2D"]),
  room(10, 3, "Phòng 3", "SMALL", ["2D"]),
  room(11, 4, "Phòng 1", "STANDARD", ["2D", "3D"]),
  room(12, 4, "Phòng 2", "SMALL", ["2D"]),
  room(13, 5, "Phòng 1", "STANDARD", ["2D"]),
  room(14, 5, "Phòng 2", "SMALL", ["2D"]),
];

// ── Seat layouts ────────────────────────────────────────────────────────────

export interface LayoutSeat {
  seatId: number;
  seatCode: string;
  seatGroupId?: string;
  row: string;
  rowIndex: number;
  number: number;
  type: SeatType;
}

const LAYOUT_SPECS: Record<
  RoomDoc["layout"],
  { rows: number; perRow: number; vipFrom: number; coupleFrom: number }
> = {
  SMALL: { rows: 6, perRow: 10, vipFrom: 4, coupleFrom: 5 },
  STANDARD: { rows: 8, perRow: 10, vipFrom: 4, coupleFrom: 6 },
  LARGE: { rows: 10, perRow: 12, vipFrom: 5, coupleFrom: 8 },
};

const ROW_LABELS = "ABCDEFGHIJKLMNOP";
const layoutCache = new Map<RoomDoc["layout"], LayoutSeat[]>();

/** Standard rows at the front, VIP in the middle, couple seats (sold in pairs) at the back. */
export function layoutOf(kind: RoomDoc["layout"] = "STANDARD"): LayoutSeat[] {
  const cached = layoutCache.get(kind);
  if (cached) return cached;
  const spec = LAYOUT_SPECS[kind];
  const seats = Array.from({ length: spec.rows }, (_, rowIndex) => {
    const row = ROW_LABELS[rowIndex];
    const type: SeatType =
      rowIndex >= spec.coupleFrom
        ? "COUPLE"
        : rowIndex >= spec.vipFrom
          ? "VIP"
          : "STANDARD";
    return Array.from({ length: spec.perRow }, (_, i) => {
      const number = i + 1;
      return {
        seatId: rowIndex * 100 + number,
        seatCode: `${row}${number}`,
        seatGroupId:
          type === "COUPLE" ? `${row}-${Math.ceil(number / 2)}` : undefined,
        row,
        rowIndex,
        number,
        type,
      };
    });
  }).flat();
  layoutCache.set(kind, seats);
  return seats;
}

export const capacityOf = (kind: RoomDoc["layout"] = "STANDARD") =>
  layoutOf(kind).length;

// ── Vietnam time (UTC+7, no daylight saving) ────────────────────────────────

const VN_OFFSET_MS = 7 * 3600_000;

/** Date + minutes after midnight in Vietnam -> instant. */
export function fromVn(dateIso: string, minutes: number): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes) - VN_OFFSET_MS);
}

export function vnParts(at: Date): {
  date: string;
  time: string;
  minutes: number;
  weekday: number;
} {
  const t = new Date(at.getTime() + VN_OFFSET_MS);
  const hh = t.getUTCHours();
  const mm = t.getUTCMinutes();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(hh)}:${pad(mm)}:00`,
    minutes: hh * 60 + mm,
    weekday: t.getUTCDay(),
  };
}

export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a Vietnam calendar date. */
export const weekdayOf = (dateIso: string): number =>
  vnParts(fromVn(dateIso, 720)).weekday;

export const isIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/** "08:30" -> 510; "24:00" -> 1440 */
export const hhmmToMinutes = (value: string): number => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
};

// ── Lookups (cinemas and rooms are configuration; the DB copy is for queries and admin listings) ──

const ROOM_BY_ID = new Map(SEED_ROOMS.map((r) => [r._id, r]));
const CLUSTER_BY_ID = new Map(SEED_CLUSTERS.map((c) => [c._id, c]));

export const roomOf = (roomId: number): RoomDoc | undefined =>
  ROOM_BY_ID.get(roomId);
export const clusterOf = (clusterId: number) => CLUSTER_BY_ID.get(clusterId);
export const clusterNameOf = (clusterId: number) =>
  CLUSTER_BY_ID.get(clusterId)?.clusterName ?? "CinePrime";
export const roomsOfCluster = (clusterId: number) =>
  SEED_ROOMS.filter((r) => r.clusterId === clusterId && r.status === "ACTIVE");

/** Seats of the room a showtime plays in. */
export const layoutOfRoom = (roomId: number) =>
  layoutOf(roomOf(roomId)?.layout ?? "STANDARD");

/** Opening hours of a cinema on a date, in minutes after midnight. */
export function hoursOn(
  clusterId: number,
  dateIso: string,
): { opens: number; closes: number } | null {
  const h = clusterOf(clusterId)?.operatingHours?.find(
    (o) => o.dayOfWeek === weekdayOf(dateIso),
  );
  return h
    ? { opens: hhmmToMinutes(h.opensAt), closes: hhmmToMinutes(h.closesAt) }
    : null;
}

export function clusterDto(
  c: Omit<ClusterDoc, "status"> & { status?: string },
) {
  const rooms = roomsOfCluster(c._id);
  return {
    clusterId: c._id,
    clusterCode: c.clusterCode,
    clusterName: c.clusterName,
    province: c.province,
    address: c.address,
    phoneNumber: c.phoneNumber,
    status: c.status ?? "ACTIVE",
    operatingHours: c.operatingHours,
    demand: c.demand,
    rooms: rooms.map((r) => ({
      roomId: r._id,
      name: r.name,
      formats: r.formats,
      layout: r.layout,
      capacity: capacityOf(r.layout),
    })),
  };
}
