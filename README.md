# CinePrime Mobile

React Native (Expo SDK 58, TypeScript, Expo Router) cinema ticketing app for a chain of five CinePrime cinemas in Cần Thơ
(Android, Vietnamese UI). The API lives in the same project as Expo Router API Routes (`src/app/api/**/+api.ts`, logic in
`src/server/`) on MongoDB Atlas, so `npx expo start` serves the app bundle and the API on one port. Two roles: customer and admin.

## Features

| Area | What it does |
|---|---|
| Customer | Choose a cinema; "Đang chiếu" / "Sắp chiếu" for that cinema; movie detail (trailer, cast); showtimes by day; seat map per room; seat hold (8 min); food & drinks; promotion codes; VNPay payment; "Vé của tôi" with a QR code per ticket; profile |
| AI quick booking | "Đặt nhanh": the customer writes when and with whom ("tối nay 2 người, phim gì cũng được"); Gemini picks up to 3 showtimes and summarises each movie; the server adds the best adjacent seats and a combo for the group; one tap holds the seats and opens payment |
| Admin | TMDB import (fields auto-filled, saved as a draft) → review and approve; release plans per cinema; automatic showtime generation (Legacy Greedy) with a report of chosen and rejected candidates; open / suspend / cancel showtimes per cinema; price book per cinema; bookings; customers |

## Run

```bash
npm install
cp .env.example .env.local        # MONGODB_URI, JWT_SECRET, TMDB_API_KEY, VNPAY_*, GEMINI_API_KEY (server-only, never EXPO_PUBLIC_)
npx expo start --android          # app + API on :8081
npm run seed:tmdb                 # imports + approves TMDB movies, opens release plans, schedules 7 days at all cinemas
```

- Android emulator reaches the dev server at `http://10.0.2.2:8081` (default in `.env.example`). A physical phone needs your LAN IP.
- The first request creates indexes, the five cinemas with their rooms and price books, the admin account (`admin` / `admin`) and a
  demo customer (`user` / `user`, profile complete). Movies from the first version are migrated to APPROVED with open release plans.
- TMDB is reached through `api.tmdb.org` (alias of `api.themoviedb.org`, which some Vietnamese ISPs reset). Override with `TMDB_API_BASE`.
- Do not start Metro with `CI=1`: the dev server then rejects the device with `401 Unauthorized`.
- Tests: `scripts/api-test.mjs` (51 end-to-end API checks). Latest results: [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

## How it works

- **Cinemas** (`src/server/cinema.ts`): Ninh Kiều, Cái Răng, Bình Thủy, Ô Môn, Thốt Nốt, with opening hours similar to public cinema
  hours in Cần Thơ (about 08:30–23:30, later on Friday–Sunday), 2–4 rooms each (small 60, standard 80, large 120 seats; VIP rows in the
  middle, couple seats at the back) and a demand profile (score, minimum and maximum shows per movie per day) used by the scheduler.
- **Movie lifecycle**: TMDB import → `DRAFT` (title, synopsis, runtime, age rating, cast, trailer, popularity filled in) → the admin
  checks and approves → `APPROVED`. Customers still do not see it until a **release plan** (right to show the movie at a cinema for a
  period: `PLANNED → OPEN → SUSPENDED → CLOSED`) is open there: it is "Sắp chiếu" at that cinema, and "Đang chiếu" once it has showtimes on
  sale. Suspending or closing a plan suspends that movie's unsold future showtimes at the cinema. `ARCHIVED` closes every plan.
- **Automatic showtimes** (`src/server/scheduling/`, a port of the Java Legacy Greedy optimizer): candidates are built for every day ×
  cinema × movie × format × room, every 15 minutes within opening hours; each gets a score (movie demand 40 %, cinema demand 25 %, daypart
  15 %, format 10 %, room-size fit 10 %). The selector first gives each movie/cinema/day its minimum number of shows round-robin, then hands
  out extra shows by score up to the daily maximum, rejecting candidates that would overlap a room (with 15 min cleaning), start the same
  movie within 20 min in another room, or put one movie in more than 60 % of the rooms at once. Existing showtimes are respected, so a run
  can be repeated. Each run is saved with counts per reason, per movie / cinema / day and samples of rejected candidates; its showtimes
  stay `SCHEDULED` until the admin publishes the run (or discards it).
- **Prices** (`src/server/pricing.ts`): each cinema has a price book: weekday / weekend (Fri–Sun) × morning / afternoon / evening / late ×
  2D / 3D, plus multipliers for VIP (1.2) and couple (1.15) seats. Prices are copied onto the showtime when it is created, so editing the
  book never changes showtimes already on sale.
- **Seats:** `seat_locks` has a unique index on (showtimeId, seatId), so two customers can never hold the same seat; holds expire (TTL
  index) and a booking created with the same `Idempotency-Key` returns the booking already created.
- **Payment:** VNPay. `POST /api/me/bookings/{id}/payment` returns a signed VNPay URL; VNPay sends the browser to
  `/api/payments/vnpay/return`, which checks the HMAC-SHA512 signature and amount, confirms the booking and shows a page that opens the app
  on the ticket. The booking code (shown as a QR code on the ticket) is only revealed once paid. `PAYMENT_MODE=internal` swaps VNPay for
  CinePrime's own checkout page, for environments without VNPay credentials. VNPay sandbox test card: NCB `9704198526191432198`,
  NGUYEN VAN A, `07/15`, OTP `123456`.
- **AI quick booking** (`src/server/assistant.ts`): the server lists what is on sale at the cinema that day, Gemini only chooses among
  those showtime ids and writes the summaries; seats (best block of adjacent seats near the centre, couple seat for two) and combos (Solo /
  Đôi / Party by group size) are computed by the server. Without `GEMINI_API_KEY`, or when Gemini fails, a rule-based picker reads the time
  and group size from the text and answers instead.

## API layout

Expo Router requires the `+api.ts` suffix: it is how a file in `src/app` is marked as a server route instead of a screen
([Expo docs](https://docs.expo.dev/router/web/api-routes/)). URLs are grouped by who may call them:

| Prefix | Who | Examples |
|---|---|---|
| `/api/auth/*` | anyone | `login`, `register`, `refresh`, `logout` |
| `/api/public/*` | anyone | `cinemas`, `movies?clusterId=`, `movies/{id}/showtimes`, `showtimes/{id}/seats`, `promotions`, `booking-policy` |
| `/api/me/*` | signed-in customer | `me`, `me/profile`, `me/bookings`, `me/bookings/{id}/payment`, `me/assistant/suggestions` |
| `/api/payments/*` | the payment browser page | `vnpay/return`, `checkout` (only with `PAYMENT_MODE=internal`) |
| `/api/admin/*` | admin | `movies`, `tmdb/movies`, `tmdb/imports`, `release-plans`, `scheduling-runs`, `showtimes`, `price-books/{clusterId}`, `bookings`, `customers` |

## Layout

```
src/app/            routes only: (auth), (customer)/(tabs), booking/…, quick-book, admin/…
src/app/api/        API Routes (+api.ts), grouped as above
src/server/         server-only code: MongoDB, auth, cinemas, pricing, release plans, scheduling/, bookings, payments, assistant, TMDB
src/store/          Redux Toolkit (auth) + RTK Query `api`
src/hooks/          use-cinema (chosen cinema, remembered), countdown, seat map refresh
src/lib/            apiClient, jwt, secureStorage, format, labels
src/components/     ui kit, CinemaPicker, MovieCard, SeatGrid
scripts/            seed-tmdb.mjs (demo data), api-test.mjs (end-to-end API test)
```
