import { z } from "zod";

import { quickBookingSuggestions } from "@/server/assistant";
import { authenticate } from "@/server/auth";
import { isIsoDate } from "@/server/cinema";
import { getDb } from "@/server/db";
import { ok, parseBody, route } from "@/server/http";

const Body = z.object({
  message: z
    .string()
    .trim()
    .min(2, "Hãy cho biết bạn muốn xem lúc nào, đi mấy người.")
    .max(300, "Tối đa 300 ký tự."),
  clusterId: z.number().int().min(1),
  date: z.string().refine(isIsoDate, "Ngày không hợp lệ.").optional(),
  partySize: z.number().int().min(1).max(8).optional(),
});

/** Up to three ready-to-book options (showtime, best seats, combo) for a free-text request. */
export const POST = route(async (request) => {
  const session = await authenticate(request);
  return ok(
    await quickBookingSuggestions(
      await getDb(),
      session.accountId,
      await parseBody(request, Body),
    ),
  );
});
