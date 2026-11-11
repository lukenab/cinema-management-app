import { z } from 'zod';

import { signToken } from '@/server/auth';
import { getDb } from '@/server/db';
import { HttpError, ok, parseBody, route } from '@/server/http';
import type { UserDoc } from '@/server/models';
import { verifyPassword } from '@/server/password';

const Body = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export const POST = route(async (request) => {
  const { username, password } = await parseBody(request, Body);
  const db = await getDb();
  const key = username.toLowerCase();
  const user = await db.collection<UserDoc>('users').findOne({ $or: [{ usernameLower: key }, { emailLower: key }] });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Tên đăng nhập hoặc mật khẩu không đúng.', 1006);
  }
  if (user.status !== 'ACTIVE') throw new HttpError(403, 'Tài khoản đã bị vô hiệu hóa.', 1007);

  await db.collection<UserDoc>('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return ok({ token: await signToken(user) });
});
