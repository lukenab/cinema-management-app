# CinePrime

A mobile app for booking tickets at a chain of cinemas in Cần Thơ, with a back office for managing movies, release plans, showtimes and prices.

## Overview

CinePrime lets customers pick a cinema, browse what is showing there, choose seats, add food and drinks, pay and keep their tickets in the app. Admins import movies from TMDB, decide which cinemas may show them, generate showtimes automatically and set ticket prices. The app runs on Android and its interface is in Vietnamese.

## Core Features

- Account registration and sign-in, with customer and admin roles
- Five cinemas, each with its own opening hours, rooms and prices
- Movie browsing per cinema ("Đang chiếu" and "Sắp chiếu"), trailers and cast
- Seat selection with a timed seat hold, food and drinks, promotion codes
- VNPay payment and tickets with a QR code
- AI quick booking: describe when and with whom, confirm a ready-made suggestion
- TMDB import, movie review and approval, release plans per cinema
- Automatic showtime generation with a report of chosen and rejected candidates
- Ticket price book by weekday or weekend, time of day, 2D or 3D, and seat type
- Bookings and customer account administration

## Highlights

- **Movie lifecycle**: TMDB import creates a draft, the admin approves it, and a release plan opens it at a cinema. Customers see it as "Sắp chiếu" until showtimes go on sale.
- **Automatic scheduling**: a port of the Legacy Greedy optimizer scores every candidate slot and picks showtimes without room overlaps. Each run keeps a report of selected and rejected candidates with the reason.
- **Pricing**: each cinema has a price book, and a showtime keeps the price it was created with, so later edits never change tickets on sale.
- **Booking**: a unique index on seat locks makes double booking impossible, and a repeated request with the same `Idempotency-Key` returns the same booking.
- **AI quick booking**: Gemini only chooses among showtimes the server lists and writes the summaries. Seats and combos are computed by the server, and a rule-based picker answers when Gemini is unavailable.

## Technology Stack

| Layer | Technologies |
| --- | --- |
| App | Expo SDK 58, React Native, TypeScript, Expo Router |
| State and data fetching | Redux Toolkit, RTK Query |
| API | Expo Router API Routes (`+api.ts`), Zod |
| Database | MongoDB (Atlas), official Node.js driver |
| Integrations | TMDB, VNPay, Google Gemini |
| Development tools | ESLint, TypeScript |

## Project Structure

```text
CinePrime/
├── src/
│   ├── app/          Screens (auth, customer, admin) and API routes (api/)
│   ├── server/       Server-only logic: database, auth, scheduling, bookings, payments, assistant
│   ├── store/        Redux store and the RTK Query API slice
│   ├── components/   Shared UI components
│   ├── hooks/        Reusable React hooks
│   ├── lib/          API client, formatting, labels, secure storage
│   ├── theme/        Colors, spacing and typography
│   └── types/        Types for API responses
├── scripts/          Demo data seeding and the end-to-end API test
├── docs/             Test report and screenshots
├── assets/           Icons and food photos
├── app.json          Expo configuration
└── .env.example      Environment variable template
```

## Getting Started

### Prerequisites

- Node.js and npm
- A MongoDB database (for example MongoDB Atlas)
- A TMDB API key
- A VNPay sandbox merchant, or `PAYMENT_MODE=internal` to use the built-in checkout page
- An Android emulator or the Expo Go app

### Run

```bash
npm install
cp .env.example .env.local    # then fill in the values below
npx expo start --android      # serves the app and the API on port 8081
npm run seed:tmdb             # optional: import movies and generate 7 days of showtimes
```

The Android emulator reaches the dev server at `http://10.0.2.2:8081`. A physical phone needs your computer's LAN IP in `EXPO_PUBLIC_API_URL`.

The first request creates the indexes, the cinemas with their rooms and price books, and the demo accounts. End-to-end API checks run with `node --env-file-if-exists=.env.local scripts/api-test.mjs`, and the latest results are in the [test report](docs/TEST_REPORT.md).

### Environment variables

Server variables have no `EXPO_PUBLIC_` prefix, so they are never bundled into the app. Put them in `.env.local`, which git ignores.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string, including the database name |
| `JWT_SECRET` | Yes | Random string of 64 or more characters for signing tokens |
| `TMDB_API_KEY` | Yes | Movie import from TMDB |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | Yes, unless `PAYMENT_MODE=internal` | VNPay merchant credentials |
| `GEMINI_API_KEY` | No | AI quick booking. Without it a rule-based picker answers. |
| `EXPO_PUBLIC_API_URL` | No | API address used by the app. Defaults to `http://10.0.2.2:8081`. |
| `PUBLIC_BASE_URL` | No | Address VNPay sends the browser back to, when it differs from the one the app called |
| `PAYMENT_MODE` | No | `internal` replaces VNPay with CinePrime's own checkout page |

### Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin` |
| Customer | `user` | `user` |

They are created on the first request. Change them before any real deployment with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DEMO_USERNAME` and `DEMO_PASSWORD`.

For a VNPay sandbox payment, use bank NCB, card `9704198526191432198`, name `NGUYEN VAN A`, expiry `07/15` and OTP `123456`.
