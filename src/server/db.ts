import { MongoClient, ObjectId, type Db } from 'mongodb';

import { optionalEnv, requireEnv } from './env';
import { hashPassword } from './password';
import { SEED_CLUSTERS, SEED_ROOMS } from './cinema';
import type { ClusterDoc, MovieDoc, PriceBookDoc, ReleasePlanDoc, RoomDoc, UserDoc } from './models';
import { seedPriceBook } from './pricing';
import { reserveIds } from './ids';

interface Cache {
  client?: Promise<MongoClient>;
  ready?: Promise<void>;
}
// Survives dev-server module reloads so we keep one connection pool.
const cache = (globalThis as unknown as { __cineprimeMongo?: Cache }).__cineprimeMongo ?? {};
(globalThis as unknown as { __cineprimeMongo?: Cache }).__cineprimeMongo = cache;

/** The five cinemas, their rooms and price books (only what is missing is written). */
async function seedCinemas(db: Db) {
  const clusters = db.collection<ClusterDoc>('clusters');
  for (const seed of SEED_CLUSTERS) {
    const current = await clusters.findOne({ _id: seed._id });
    // The first version stored a single branch without hours; it is replaced by the seeded cinema.
    if (!current) await clusters.insertOne({ ...seed, status: 'ACTIVE' });
    else if (!current.operatingHours) await clusters.updateOne({ _id: seed._id }, { $set: { ...seed } });
  }
  const rooms = db.collection<RoomDoc>('rooms');
  for (const room of SEED_ROOMS) await rooms.updateOne({ _id: room._id }, { $setOnInsert: room }, { upsert: true });
  const books = db.collection<PriceBookDoc>('price_books');
  for (const c of SEED_CLUSTERS) {
    const level = c.demand?.tier === 'HIGH' ? 2 : c.demand?.tier === 'MEDIUM' ? 1 : 0;
    const { _id, ...book } = seedPriceBook(c._id, level);
    await books.updateOne({ _id }, { $setOnInsert: book }, { upsert: true });
  }
}

/**
 * First-version movies were PUBLISHED for the single branch. They become APPROVED with an open release
 * plan at every cinema, so the catalogue and existing showtimes keep working.
 */
async function migrateV1Movies(db: Db) {
  const movies = db.collection<MovieDoc>('movies');
  const legacy = await movies.find({ status: 'PUBLISHED' as never }).toArray();
  if (!legacy.length) return;
  const now = new Date();
  const plans = db.collection<ReleasePlanDoc>('release_plans');
  for (const m of legacy) {
    for (const c of SEED_CLUSTERS) {
      if (await plans.findOne({ movieId: m._id, clusterId: c._id })) continue;
      const _id = await reserveIds(db, 'release_plans', 1);
      await plans.insertOne({ _id, movieId: m._id, clusterId: c._id, status: 'OPEN', showingStartDate: m.releaseDate ?? now.toISOString().slice(0, 10), createdAt: now, updatedAt: now });
    }
    await movies.updateOne({ _id: m._id }, { $set: { status: 'APPROVED', approvedAt: (m as { publishedAt?: Date }).publishedAt ?? now, formats: m.formats ?? ['2D'] }, $unset: { publishedAt: '' } });
  }
}

/** Indexes plus the data the app needs to work: cinemas, rooms, price books and the demo accounts. */
async function bootstrap(db: Db): Promise<void> {
  const users = db.collection<UserDoc>('users');
  await users.createIndex({ usernameLower: 1 }, { unique: true });
  await users.createIndex({ emailLower: 1 }, { unique: true });
  await db.collection<MovieDoc>('movies').createIndex({ tmdbId: 1 }, { unique: true, sparse: true });
  await db.collection('movies').createIndex({ status: 1, releaseDate: -1 });
  await db.collection('showtimes').createIndex({ movieId: 1, startAt: 1 });
  await db.collection('showtimes').createIndex({ roomId: 1, startAt: 1 }, { unique: true });
  // A seat can be locked by at most one booking per showtime: this index is the double-booking guard.
  await db.collection('seat_locks').createIndex({ showtimeId: 1, seatId: 1 }, { unique: true });
  await db.collection('seat_locks').createIndex({ bookingId: 1 });
  // Expired holds are also swept by Mongo (about once a minute); reads ignore them immediately.
  await db.collection('seat_locks').createIndex({ holdExpiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('payments').createIndex({ txnRef: 1 }, { unique: true });
  await db.collection('payments').createIndex({ bookingId: 1, createdAt: -1 });
  await db.collection('bookings').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('bookings').createIndex({ bookingCode: 1 }, { unique: true });
  await db
    .collection('bookings')
    .createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

  await db.collection('showtimes').createIndex({ clusterId: 1, startAt: 1 });
  await db.collection('showtimes').createIndex({ generationRunId: 1 });
  await db.collection('release_plans').createIndex({ movieId: 1, clusterId: 1 }, { unique: true });
  await db.collection('release_plans').createIndex({ clusterId: 1, status: 1 });
  await db.collection('generation_runs').createIndex({ createdAt: -1 });

  await seedCinemas(db);
  await migrateV1Movies(db);

  // Demo accounts, created once if missing (change the passwords through the env vars below).
  const ensureUser = async (name: string, email: string, password: string, role: 'ADMIN' | 'MEMBER', profile: UserDoc['profile']) => {
    if (await users.findOne({ usernameLower: name.toLowerCase() })) return;
    await users.insertOne({
      _id: new ObjectId(),
      username: name,
      usernameLower: name.toLowerCase(),
      email,
      emailLower: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      role,
      status: 'ACTIVE',
      tokenVersion: 0,
      profile,
      createdAt: new Date(),
    });
  };

  await ensureUser(optionalEnv('ADMIN_USERNAME', 'admin'), optionalEnv('ADMIN_EMAIL', 'admin@cineprime.local'), optionalEnv('ADMIN_PASSWORD', 'admin'), 'ADMIN', {
    fullName: 'Quản trị viên',
  });
  // A customer with a complete profile, so a demo can book a ticket straight away.
  await ensureUser(optionalEnv('DEMO_USERNAME', 'user'), optionalEnv('DEMO_EMAIL', 'user@cineprime.local'), optionalEnv('DEMO_PASSWORD', 'user'), 'MEMBER', {
    fullName: 'Khách Demo',
    phoneNumber: '0900000000',
    dateOfBirth: '2000-01-01',
    gender: 'Other',
  });
}

export async function getDb(): Promise<Db> {
  if (!cache.client) {
    const client = new MongoClient(requireEnv('MONGODB_URI'), { serverSelectionTimeoutMS: 8000, ignoreUndefined: true });
    cache.client = client.connect();
    cache.client.catch(() => {
      cache.client = undefined;
    });
  }
  const client = await cache.client;
  const db = client.db();
  if (!cache.ready) {
    cache.ready = bootstrap(db);
    cache.ready.catch(() => {
      cache.ready = undefined;
    });
  }
  await cache.ready;
  return db;
}
