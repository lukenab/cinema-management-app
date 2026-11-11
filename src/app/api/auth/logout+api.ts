import { ok, route } from "@/server/http";

// Tokens are stateless; the app discards its copy. Revoking sessions server-side is done by bumping tokenVersion.
export const POST = route(async () => ok({}));
