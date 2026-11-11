// End-to-end API test of the running dev server (real MongoDB, TMDB and VNPay signing).
// It walks the whole v2 flow on one freshly imported TMDB movie and checks the scheduler's invariants.
//
//   npx expo start --port 8099            (another terminal)
//   API_URL=http://localhost:8099 node --env-file-if-exists=.env.local scripts/api-test.mjs
//
// Writes docs/test-results/api-test.json. It creates data (a movie, plans, showtimes, bookings, a test account).
import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const API = (process.env.API_URL ?? 'http://localhost:8099').replace(/\/+$/, '');
const results = [];
let group = '';
const ctx = {};

async function call(method, path, { body, token, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    redirect: 'manual',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text, result: json?.result };
}

async function test(id, name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ id, group, name, ok: true, ms: Date.now() - started, detail: detail ?? '' });
    console.log(`  ✓ ${id} ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    results.push({ id, group, name, ok: false, ms: Date.now() - started, detail: e.message });
    console.log(`  ✗ ${id} ${name} — ${e.message}`);
  }
}

const expect = (cond, message) => {
  if (!cond) throw new Error(message);
};
const expectStatus = (r, status) => expect(r.status === status, `HTTP ${r.status} (expected ${status}): ${r.json?.message ?? r.text.slice(0, 120)}`);
const vnDate = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86_400_000));
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const skip = (why) => {
  throw new Error(`SKIPPED: ${why}`);
};

// VNPay signature exactly as the server (and VNPay) computes it.
const encode = (v) => encodeURIComponent(v).replace(/%20/g, '+');
const sign = (params, secret) =>
  createHmac('sha512', secret)
    .update(Buffer.from(Object.keys(params).sort().map((k) => `${k}=${encode(params[k])}`).join('&'), 'utf-8'))
    .digest('hex');

// ── A. Public catalogue ────────────────────────────────────────────────────
group = 'A. Public';
console.log(group);
await test('A1', 'GET /api/public/cinemas returns 5 Cần Thơ cinemas with hours, rooms, demand', async () => {
  const r = await call('GET', '/api/public/cinemas');
  expectStatus(r, 200);
  expect(r.result.length === 5, `${r.result.length} cinemas`);
  for (const c of r.result) {
    expect(c.province === 'Cần Thơ', `${c.clusterName} province ${c.province}`);
    expect(c.operatingHours?.length === 7, `${c.clusterName} hours`);
    expect(c.rooms?.length >= 2, `${c.clusterName} rooms`);
    expect(c.demand?.maxDailyShowsPerMovie > 0, `${c.clusterName} demand`);
  }
  ctx.cinemas = r.result;
  return r.result.map((c) => `${c.clusterName} (${c.rooms.length} phòng)`).join(', ');
});
await test('A2', 'GET /api/public/movies?clusterId=1 lists movies with a display status', async () => {
  const r = await call('GET', '/api/public/movies?clusterId=1');
  expectStatus(r, 200);
  expect(Array.isArray(r.result), 'not an array');
  expect(r.result.every((m) => m.displayStatus === 'NOW_SHOWING' || m.displayStatus === 'COMING_SOON'), 'bad displayStatus');
  return `${r.result.length} phim (${r.result.filter((m) => m.displayStatus === 'NOW_SHOWING').length} đang chiếu)`;
});
await test('A3', 'Unknown movie id → 404 with Vietnamese message', async () => {
  const r = await call('GET', '/api/public/movies/99999999');
  expectStatus(r, 404);
  return r.json.message;
});
await test('A4', 'Booking policy, promotions and concessions are public', async () => {
  const [p, o, c] = await Promise.all([call('GET', '/api/public/booking-policy'), call('GET', '/api/public/promotions'), call('GET', '/api/public/cinemas/1/concessions')]);
  [p, o, c].forEach((r) => expectStatus(r, 200));
  expect(p.result.ttlSeconds === 480 && p.result.maxSeatsPerBooking === 8, 'policy');
  return `giữ ghế ${p.result.ttlSeconds}s, ${o.result.length} khuyến mãi, ${c.result.length} món`;
});
await test('A5', 'Old Java-style URLs are gone (e.g. /api/movies/public, /api/payments/fake-pay)', async () => {
  const [a, b] = await Promise.all([call('GET', '/api/movies/public'), call('GET', '/api/payments/fake-pay')]);
  expect(a.status === 404 && b.status === 404, `${a.status} / ${b.status}`);
  return '404 / 404';
});

// ── B. Auth & roles ────────────────────────────────────────────────────────
group = 'B. Auth & roles';
console.log(group);
await test('B1', 'Admin and demo customer can sign in', async () => {
  const a = await call('POST', '/api/auth/login', { body: { username: 'admin', password: process.env.ADMIN_PASSWORD ?? 'admin' } });
  const u = await call('POST', '/api/auth/login', { body: { username: 'user', password: process.env.DEMO_PASSWORD ?? 'user' } });
  expectStatus(a, 200);
  expectStatus(u, 200);
  ctx.admin = a.result.token;
  ctx.user = u.result.token;
  return 'admin, user';
});
await test('B2', 'Wrong password → 401', async () => {
  const r = await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'wrong-password' } });
  expectStatus(r, 401);
});
await test('B3', '/api/me without a token → 401', async () => {
  expectStatus(await call('GET', '/api/me'), 401);
});
await test('B4', 'Customer calling an admin route → 403', async () => {
  expectStatus(await call('GET', '/api/admin/movies', { token: ctx.user }), 403);
});
await test('B5', 'Register a second customer (for the seat-conflict test)', async () => {
  const name = `qa_${Date.now().toString(36)}`;
  expectStatus(await call('POST', '/api/auth/register', { body: { username: name, email: `${name}@example.com`, password: 'password123' } }), 201);
  const l = await call('POST', '/api/auth/login', { body: { username: name, password: 'password123' } });
  expectStatus(l, 200);
  ctx.user2 = l.result.token;
  return name;
});

// ── C. Movie lifecycle ─────────────────────────────────────────────────────
group = 'C. Movie lifecycle (TMDB → draft → approved)';
console.log(group);
await test('C1', 'TMDB now-playing list (admin) marks movies already imported', async () => {
  const pages = [];
  for (const page of [1, 2, 3]) pages.push(...(await call('GET', `/api/admin/tmdb/movies?list=now-playing&page=${page}`, { token: ctx.admin })).result);
  ctx.tmdbPick = pages.find((m) => !m.alreadyImported && m.posterUrl && m.overview);
  expect(ctx.tmdbPick, 'no un-imported TMDB movie with poster+overview in the first 3 pages');
  return `${pages.length} phim, chọn "${ctx.tmdbPick.title}" (#${ctx.tmdbPick.tmdbId})`;
});
await test('C2', 'TMDB preview auto-fills title, runtime, age rating, cast, popularity', async () => {
  const r = await call('GET', `/api/admin/tmdb/movies/${ctx.tmdbPick.tmdbId}`, { token: ctx.admin });
  expectStatus(r, 200);
  expect(r.result.title && r.result.cast.length && typeof r.result.popularityScore === 'number', 'missing fields');
  return `${r.result.durationMinutes ?? '?'} phút, ${r.result.ageRating?.ratingCode}, độ phổ biến ${r.result.popularityScore}`;
});
await test('C3', 'Import creates a DRAFT (not public)', async () => {
  const r = await call('POST', '/api/admin/tmdb/imports', { token: ctx.admin, body: { tmdbId: ctx.tmdbPick.tmdbId } });
  expectStatus(r, 201);
  expect(r.result.status === 'DRAFT', r.result.status);
  ctx.movie = r.result;
  const pub = await call('GET', `/api/public/movies/${r.result.movieId}`);
  expectStatus(pub, 404);
  return `movieId ${r.result.movieId}, thiếu: ${r.result.approvalProblems.join(' ') || 'không'}`;
});
await test('C4', 'Importing the same TMDB movie again → 409', async () => {
  expectStatus(await call('POST', '/api/admin/tmdb/imports', { token: ctx.admin, body: { tmdbId: ctx.tmdbPick.tmdbId } }), 409);
});
await test('C5', 'Invalid edit (runtime 10 min) → 400', async () => {
  expectStatus(await call('PATCH', `/api/admin/movies/${ctx.movie.movieId}`, { token: ctx.admin, body: { durationMinutes: 10 } }), 400);
});
await test('C6', 'Release plan for a DRAFT movie → 409', async () => {
  const r = await call('POST', '/api/admin/release-plans', { token: ctx.admin, body: { movieId: ctx.movie.movieId, clusterIds: [1], showingStartDate: vnDate() } });
  expectStatus(r, 409);
  return r.json.message;
});
await test('C7', 'Edit: release today, 2D+3D, priority 85 (runtime and age rating kept from TMDB)', async () => {
  const r = await call('PATCH', `/api/admin/movies/${ctx.movie.movieId}`, {
    token: ctx.admin,
    body: { releaseDate: vnDate(), durationMinutes: ctx.movie.durationMinutes ?? 115, formats: ['2D', '3D'], priorityOverride: 85, ageRatingCode: ctx.movie.ageRating?.ratingCode ?? 'T13' },
  });
  expectStatus(r, 200);
  expect(r.result.formats.includes('3D') && r.result.priorityOverride === 85, 'not saved');
  ctx.movie = r.result;
  return `${r.result.durationMinutes} phút, ${r.result.formats.join('/')}`;
});
await test('C8', 'Approve → APPROVED, still hidden without a release plan', async () => {
  const r = await call('POST', `/api/admin/movies/${ctx.movie.movieId}/approve`, { token: ctx.admin });
  expectStatus(r, 200);
  expect(r.result.status === 'APPROVED', r.result.status);
  expectStatus(await call('GET', `/api/public/movies/${ctx.movie.movieId}`), 404);
  return 'APPROVED, public 404';
});

