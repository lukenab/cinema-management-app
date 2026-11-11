// DTOs returned by the API routes in src/app/api (shapes built in src/server).
// Only the fields the mobile app reads are declared.

export type DisplayStatus = 'NOW_SHOWING' | 'COMING_SOON';

export interface Genre {
  genreId: number;
  name?: string;
  genreName?: string;
}

export interface AgeRating {
  /** Backend field name. */
  ratingCode?: string;
  /** Alias used by the mock gateway. */
  code?: string;
  minAge?: number;
  name?: string;
  description?: string;
}

export interface ScreeningFormat {
  formatId?: number;
  code?: string;
  name?: string;
}

export interface CastMember {
  personId: number;
  fullName: string;
  photoUrl?: string;
  roleType: string;
  characterName?: string;
  billingOrder?: number;
}

export interface PublicMovie {
  movieId: number;
  originalTitle: string;
  /** Vietnamese title when the server has one. */
  title?: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  trailerUrl?: string;
  releaseDate?: string;
  synopsis?: string;
  durationMinutes?: number;
  genres: Genre[];
  displayStatus: DisplayStatus;
  clusterId?: number;
  clusterName?: string;
  nextShowtimeAt?: string;
  bookingAvailable: boolean;
  /** First backdrop image, used by home hero banners. */
  backdropUrl?: string;
  tagline?: string;
  country?: string;
  originalLanguage?: string;
  ageRating?: AgeRating;
  formats?: string[];
  cast?: CastMember[];
  /** Detail only. */
  translations?: { languageCode: string; title?: string; synopsis?: string; tagline?: string }[];
}

export interface Cluster {
  clusterId: number;
  clusterCode: string;
  clusterName: string;
  coverImageUrl?: string;
  province: string;
  address: string;
  phoneNumber?: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'INACTIVE';
  operatingHours?: { dayOfWeek: number; opensAt: string; closesAt: string }[];
  demand?: { tier: 'HIGH' | 'MEDIUM' | 'LOW'; score: number; minDailyShows: number; maxDailyShowsPerMovie: number };
  rooms?: { roomId: number; name: string; formats: string[]; layout: 'SMALL' | 'STANDARD' | 'LARGE'; capacity: number }[];
}

export type ShowtimeStatus = 'SCHEDULED' | 'ON_SALE' | 'CANCELLED' | 'COMPLETED' | 'SUSPENDED';

export interface Showtime {
  showTimeId: number;
  movieId: number;
  movieName: string;
  moviePosterUrl?: string;
  cinemaRoomId: number;
  cinemaRoomName: string;
  clusterId?: number;
  clusterName?: string;
  showDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss
  endTime: string;
  status: ShowtimeStatus;
  formatCode?: string;
  audioLanguageCode?: string;
  subtitleLanguageCode?: string;
  totalSeats?: number;
  availableSeats?: number;
  /** Standard seat price. */
  price?: number;
  seatPrices?: Partial<Record<'STANDARD' | 'VIP' | 'COUPLE', number>>;
  generationRunId?: number;
}

export type SeatType = 'STANDARD' | 'VIP' | 'COUPLE' | 'ACCESSIBLE';

export interface Seat {
  seatId: number;
  seatCode?: string;
  seatGroupId?: string;
  row: string;
  number: number;
  type: SeatType;
  colSpan?: number;
  aisleAfter?: boolean;
  status: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
  price: number;
  reservedByMe?: boolean;
}

export interface SeatMapPosition {
  rowIndex: number;
  columnIndex: number;
  rowLabel: string;
  positionType: 'SEAT' | 'AISLE' | 'EXIT' | 'EMPTY_SPACE';
  seatNumber?: number;
  seatCode?: string;
  seatType?: SeatType;
  seatGroupId?: string;
}

export interface ShowtimeSeatMap {
  seats: Seat[];
  positions: SeatMapPosition[];
}

export interface SeatHoldPolicy {
  channel: 'WEB' | 'MOBILE' | 'COUNTER';
  ttlSeconds: number;
  maxSeatsPerBooking: number;
}

export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export type PaymentStatus = 'NOT_STARTED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface BookingSeat {
  showtimeSeatId: number;
  seatCode: string;
  seatType: SeatType;
  unitPrice: number;
  finalPrice: number;
}

export interface BookingConcession {
  itemCode: string;
  itemName: string;
  options?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  finalAmount: number;
}

