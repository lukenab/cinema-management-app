import type { UserDoc } from "./models";

export const accountDto = (u: UserDoc) => ({
  accountId: u._id.toHexString(),
  username: u.username,
  email: u.email,
  status: u.status,
  createdAt: u.createdAt.toISOString(),
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  roles: [{ roleName: u.role }],
});

export const profileDto = (u: UserDoc) => ({
  accountId: u._id.toHexString(),
  email: u.email,
  fullName: u.profile.fullName,
  phoneNumber: u.profile.phoneNumber,
  dateOfBirth: u.profile.dateOfBirth,
  gender: u.profile.gender,
  profileCompleted: !!(
    u.profile.fullName &&
    u.profile.phoneNumber &&
    u.profile.dateOfBirth &&
    u.profile.gender
  ),
});