// ── D. Release plans ───────────────────────────────────────────────────────
group = 'D. Release plans';
console.log(group);
await test('D1', 'Open plans at Ninh Kiều + Cái Răng', async () => {
  const r = await call('POST', '/api/admin/release-plans', { token: ctx.admin, body: { movieId: ctx.movie.movieId, clusterIds: [1, 2], showingStartDate: vnDate(), status: 'OPEN' } });
  expectStatus(r, 201);
  expect(r.result.created.length === 2, `${r.result.created.length} created`);
  ctx.plans = r.result.created;
  return r.result.created.map((p) => `#${p.planId} ${p.clusterName}`).join(', ');
});
await test('D2', 'Duplicate plan for the same cinema is skipped with a reason', async () => {
  const r = await call('POST', '/api/admin/release-plans', { token: ctx.admin, body: { movieId: ctx.movie.movieId, clusterIds: [1], showingStartDate: vnDate() } });
  expectStatus(r, 201);
  expect(r.result.created.length === 0 && r.result.skipped.length === 1, 'not skipped');
  return r.result.skipped[0].reason;
});
await test('D3', 'Movie shows as "Sắp chiếu" at Ninh Kiều (open plan, no showtimes) and not at Bình Thủy', async () => {
  const nk = (await call('GET', '/api/public/movies?clusterId=1')).result.find((m) => m.movieId === ctx.movie.movieId);
  const bt = (await call('GET', '/api/public/movies?clusterId=3')).result.find((m) => m.movieId === ctx.movie.movieId);
  expect(nk?.displayStatus === 'COMING_SOON', `Ninh Kiều: ${nk?.displayStatus}`);
  expect(!bt, 'listed at Bình Thủy');
  return 'NK: COMING_SOON, BT: ẩn';
});
await test('D4', 'Invalid transition (OPEN → PLANNED) → 409', async () => {
  expectStatus(await call('PATCH', `/api/admin/release-plans/${ctx.plans[0].planId}`, { token: ctx.admin, body: { status: 'PLANNED' } }), 409);
});