export interface BookingDetail {
  bookingId: string;
  /** Only present once the order is paid (it is what the customer shows at the cinema). */
  bookingCode?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  showtimeId: number;
  movieId: number;
  movieName: string;
  cinemaClusterId: number;
  cinemaClusterName: string;
  cinemaRoomId: number;
  cinemaRoomName: string;
  showDate: string;
  startTime: string;
  endTime?: string;
  formatCode?: string;
  audioLanguageCode?: string;
  subtitleLanguageCode?: string;
  ageRatingCode?: string;
  seats: BookingSeat[];
  concessions: BookingConcession[];
  ticketSubtotal: number;
  concessionSubtotal: number;
  subtotal: number;
  serviceFee: number;
  discount: number;
  total: number;
  currency: string;
  promotionCode?: string;
  promotionDiscountAmount?: number;
  expiresAt?: string;
  paidAt?: string;
  createdAt: string;
  concessionPickupCode?: string;
  posterUrl?: string;
  /** Admin lists only. */
  customerName?: string;
}

export interface BookingPage {
  content: BookingDetail[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last?: boolean;
}

export interface BookingConfirmation {
  bookingId: string;
  holdId?: string;
  lockedUntil?: string;
  expiresAt?: string;
  total?: number;
  currency?: string;
}

export type PaymentAttemptStatus = 'INITIATED' | 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';

export interface PaymentSession {
  paymentId: string;
  bookingId: string;
  provider: string;
  status: PaymentAttemptStatus;
  paymentUrl?: string;
  amount: number;
  currency: string;
  expiresAt: string;
  failureMessage?: string;
  bankCode?: string;
  cardType?: string;
}

export interface ComboComponent {
  groupCode: string;
  allowedSkuId: number;
  skuCode: string;
  label: string;
  quantity: number;
  minSelect: number;
  maxSelect: number;
  availableCount?: number | null;
}

export interface CatalogConcession {
  sellableType: 'SKU' | 'COMBO';
  sellableId: number;
  code: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency: string;
  availability: 'AVAILABLE' | 'LOW_AVAILABILITY' | 'SOLD_OUT';
  size?: string;
  flavor?: string;
  components: ComboComponent[];
}

export interface ConcessionSelection {
  groupCode: string;
  skuIds: number[];
}

export interface ConcessionCartItem {
  sellableType: 'SKU' | 'COMBO';
  sellableId: number;
  quantity: number;
  selections?: ConcessionSelection[];
}

export interface PublicPromotionOffer {
  code: string;
  name: string;
  description?: string;
  benefitScope: 'TICKETS' | 'CONCESSIONS' | 'ORDER';
  validFrom?: string | null;
  validUntil?: string | null;
  discountType: string;
  percentage?: number | null;
  fixedAmount?: number | null;
  maxDiscountAmount?: number | null;
  minimumOrderAmount: number;
  currency: string;
}

/** An offer as it applies to one order right now. */
export interface PromotionOption extends PublicPromotionOffer {
  eligible: boolean;
  /** Why it cannot be used. */
  reason?: string;
  /** What it would take off this order. */
  discountAmount?: number;
  applied: boolean;
}

export interface UserProfile {
  accountId?: string;
  fullName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  profileCompleted?: boolean;
}

// ── Admin ─────────────────────────────────────────────────────────────────

export interface TmdbSearchItem {
  tmdbId: number;
  title: string;
  originalTitle: string;
  releaseDate?: string;
  posterUrl?: string;
  overview?: string;
  /** True when the movie already exists locally. */
  alreadyImported?: boolean;
  localMovieId?: number;
}

export interface TmdbMovieDetails {
  tmdbId: number;
  title: string;
  originalTitle: string;
  originalLanguage?: string;
  durationMinutes?: number;
  releaseDate?: string;
  country?: string;
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
  tagline?: string;
  trailerUrl?: string;
  genres: string[];
  ageRating?: { ratingCode: string; minAge: number };
  cast: { tmdbId: number; fullName: string; roleType: string; photoUrl?: string }[];
  warnings: string[];
  popularityScore?: number;
  /** Set when the movie was already imported. */
  localMovieId?: number;
}

/** DRAFT = imported, being checked; APPROVED = can get release plans; ARCHIVED = out of circulation. */
export type MovieStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';

export interface AdminMovie {
  movieId: number;
  tmdbId?: number;
  title: string;
  originalTitle: string;
  durationMinutes?: number;
  releaseDate?: string;
  status: MovieStatus;
  ageRating?: AgeRating;
  posterUrl?: string;
  thumbnailUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  synopsis?: string;
  tagline?: string;
  country?: string;
  originalLanguage?: string;
  formats: string[];
  popularityScore?: number;
  priorityOverride?: number;
  genres: { genreId: number; genreName?: string }[];
  cast: { fullName: string; roleType: string }[];
  /** Missing fields that block approval. */
  approvalProblems: string[];
  approvedAt?: string;
  createdAt: string;
  openPlans?: number;
  upcomingShowtimes?: number;
}

export type AgeRatingCode = 'P' | 'K' | 'T13' | 'T16' | 'T18';

export type ReleasePlanStatus = 'PLANNED' | 'OPEN' | 'SUSPENDED' | 'CLOSED';

export interface ReleasePlan {
  planId: number;
  movieId: number;
  movieTitle?: string;
  posterUrl?: string;
  releaseDate?: string;
  clusterId: number;
  clusterName: string;
  status: ReleasePlanStatus;
  showingStartDate: string;
  showingEndDate?: string;
  note?: string;
  allowedTransitions: ReleasePlanStatus[];
  updatedAt: string;
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

export interface SchedulingRunSummary {
  runId: number;
  algorithm: string;
  status: 'COMPLETED' | 'FAILED' | 'DISCARDED';
  startDate: string;
  endDate: string;
  clusters: { clusterId: number; name: string }[];
  movies: { movieId: number; title: string }[];
  summary: { candidates: number; selected: number; rejected: number; excluded: number; durationMs: number };
  published: boolean;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface SchedulingRunDetail extends SchedulingRunSummary {
  policy: Record<string, number | string>;
  rejectedByReason: Partial<Record<SkipReason, number>>;
  excludedByReason: Partial<Record<SkipReason, number>>;
  perMovie: { movieId: number; title: string; candidates: number; selected: number; rejected: number }[];
  perCluster: { clusterId: number; name: string; candidates: number; selected: number; rejected: number }[];
  perDay: { date: string; selected: number }[];
  showtimeStatus: Record<string, number>;
  rejectionSamples: {
    movieId: number;
    movieTitle?: string;
    clusterId: number;
    clusterName: string;
    roomId: number;
    roomName?: string;
    date: string;
    time: string;
    format: string;
    score: number;
    reason: SkipReason;
  }[];
  exclusions: { movieId: number; movieTitle?: string; clusterId: number; clusterName: string; date: string; reason: SkipReason }[];
  opened?: number;
  removed?: number;
}

export interface PriceRate {
  dayType: 'WEEKDAY' | 'WEEKEND';
  daypart: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'LATE_NIGHT';
  format: '2D' | '3D';
  standardPrice: number;
}

export interface PriceBook {
  clusterId: number;
  rates: PriceRate[];
  seatMultipliers: { STANDARD: number; VIP: number; COUPLE: number };
  dayparts: { code: PriceRate['daypart']; label: string }[];
  updatedAt: string;
}

export interface QuickBookingCombo extends ConcessionCartItem {
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  options?: string;
}

export interface QuickBookingOption {
  showtimeId: number;
  showDate: string;
  startTime: string;
  endTime: string;
  format: string;
  roomName: string;
  seatsLeft: number;
  movie: { movieId: number; title: string; posterUrl?: string; durationMinutes?: number; ageRatingCode?: string; genres: string[] };
  summary: string;
  reason: string;
  seats: { seatId: number; seatCode: string; type: 'STANDARD' | 'VIP' | 'COUPLE'; price: number }[];
  seatsAdjacent: boolean;
  combos: QuickBookingCombo[];
  ticketTotal: number;
  comboTotal: number;
  total: number;
}

export interface QuickBookingResult {
  source: 'AI' | 'RULES';
  reply: string;
  partySize: number;
  date: string;
  clusterId: number;
  clusterName: string;
  options: QuickBookingOption[];
}

export interface AdminShowtime extends Showtime {
  soldSeats: number;
}

export interface BulkStatusResult {
  updated: number;
  skipped: { showTimeId: number; reason: string }[];
}

export interface PageResult<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last?: boolean;
}

export interface Account {
  accountId: string;
  username?: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  lastLoginAt?: string | null;
  createdAt?: string;
  roles?: { roleName: string }[];
}

export interface AccountPage {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalElements: number;
  data: Account[];
}
