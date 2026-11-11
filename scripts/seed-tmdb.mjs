// Demo data: imports the newest TMDB movies for Vietnam, approves them with an open release plan at every
// cinema, then runs the automatic scheduler (Legacy Greedy) for every cinema and opens the showtimes for
// sale. Calls the running dev server as the admin account; safe to re-run (existing showtimes are kept).
//
//   npx expo start            (in another terminal)
//   npm run seed:tmdb
//
// Env (read from .env.local): API_URL (default http://localhost:8081), ADMIN_USERNAME / ADMIN_PASSWORD
// (default admin / admin), NOW_COUNT and UPCOMING_COUNT (default 5 each), SHOWTIME_DAYS (default 7).

const API = (process.env.API_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
const username = process.env.ADMIN_USERNAME ?? 'admin';
const password = process.env.ADMIN_PASSWORD ?? 'admin';
const nowCount = Number(process.env.NOW_COUNT ?? 5);
const upcomingCount = Number(process.env.UPCOMING_COUNT ?? 5);
const days = Math.min(14, Math.max(1, Number(process.env.SHOWTIME_DAYS ?? 7)));

async function call(path, body, token, method = body === undefined ? 'GET' : 'POST') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(280_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
  return json.result;
}

const vnDate = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86_400_000));

try {
  const { token } = await call('/api/auth/login', { username, password });
  console.log(`Logged in as ${username}. Importing ${nowCount} now showing + ${upcomingCount} coming soon from TMDB...`);
  const result = await call('/api/admin/tmdb/seed', { nowCount, upcomingCount }, token);
  result.imported.forEach((m) => console.log(`  + ${m.bucket === 'NOW_SHOWING' ? 'Đang chiếu' : 'Sắp chiếu'}  ${m.releaseDate ?? '?'}  ${m.title}`));
  result.skipped.forEach((m) => console.log(`  ! skipped ${m.title}: ${m.reason}`));
  console.log(`Done: ${result.imported.length} imported, ${result.existing} already present, ${result.skipped.length} skipped.`);

  const cinemas = await call('/api/admin/cinemas', undefined, token);
  const movies = (await call('/api/admin/movies?status=APPROVED', undefined, token)).filter((m) => m.openPlans > 0);
  const run = await call(
    '/api/admin/scheduling-runs',
    { startDate: vnDate(), endDate: vnDate(days - 1), clusterIds: cinemas.map((c) => c.clusterId), movieIds: movies.map((m) => m.movieId), publish: true },
    token,
  );
  const s = run.summary;
  console.log(`Scheduling run #${run.runId} ${run.startDate} → ${run.endDate}: ${s.selected} showtimes from ${s.candidates} candidates (${s.rejected} rejected, ${s.excluded} excluded) in ${s.durationMs} ms.`);
  run.perCluster.forEach((c) => console.log(`  ${String(c.selected).padStart(4)}  ${c.name}`));
} catch (e) {
  console.error(`Seed failed: ${e.message}`);
  console.error(`Is the dev server running at ${API}? (npx expo start)`);
  process.exit(1);
}