// ── E. Automatic scheduling (Legacy Greedy) ───────────────────────────────
group = 'E. Automatic scheduling';
console.log(group);
await test('E1', 'Run for the movie at Ninh Kiều, Cái Răng, Bình Thủy (tomorrow + 1 day), not published', async () => {
  const r = await call('POST', '/api/admin/scheduling-runs', {
    token: ctx.admin,
    body: { startDate: vnDate(1), endDate: vnDate(2), clusterIds: [1, 2, 3], movieIds: [ctx.movie.movieId], publish: false },
  });
  expectStatus(r, 201);
  ctx.run = r.result;
  const s = r.result.summary;
  expect(s.selected > 0, 'nothing selected');
  return `${s.selected} chọn / ${s.candidates} ứng viên, ${s.rejected} loại, ${s.excluded} không đủ điều kiện, ${s.durationMs} ms`;
});
await test('E2', 'Report adds up: candidates = selected + rejected; per-cinema and per-day sums match', async () => {
  const r = ctx.run;
  expect(r.summary.candidates === r.summary.selected + r.summary.rejected, 'candidates != selected + rejected');
  const rej = Object.values(r.rejectedByReason).reduce((a, b) => a + b, 0);
  expect(rej === r.summary.rejected, `reasons ${rej} vs ${r.summary.rejected}`);
  expect(r.perCluster.reduce((a, c) => a + c.selected, 0) === r.summary.selected, 'perCluster');
  expect(r.perDay.reduce((a, d) => a + d.selected, 0) === r.summary.selected, 'perDay');
  return Object.entries(r.rejectedByReason).map(([k, v]) => `${k}=${v}`).join(', ');
});
await test('E3', 'Bình Thủy (no release plan) is excluded with MOVIE_NOT_AVAILABLE', async () => {
  const bt = ctx.run.perCluster.find((c) => c.clusterId === 3);
  expect(bt.selected === 0, `${bt.selected} selected at Bình Thủy`);
  expect((ctx.run.excludedByReason.MOVIE_NOT_AVAILABLE ?? 0) >= 2, 'no MOVIE_NOT_AVAILABLE');
  return `MOVIE_NOT_AVAILABLE=${ctx.run.excludedByReason.MOVIE_NOT_AVAILABLE}`;
});
await test('E4', 'Generated showtimes: SCHEDULED, inside opening hours, cleanup ≥15 min per room, stagger ≥20 min, ≤ daily max, 3D only in 3D rooms', async () => {
  const problems = [];
  let count = 0;
  for (const clusterId of [1, 2]) {
    const cinema = ctx.cinemas.find((c) => c.clusterId === clusterId);
    for (const date of [vnDate(1), vnDate(2)]) {
      const all = (await call('GET', `/api/admin/showtimes?date=${date}&clusterId=${clusterId}`, { token: ctx.admin })).result;
      const mine = all.filter((s) => s.generationRunId === ctx.run.runId);
      count += mine.length;
      const dow = new Date(`${date}T12:00:00+07:00`).getDay();
      const h = cinema.operatingHours.find((o) => o.dayOfWeek === dow);
      const opens = toMin(h.opensAt);
      const closes = toMin(h.closesAt);
      for (const s of mine) {
        if (s.status !== 'SCHEDULED') problems.push(`#${s.showTimeId} status ${s.status}`);
        const start = toMin(s.startTime);
        let end = toMin(s.endTime);
        if (end < start) end += 1440;
        if (start < opens || end + 15 > closes) problems.push(`#${s.showTimeId} ${s.startTime}-${s.endTime} outside ${h.opensAt}-${h.closesAt}`);
        const room = cinema.rooms.find((r) => r.roomId === s.cinemaRoomId);
        if (!room.formats.includes(s.formatCode)) problems.push(`#${s.showTimeId} ${s.formatCode} in ${room.name}`);
      }
      // Same room: next start ≥ previous end + 15 (against every showtime in the room, not only this run).
      const byRoom = new Map();
      all.filter((s) => s.status !== 'CANCELLED').forEach((s) => byRoom.set(s.cinemaRoomId, [...(byRoom.get(s.cinemaRoomId) ?? []), s]));
      for (const list of byRoom.values()) {
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));
        for (let i = 1; i < list.length; i++) {
          let prevEnd = toMin(list[i - 1].endTime);
          if (prevEnd < toMin(list[i - 1].startTime)) prevEnd += 1440;
          if (toMin(list[i].startTime) < prevEnd + 15) problems.push(`room ${list[i].cinemaRoomName} ${list[i - 1].startTime}/${list[i].startTime}`);
        }
      }
      const starts = mine.map((s) => toMin(s.startTime)).sort((a, b) => a - b);
      // Any two starts of the movie in one cinema are ≥20 min apart (same room is further apart anyway).
      for (let i = 1; i < starts.length; i++) {
        if (starts[i] - starts[i - 1] < 20) problems.push(`stagger ${starts[i - 1]}/${starts[i]} at ${cinema.clusterName} ${date}`);
      }
      if (mine.length > cinema.demand.maxDailyShowsPerMovie) problems.push(`${mine.length} > max ${cinema.demand.maxDailyShowsPerMovie} at ${cinema.clusterName} ${date}`);
      if (mine.length < Math.min(cinema.demand.minDailyShows, cinema.demand.maxDailyShowsPerMovie)) problems.push(`${mine.length} < min at ${cinema.clusterName} ${date}`);
    }
  }
  expect(count === ctx.run.summary.selected, `${count} found vs ${ctx.run.summary.selected} selected`);
  expect(!problems.length, problems.slice(0, 5).join('; '));
  return `${count} suất kiểm tra, 0 vi phạm`;
});
await test('E5', 'Prices snapshotted from the price book (VIP = ×1.2, couple = ×1.15, weekend/evening rates)', async () => {
  const book = (await call('GET', '/api/admin/price-books/1', { token: ctx.admin })).result;
  const shows = (await call('GET', `/api/admin/showtimes?date=${vnDate(1)}&clusterId=1`, { token: ctx.admin })).result.filter((s) => s.generationRunId === ctx.run.runId);
  expect(shows.length, 'no showtimes');
  const r1000 = (n) => Math.round(n / 1000) * 1000;
  for (const s of shows) {
    expect(s.seatPrices?.STANDARD, `#${s.showTimeId} has no seatPrices`);
    expect(s.seatPrices.VIP === r1000(s.seatPrices.STANDARD * book.seatMultipliers.VIP), `#${s.showTimeId} VIP ${s.seatPrices.VIP}`);
    expect(s.seatPrices.COUPLE === r1000(s.seatPrices.STANDARD * book.seatMultipliers.COUPLE), `#${s.showTimeId} COUPLE`);
    expect(book.rates.some((r) => r.standardPrice === s.seatPrices.STANDARD && r.format === s.formatCode), `#${s.showTimeId} price ${s.seatPrices.STANDARD} not in book`);
  }
  const s = shows[0];
  return `${s.startTime.slice(0, 5)} ${s.formatCode}: thường ${s.seatPrices.STANDARD}, VIP ${s.seatPrices.VIP}, đôi ${s.seatPrices.COUPLE}`;
});
await test('E6', 'Unpublished showtimes are not bookable by customers', async () => {
  const r = await call('GET', `/api/public/movies/${ctx.movie.movieId}/showtimes?date=${vnDate(1)}&clusterId=1`);
  expectStatus(r, 200);
  expect(r.result.length === 0, `${r.result.length} visible`);
});
await test('E7', 'Running the same input again does not double-book rooms or exceed the daily maximum', async () => {
  const r = await call('POST', '/api/admin/scheduling-runs', {
    token: ctx.admin,
    body: { startDate: vnDate(1), endDate: vnDate(2), clusterIds: [1, 2], movieIds: [ctx.movie.movieId], publish: false },
  });
  expectStatus(r, 201);
  ctx.run2 = r.result;
  const conflicts = (r.result.rejectedByReason.EXISTING_SHOWTIME_CONFLICT ?? 0) + (r.result.rejectedByReason.MAX_DAILY_SHOWS_PER_MOVIE_REACHED ?? 0);
  expect(conflicts > 0, 'existing showtimes were not taken into account');
  return `${r.result.summary.selected} suất mới (lấp chỗ trống), EXISTING_SHOWTIME_CONFLICT=${r.result.rejectedByReason.EXISTING_SHOWTIME_CONFLICT ?? 0}`;
});
await test('E8', 'Discard run #2 removes only its unpublished showtimes', async () => {
  const r = await call('POST', `/api/admin/scheduling-runs/${ctx.run2.runId}/discard`, { token: ctx.admin });
  expectStatus(r, 200);
  expect(r.result.removed === ctx.run2.summary.selected, `${r.result.removed} removed vs ${ctx.run2.summary.selected}`);
  return `xoá ${r.result.removed}, trạng thái ${r.result.status}`;
});
await test('E9', 'Publish run #1 opens its showtimes; movie becomes "Đang chiếu" at Ninh Kiều', async () => {
  const r = await call('POST', `/api/admin/scheduling-runs/${ctx.run.runId}/publish`, { token: ctx.admin });
  expectStatus(r, 200);
  expect(r.result.opened === ctx.run.summary.selected, `${r.result.opened} opened`);
  const shows = (await call('GET', `/api/public/movies/${ctx.movie.movieId}/showtimes?date=${vnDate(1)}&clusterId=1`)).result;
  expect(shows.length > 0, 'no public showtimes');
  ctx.showtime = shows[Math.floor(shows.length / 2)];
  const nk = (await call('GET', '/api/public/movies?clusterId=1')).result.find((m) => m.movieId === ctx.movie.movieId);
  expect(nk?.displayStatus === 'NOW_SHOWING', nk?.displayStatus);
  return `mở bán ${r.result.opened} suất`;
});
await test('E10', 'Run history lists the run; run detail has samples of rejected candidates', async () => {
  const list = (await call('GET', '/api/admin/scheduling-runs', { token: ctx.admin })).result;
  expect(list.some((x) => x.runId === ctx.run.runId), 'not in history');
  const d = (await call('GET', `/api/admin/scheduling-runs/${ctx.run.runId}`, { token: ctx.admin })).result;
  expect(d.rejectionSamples.length > 0 && d.rejectionSamples[0].movieTitle, 'no samples');
  return `${d.rejectionSamples.length} mẫu, vd. ${d.rejectionSamples[0].time} ${d.rejectionSamples[0].roomName}: ${d.rejectionSamples[0].reason}`;
});
await test('E11', 'Validation: more than 14 days → 400; no approved movie → 409', async () => {
  const a = await call('POST', '/api/admin/scheduling-runs', { token: ctx.admin, body: { startDate: vnDate(), endDate: vnDate(20), clusterIds: [1], movieIds: [ctx.movie.movieId] } });
  const b = await call('POST', '/api/admin/scheduling-runs', { token: ctx.admin, body: { startDate: vnDate(), endDate: vnDate(1), clusterIds: [1], movieIds: [99999999] } });
  expectStatus(a, 400);
  expectStatus(b, 409);
  return `${a.json.message} / ${b.json.message}`;
});

