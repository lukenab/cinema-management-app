import { ObjectId, type Db } from 'mongodb';

import { HttpError } from './http';
import type { UserDoc } from './models';
import { accountDto } from './users';

const users = (db: Db) => db.collection<UserDoc>('users');
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Customer accounts, newest first. `page` starts at 1. */
export async function searchCustomers(db: Db, opts: { query?: string; status?: string; page: number; size: number }) {
  const filter: Record<string, unknown> = { role: 'MEMBER' };
  if (opts.status === 'ACTIVE' || opts.status === 'INACTIVE') filter.status = opts.status;
  if (opts.query) {
    const rx = new RegExp(escapeRegex(opts.query), 'i');
    filter.$or = [{ username: rx }, { email: rx }];
  }
  const [rows, total] = await Promise.all([
    users(db).find(filter).sort({ createdAt: -1 }).skip((opts.page - 1) * opts.size).limit(opts.size).toArray(),
    users(db).countDocuments(filter),
  ]);
  return {
    currentPage: opts.page,
    totalPages: Math.max(1, Math.ceil(total / opts.size)),
    pageSize: opts.size,
    totalElements: total,
    data: rows.map(accountDto),
  };
}

async function customer(db: Db, id: string): Promise<UserDoc> {
  const user = ObjectId.isValid(id) ? await users(db).findOne({ _id: new ObjectId(id) }) : null;
  if (!user || user.role !== 'MEMBER') throw new HttpError(404, 'Không tìm thấy tài khoản khách hàng.', 1404);
  return user;
}

export async function getCustomer(db: Db, id: string) {
  return accountDto(await customer(db, id));
}

/** Deactivating also signs the customer out everywhere (their token version moves on). */
export async function setCustomerStatus(db: Db, id: string, status: 'ACTIVE' | 'INACTIVE') {
  const user = await customer(db, id);
  const update = status === 'INACTIVE' ? { $set: { status }, $inc: { tokenVersion: 1 } } : { $set: { status } };
  await users(db).updateOne({ _id: user._id }, update);
  return accountDto({ ...user, status });
}

export async function revokeCustomerSessions(db: Db, id: string) {
  const user = await customer(db, id);
  await users(db).updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
}
