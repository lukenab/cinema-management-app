import type { ObjectId } from 'mongodb';

export type Role = 'MEMBER' | 'ADMIN';

export interface UserDoc {
  _id: ObjectId;
  username: string;
  usernameLower: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
  /** Bumped to revoke every token issued before it. */
  tokenVersion: number;
  profile: { fullName?: string; phoneNumber?: string; dateOfBirth?: string; gender?: string };
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface MovieDoc {
  _id: number;
  tmdbId?: number;
  originalTitle: string;
  title: string;
  translations: { languageCode: string; title?: string; synopsis?: string; tagline?: string }[];
  synopsis?: string;
  tagline?: string;
  durationMinutes?: number;
  releaseDate?: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  country?: string;
  originalLanguage?: string;
  genres: { genreId: number; name: string }[];
  ageRating?: { ratingCode: string; minAge: number };
  cast: { personId: number; fullName: string; photoUrl?: string; roleType: string; characterName?: string; billingOrder?: number }[];
  /**
   * DRAFT: imported (fields auto-filled from TMDB), waiting for the admin to check them.
   * APPROVED: checked, can be given release plans; customers only see it through an open release plan.
   * ARCHIVED: no longer scheduled.
   */
  status: MovieStatus;
  /** Presentation formats the movie is distributed in (2D always; 3D when the admin enables it). */
  formats?: string[];
  /** 0..100, used by the showtime scheduler (TMDB popularity unless the admin overrides it). */
  popularityScore?: number;
  priorityOverride?: number;
  createdAt: Date;
  approvedAt?: Date;
}

export type MovieStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';

export type ShowtimeStatus = 'SCHEDULED' | 'ON_SALE' | 'CANCELLED' | 'COMPLETED' | 'SUSPENDED';

export interface ShowtimeDoc {
  _id: number;
  movieId: number;
  clusterId: number;
  roomId: number;
  roomName: string;
  startAt: Date;
  endAt: Date;
  format: string;
  audioLanguageCode: string;
  subtitleLanguageCode?: string;
  /** Price of a standard seat (from the cinema's price book when the showtime was created). */
  basePrice: number;
  /** Per seat-type prices fixed at creation, so editing the price book never changes sold showtimes. */
  seatPrices?: Record<SeatType, number>;
  priceRateCode?: string;
  /** Generation run that created it (absent for showtimes from the first version). */
  generationRunId?: number;
  status: ShowtimeStatus;
  createdAt: Date;
}

/**
 * One row per seat that is not free. The unique index on (showtimeId, seatId) is what makes two people
 * unable to hold the same seat: the second insert fails.
 */
export interface SeatLockDoc {
  _id: ObjectId;
  showtimeId: number;
  seatId: number;
  bookingId: string;
  userId: string;
  status: 'HELD' | 'SOLD';
  /** Only on HELD rows; a TTL index removes them shortly after this time (reads also ignore expired holds). */
  holdExpiresAt?: Date;
}

export interface PaymentDoc {
  _id: string;
  bookingId: string;
  userId: string;
  idempotencyKey?: string;
  /** INTERNAL: CinePrime's own checkout page (PAYMENT_MODE=internal). FAKE: older records of the same page. */
  provider: 'VNPAY' | 'INTERNAL' | 'FAKE';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  amount: number;
  currency: 'VND';
  /** Reference sent to the provider; unique per attempt. */
  txnRef: string;
  paymentUrl: string;
  /** App link the result page offers to go back to. */
  appReturnUrl?: string;
  createdAt: Date;
  expiresAt: Date;
  paidAt?: Date;
  failureMessage?: string;
  bankCode?: string;
  cardType?: string;
  providerTransactionNo?: string;
}

export type BookingStatus ='PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
export type PaymentStatus = 'NOT_STARTED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface BookingDoc {
  _id: string;
  bookingCode: string;
  userId: string;
  idempotencyKey?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  showtimeId: number;
  movieId: number;
  movieName: string;
  posterUrl?: string;
  clusterId: number;
  clusterName: string;
  roomId: number;
  roomName: string;
  showDate: string;
  startTime: string;
  endTime?: string;
  formatCode?: string;
  audioLanguageCode?: string;
  subtitleLanguageCode?: string;
  ageRatingCode?: string;
  startAt: Date;
  seats: { showtimeSeatId: number; seatCode: string; seatType: string; unitPrice: number; finalPrice: number }[];
  concessions: {
    itemCode: string;
    itemName: string;
    options?: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    finalAmount: number;
  }[];
  ticketSubtotal: number;
  concessionSubtotal: number;
  subtotal: number;
  serviceFee: number;
  discount: number;
  total: number;
  currency: 'VND';
  promotionCode?: string;
  promotionDiscountAmount?: number;
  concessionPickupCode?: string;
  expiresAt: Date;
  paidAt?: Date;
  createdAt: Date;
}