// ── F. Price book ──────────────────────────────────────────────────────────
group = 'F. Price book';
console.log(group);
await test('F1', 'Price book has 16 rates (2 day types × 4 dayparts × 2D/3D); weekend > weekday; 3D > 2D', async () => {
  const b = (await call('GET', '/api/admin/price-books/1', { token: ctx.admin })).result;
  expect(b.rates.length === 16, `${b.rates.length} rates`);
  const p = (dt, dp, f) => b.rates.find((r) => r.dayType === dt && r.daypart === dp && r.format === f).standardPrice;
  expect(p('WEEKEND', 'EVENING', '2D') > p('WEEKDAY', 'EVENING', '2D'), 'weekend');
  expect(p('WEEKDAY', 'EVENING', '3D') > p('WEEKDAY', 'EVENING', '2D'), '3D');
  ctx.book = b;
  return `tối thường ngày 2D ${p('WEEKDAY', 'EVENING', '2D')}, cuối tuần ${p('WEEKEND', 'EVENING', '2D')}, 3D ${p('WEEKDAY', 'EVENING', '3D')}`;
});
await test('F2', 'Invalid price (5.000 ₫) → 400; saving the same book → 200', async () => {
  const bad = await call('PUT', '/api/admin/price-books/1', { token: ctx.admin, body: { rates: [{ ...ctx.book.rates[0], standardPrice: 5000 }], seatMultipliers: ctx.book.seatMultipliers } });
  expectStatus(bad, 400);
  const good = await call('PUT', '/api/admin/price-books/1', { token: ctx.admin, body: { rates: ctx.book.rates, seatMultipliers: ctx.book.seatMultipliers } });
  expectStatus(good, 200);
  return bad.json.message;
});

