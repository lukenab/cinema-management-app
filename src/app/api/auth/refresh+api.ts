import { z } from "zod";

import { refreshToken } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";

const Body = z.object({ token: z.string().min(1) });

export const POST = route(async (request) => {
  const { token } = await parseBody(request, Body);
  return ok({ token: await refreshToken(token) });
});