export type SeatType = 'STANDARD' | 'VIP' | 'COUPLE';

export interface OperatingHours {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  opensAt: string; // HH:mm
  closesAt: string; // HH:mm, "24:00" allowed
}

export interface ClusterDoc {
  _id: number;
  clusterCode: string;
  clusterName: string;
  province: string;
  address: string;
  phoneNumber?: string;
  status: 'ACTIVE' | 'INACTIVE';
  operatingHours?: OperatingHours[];
  /** Scheduler inputs, as in the Java cinema_cluster_demand_profile. */
  demand?: { tier: 'HIGH' | 'MEDIUM' | 'LOW'; score: number; minDailyShows: number; maxDailyShowsPerMovie: number };
}

export interface RoomDoc {
  _id: number;
  clusterId: number;
  name: string;
  /** Presentation formats the room can show. */
  formats: string[];
  layout: 'SMALL' | 'STANDARD' | 'LARGE';
  status: 'ACTIVE' | 'INACTIVE';
}

/** Right to show a movie at one cinema for a period (Java: movie_availability). */
export interface ReleasePlanDoc {
  _id: number;
  movieId: number;
  clusterId: number;
  status: 'PLANNED' | 'OPEN' | 'SUSPENDED' | 'CLOSED';
  showingStartDate: string;
  showingEndDate?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceRate {
  dayType: 'WEEKDAY' | 'WEEKEND';
  daypart: Daypart;
  format: string;
  standardPrice: number;
}

export type Daypart = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'LATE_NIGHT';

/** Ticket prices of one cinema (Java: price_book + price_rate). */
export interface PriceBookDoc {
  _id: number; // = clusterId
  rates: PriceRate[];
  seatMultipliers: Record<SeatType, number>;
  updatedAt: Date;
}

export type SkipReason =
  | 'MOVIE_NOT_AVAILABLE'
  | 'NOT_RELEASED_YET'
  | 'NO_ELIGIBLE_ROOM'
  | 'EXISTING_SHOWTIME_CONFLICT'
  | 'CLEANUP_BUFFER_CONFLICT'
  | 'MAXIMUM_ROOM_SHARE_REACHED'
  | 'SAME_MOVIE_START_STAGGER_CONFLICT'
  | 'MAX_DAILY_SHOWS_PER_MOVIE_REACHED'
  | 'MISSING_DEMAND_PROFILE';

export interface GenerationRunDoc {
  _id: number;
  algorithm: 'LEGACY_GREEDY';
  /** COMPLETED: showtimes created (SCHEDULED until published); DISCARDED: its unpublished showtimes were removed. */
  status: 'COMPLETED' | 'FAILED' | 'DISCARDED';
  startDate: string;
  endDate: string;
  clusterIds: number[];
  movieIds: number[];
  policy: Record<string, number | string>;
  summary: { candidates: number; selected: number; rejected: number; excluded: number; durationMs: number };
  /** Count per reason; "excluded" reasons stop a movie/cinema/day before any slot is built. */
  rejectedByReason: Partial<Record<SkipReason, number>>;
  excludedByReason: Partial<Record<SkipReason, number>>;
  perMovie: { movieId: number; title: string; candidates: number; selected: number; rejected: number }[];
  perCluster: { clusterId: number; name: string; candidates: number; selected: number; rejected: number }[];
  /** A capped sample of rejections, enough to trace why slots were not chosen. */
  rejectionSamples: { movieId: number; clusterId: number; roomId: number; startAt: Date; format: string; score: number; reason: SkipReason }[];
  perDay: { date: string; selected: number }[];
  exclusions: { movieId: number; clusterId: number; date: string; reason: SkipReason }[];
  /** Score parts of the chosen showtimes, for the run report. */
  selectedSamples: { showtimeId: number; score: number; daypart: string; expectedAttendance: number; capacity: number }[];
  showtimeIds: number[];
  publishedAt?: Date;
  error?: string;
  createdBy: string;
  createdAt: Date;
}
