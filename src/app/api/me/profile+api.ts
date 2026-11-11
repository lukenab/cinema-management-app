import { z } from 'zod';

import { authenticate } from '@/server/auth';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';
import type { UserDoc } from '@/server/models';
import { profileDto } from '@/server/users';

const Body = z.object({
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(50, 'Họ tên tối đa 50 ký tự.'),
  phoneNumber: z.string().trim().regex(/^(0|\+84)[0-9]{9,10}$/, 'Số điện thoại không hợp lệ.'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh không hợp lệ.')
    .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v) < new Date(), 'Ngày sinh phải ở quá khứ.'),
  gender: z.enum(['Male', 'Female', 'Other'], { message: 'Giới tính không hợp lệ.' }),
});

export const GET = route(async (request) => ok(profileDto((await authenticate(request)).user)));

export const PUT = route(async (request) => {
  const { user } = await authenticate(request);
  const profile = await parseBody(request, Body);
  await (await getDb()).collection<UserDoc>('users').updateOne({ _id: user._id }, { $set: { profile } });
  return ok(profileDto({ ...user, profile }));
});
