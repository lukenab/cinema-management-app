import type { Db } from "mongodb";

/** Auto-increment integer ids (the app and its URLs use numeric ids for movies, showtimes, bookings, ...). */
export async function nextId(db: Db, sequence: string): Promise<number> {
  return reserveIds(db, sequence, 1);
}

/** Reserves `count` consecutive ids in one round trip and returns the first one. */
export async function reserveIds(
  db: Db,
  sequence: string,
  count: number,
): Promise<number> {
  const doc = await db
    .collection<{ _id: string; seq: number }>("counters")
    .findOneAndUpdate(
      { _id: sequence },
      { $inc: { seq: count } },
      { upsert: true, returnDocument: "after" },
    );
  return doc!.seq - count + 1;
}