// ── G. Booking, seats, payment ─────────────────────────────────────────────
group = 'G. Booking & payment';
console.log(group);
await test('G1', 'Seat map matches the room layout and carries per-type prices', async () => {
  const r = await call('GET', `/api/public/showtimes/${ctx.showtime.showTimeId}/seats`, { token: ctx.user });
  expectStatus(r, 200);
  expect(r.result.seats.length === ctx.showtime.totalSeats, `${r.result.seats.length} vs ${ctx.showtime.totalSeats}`);
  ctx.seats = r.result.seats;
  const vip = r.result.seats.find((s) => s.type === 'VIP');
  return `${r.result.seats.length} ghế, VIP ${vip?.price}`;
});
await test('G2', 'Hold 2 VIP seats; same Idempotency-Key returns the same booking', async () => {
  const free = ctx.seats.filter((s) => s.type === 'VIP' && s.status === 'AVAILABLE').slice(0, 2);
  expect(free.length === 2, 'no free VIP seats');
  ctx.seatIds = free.map((s) => s.seatId);
  const key = `test-${Date.now()}`;
  const a = await call('POST', '/api/me/bookings', { token: ctx.user, body: { showtimeId: ctx.showtime.showTimeId, seatIds: ctx.seatIds }, headers: { 'Idempotency-Key': key } });
  const b = await call('POST', '/api/me/bookings', { token: ctx.user, body: { showtimeId: ctx.showtime.showTimeId, seatIds: ctx.seatIds }, headers: { 'Idempotency-Key': key } });
  expectStatus(a, 201);
  expect(a.result.bookingId === b.result.bookingId, 'different bookings');
  ctx.booking = a.result;
  return `${free.map((s) => s.seatCode).join(', ')} = ${a.result.total}`;
});
await test('G3', 'Another customer cannot take the same seats → 409', async () => {
  const r = await call('POST', '/api/me/bookings', { token: ctx.user2, body: { showtimeId: ctx.showtime.showTimeId, seatIds: ctx.seatIds } });
  expectStatus(r, 409);
  return r.json.message;
});
await test('G4', 'Half a couple seat → 400', async () => {
  const half = ctx.seats.find((s) => s.type === 'COUPLE' && s.status === 'AVAILABLE');
  const r = await call('POST', '/api/me/bookings', { token: ctx.user2, body: { showtimeId: ctx.showtime.showTimeId, seatIds: [half.seatId] } });
  expectStatus(r, 400);
  return r.json.message;
});
await test('G5', 'Booking code is hidden before payment', async () => {
  const r = await call('GET', `/api/me/bookings/${ctx.booking.bookingId}`, { token: ctx.user });
  expectStatus(r, 200);
  expect(!r.result.bookingCode, 'code visible');
  expect(r.result.cinemaClusterName === 'CinePrime Ninh Kiều', r.result.cinemaClusterName);
});
await test('G6', 'Payment session is a signed VNPay URL returning to /api/payments/vnpay/return', async () => {
  const r = await call('POST', `/api/me/bookings/${ctx.booking.bookingId}/payment`, { token: ctx.user, body: { returnUrl: 'exp://10.0.2.2:8099/--/payment-return?bookingId=x' }, headers: { 'Idempotency-Key': `pay-${Date.now()}` } });
  expectStatus(r, 201);
  const url = new URL(r.result.paymentUrl);
  expect(url.host.includes('vnpayment.vn'), url.host);
  expect(url.searchParams.get('vnp_SecureHash'), 'unsigned');
  expect(url.searchParams.get('vnp_ReturnUrl').endsWith('/api/payments/vnpay/return'), url.searchParams.get('vnp_ReturnUrl'));
  ctx.vnp = url.searchParams;
  return `${r.result.provider}, ${url.host}`;
});
await test('G7', 'Tampered VNPay return is rejected', async () => {
  const r = await call('GET', `/api/payments/vnpay/return?vnp_TxnRef=${ctx.vnp.get('vnp_TxnRef')}&vnp_Amount=${ctx.vnp.get('vnp_Amount')}&vnp_ResponseCode=00&vnp_SecureHash=deadbeef`);
  expect(r.text.includes('Không xác thực được giao dịch'), 'accepted');
});
await test('G8', 'Correctly signed VNPay return confirms the booking; QR code value (booking code) appears', async () => {
  const secret = process.env.VNPAY_HASH_SECRET;
  if (!secret) skip('VNPAY_HASH_SECRET not set');
  const params = {
    vnp_Amount: ctx.vnp.get('vnp_Amount'),
    vnp_BankCode: 'NCB',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: ctx.vnp.get('vnp_OrderInfo'),
    vnp_PayDate: '20261111120000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: ctx.vnp.get('vnp_TmnCode'),
    vnp_TransactionNo: '14000001',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: ctx.vnp.get('vnp_TxnRef'),
  };
  const qs = new URLSearchParams({ ...params, vnp_SecureHash: sign(params, secret) });
  const page = await call('GET', `/api/payments/vnpay/return?${qs}`);
  expect(page.text.includes('Thanh toán thành công'), page.text.slice(0, 200));
  const b = (await call('GET', `/api/me/bookings/${ctx.booking.bookingId}`, { token: ctx.user })).result;
  expect(b.status === 'CONFIRMED' && b.bookingCode, b.status);
  const upcoming = (await call('GET', '/api/me/bookings?scope=upcoming', { token: ctx.user })).result.content;
  expect(upcoming.some((x) => x.bookingId === ctx.booking.bookingId), 'not in upcoming');
  return `CONFIRMED, mã ${b.bookingCode}`;
});
await test('G9', 'Internal checkout page is off unless PAYMENT_MODE=internal', async () => {
  if (process.env.PAYMENT_MODE) skip(`PAYMENT_MODE=${process.env.PAYMENT_MODE}`);
  expectStatus(await call('GET', '/api/payments/checkout?paymentId=x'), 404);
});

