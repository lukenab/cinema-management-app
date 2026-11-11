import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { getDb } from '@/server/db';
import { HttpError, ok, parseBody, route } from '@/server/http';
import type { UserDoc } from '@/server/models';
import { hashPassword } from '@/server/password';

const Body = z.object({
  username: z
    .string()
    .trim()
    .min(5, 'Tên đăng nhập tối thiểu 5 ký tự.')
    .max(30, 'Tên đăng nhập tối đa 30 ký tự.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Tên đăng nhập chỉ gồm chữ cái, chữ số và dấu gạch dưới.'),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ.'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự.').max(72, 'Mật khẩu tối đa 72 ký tự.'),
});

export const POST = route(async (request) => {
  const body = await parseBody(request, Body);
  const db = await getDb();
  const users = db.collection<UserDoc>('users');

  if (await users.findOne({ usernameLower: body.username.toLowerCase() })) {
    throw new HttpError(409, 'Tên đăng nhập đã được sử dụng.', 4091, { field: 'username' });
  }
  if (await users.findOne({ emailLower: body.email })) {
    throw new HttpError(409, 'Email đã được sử dụng.', 4092, { field: 'email' });
  }

  try {
    await users.insertOne({
      _id: new ObjectId(),
      username: body.username,
      usernameLower: body.username.toLowerCase(),
      email: body.email,
      emailLower: body.email,
      passwordHash: await hashPassword(body.password),
      role: 'MEMBER',
      status: 'ACTIVE',
      tokenVersion: 0,
      profile: {},
      createdAt: new Date(),
    });
  } catch (e) {
    // Two requests raced past the checks above; the unique indexes are the real guard.
    if ((e as { code?: number }).code === 11000) throw new HttpError(409, 'Tên đăng nhập hoặc email đã được sử dụng.', 4090);
    throw e;
  }
  return ok({}, 201);
});