// ── H. AI quick booking ────────────────────────────────────────────────────
group = 'H. AI quick booking';
console.log(group);
await test('H1', '"Tối mai 2 người khoảng 8h, phim gì cũng được" → ≤3 options with 2 adjacent seats and Combo Đôi', async () => {
  const r = await call('POST', '/api/me/assistant/suggestions', { token: ctx.user, body: { message: 'Tối mai 2 người khoảng 8h, phim gì cũng được', clusterId: 1, date: vnDate(1) } });
  expectStatus(r, 200);
  const q = r.result;
  expect(q.options.length >= 1 && q.options.length <= 3, `${q.options.length} options`);
  expect(q.partySize === 2, `party ${q.partySize}`);
  for (const o of q.options) {
    expect(o.seats.length === 2, `${o.seats.length} seats`);
    const row = o.seats.map((s) => s.seatCode.replace(/\d+/g, ''));
    const nums = o.seats.map((s) => Number(s.seatCode.replace(/\D/g, ''))).sort((a, b) => a - b);
    expect(row[0] === row[1] && nums[1] - nums[0] === 1, `seats ${o.seats.map((s) => s.seatCode)}`);
    expect(o.combos.some((c) => c.code === 'COMBO2'), 'no Combo Đôi');
    expect(o.total === o.ticketTotal + o.comboTotal, 'total');
    expect(o.summary, 'no summary');
  }
  ctx.quick = q;
  return `${q.source}: ${q.options.map((o) => `${o.startTime} ${o.movie.title} [${o.seats.map((s) => s.seatCode).join(',')}]`).join(' | ')}`;
});
await test('H2', 'Party size and time are read from Vietnamese text ("đi 4 người lúc 19:30")', async () => {
  const r = await call('POST', '/api/me/assistant/suggestions', { token: ctx.user, body: { message: 'đi 4 người lúc 19:30', clusterId: 1, date: vnDate(1) } });
  expectStatus(r, 200);
  expect(r.result.partySize === 4, `party ${r.result.partySize}`);
  expect(r.result.options.every((o) => o.seats.length === 4), 'seat count');
  expect(r.result.options.every((o) => o.combos.some((c) => c.code === 'COMBO3')), 'no Combo Party');
  return `${r.result.options.length} gợi ý, combo ${r.result.options[0]?.combos.map((c) => c.name).join(' + ')}`;
});
await test('H3', '"Đặt nhanh" holds the seats and adds the combo in one call', async () => {
  const o = ctx.quick.options[0];
  const r = await call('POST', '/api/me/assistant/bookings', {
    token: ctx.user,
    headers: { 'Idempotency-Key': `qb-${Date.now()}` },
    body: { showtimeId: o.showtimeId, seatIds: o.seats.map((s) => s.seatId), concessions: o.combos.map(({ sellableType, sellableId, quantity, selections }) => ({ sellableType, sellableId, quantity, selections })) },
  });
  expectStatus(r, 201);
  const b = (await call('GET', `/api/me/bookings/${r.result.bookingId}`, { token: ctx.user })).result;
  expect(b.status === 'PENDING_PAYMENT' && b.concessions.length === o.combos.length, 'booking incomplete');
  expect(b.total === o.total, `total ${b.total} vs suggested ${o.total}`);
  ctx.quickBooking = b;
  return `đơn ${b.total} ₫ (${b.seats.map((s) => s.seatCode).join(', ')} + ${b.concessions.map((c) => c.itemName).join(', ')})`;
});
await test('H4', 'Booking the same suggestion again (seats now held) → 409', async () => {
  const o = ctx.quick.options[0];
  const r = await call('POST', '/api/me/assistant/bookings', { token: ctx.user2, body: { showtimeId: o.showtimeId, seatIds: o.seats.map((s) => s.seatId), concessions: [] } });
  expectStatus(r, 409);
});

// ── I. Plan suspension & archiving rules ───────────────────────────────────
group = 'I. Plan suspension & archive';
console.log(group);
await test('I1', 'Suspending the Ninh Kiều plan suspends unsold showtimes, keeps the sold one, hides the movie there', async () => {
  const r = await call('PATCH', `/api/admin/release-plans/${ctx.plans[0].planId}`, { token: ctx.admin, body: { status: 'SUSPENDED' } });
  expectStatus(r, 200);
  expect(r.result.suspendedShowtimes > 0, 'nothing suspended');
  const st = (await call('GET', `/api/public/showtimes/${ctx.showtime.showTimeId}`)).result;
  expect(st.status === 'ON_SALE', `sold showtime is ${st.status}`);
  const nk = (await call('GET', '/api/public/movies?clusterId=1')).result.find((m) => m.movieId === ctx.movie.movieId);
  expect(!nk, 'still listed');
  return `tạm dừng ${r.result.suspendedShowtimes} suất, suất đã bán vé vẫn mở`;
});
await test('I2', 'Archiving a movie with sold future tickets → 409', async () => {
  const r = await call('POST', `/api/admin/movies/${ctx.movie.movieId}/archive`, { token: ctx.admin });
  expectStatus(r, 409);
  return r.json.message;
});
await test('I3', 'Close the Cái Răng plan (test cleanup)', async () => {
  const r = await call('PATCH', `/api/admin/release-plans/${ctx.plans[1].planId}`, { token: ctx.admin, body: { status: 'CLOSED' } });
  expectStatus(r, 200);
  return `tạm dừng ${r.result.suspendedShowtimes} suất`;
});

const passed = results.filter((r) => r.ok).length;
const skipped = results.filter((r) => !r.ok && r.detail.startsWith('SKIPPED')).length;
console.log(`\n${passed}/${results.length} passed${skipped ? `, ${skipped} skipped` : ''}`);
mkdirSync('docs/test-results', { recursive: true });
writeFileSync('docs/test-results/api-test.json', JSON.stringify({ api: API, ranAt: new Date().toISOString(), movieId: ctx.movie?.movieId, runId: ctx.run?.runId, results }, null, 2));
process.exit(passed + skipped === results.length ? 0 : 1);
