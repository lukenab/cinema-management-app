import { createApi, type BaseQueryFn } from "@reduxjs/toolkit/query/react";

import { ApiError, apiRequest, type RequestOptions } from "@/lib/apiClient";
import { BOOKING_CHANNEL } from "@/lib/config";
import type {
  Account,
  AccountPage,
  AdminMovie,
  AdminShowtime,
  AgeRatingCode,
  BookingConfirmation,
  BookingDetail,
  BookingPage,
  BulkStatusResult,
  CatalogConcession,
  Cluster,
  ConcessionCartItem,
  MovieStatus,
  PaymentSession,
  PriceBook,
  PriceRate,
  PublicMovie,
  PromotionOption,
  PublicPromotionOffer,
  QuickBookingResult,
  ReleasePlan,
  ReleasePlanStatus,
  SchedulingRunDetail,
  SchedulingRunSummary,
  SeatHoldPolicy,
  Showtime,
  ShowtimeSeatMap,
  TmdbMovieDetails,
  TmdbSearchItem,
  UserProfile,
} from "@/types/api";

export interface ApiQueryArgs extends RequestOptions {
  url: string;
}

export interface ApiQueryError {
  status: number;
  message: string;
  code?: number;
  /** Structured detail from the backend (e.g. readiness violations). */
  result?: unknown;
}

const baseQuery: BaseQueryFn<ApiQueryArgs, unknown, ApiQueryError> = async ({
  url,
  ...options
}) => {
  try {
    return { data: await apiRequest<unknown>(url, options) };
  } catch (e) {
    if (e instanceof ApiError)
      return {
        error: {
          status: e.status,
          message: e.message,
          code: e.code,
          result: e.result,
        },
      };
    return {
      error: {
        status: 0,
        message: e instanceof Error ? e.message : "Unexpected error",
      },
    };
  }
};

const idem = (key: string) => ({ "Idempotency-Key": key });
const bookingUrl = (bookingId: string, rest = "") =>
  `/api/me/bookings/${encodeURIComponent(bookingId)}${rest}`;

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: [
    "Booking",
    "MyBookings",
    "Profile",
    "AdminMovies",
    "AdminMovie",
    "Showtimes",
    "Accounts",
    "Plans",
    "Runs",
    "PriceBook",
    "Catalogue",
  ],
  endpoints: (build) => ({
    // ── Catalogue (public) ──────────────────────────────────────────────────
    getClusters: build.query<Cluster[], void>({
      query: () => ({ url: "/api/public/cinemas", anonymous: true }),
      transformResponse: (res: Cluster[]) =>
        (res ?? []).filter((c) => c.status === "ACTIVE"),
    }),
    getPublicMovies: build.query<PublicMovie[], number | undefined>({
      query: (clusterId) => ({
        url: "/api/public/movies",
        params: { clusterId },
        anonymous: true,
      }),
      transformResponse: (res: PublicMovie[]) => res ?? [],
      providesTags: ["Catalogue"],
    }),
    getPublicMovie: build.query<
      PublicMovie,
      { movieId: number; clusterId?: number }
    >({
      query: ({ movieId, clusterId }) => ({
        url: `/api/public/movies/${movieId}`,
        params: { clusterId },
        anonymous: true,
      }),
      providesTags: ["Catalogue"],
    }),
    getShowtimesByMovie: build.query<
      Showtime[],
      { movieId: number; date?: string; clusterId?: number }
    >({
      query: ({ movieId, date, clusterId }) => ({
        url: `/api/public/movies/${movieId}/showtimes`,
        params: { date, clusterId },
        anonymous: true,
      }),
      transformResponse: (res: Showtime[]) => res ?? [],
      providesTags: ["Catalogue"],
    }),
    getShowtime: build.query<Showtime, number>({
      query: (showtimeId) => ({
        url: `/api/public/showtimes/${showtimeId}`,
        anonymous: true,
      }),
    }),

    // ── Seats & booking ─────────────────────────────────────────────────────
    getSeatMap: build.query<ShowtimeSeatMap, number>({
      query: (showtimeId) => ({
        url: `/api/public/showtimes/${showtimeId}/seats`,
      }),
    }),
    getSeatHoldPolicy: build.query<SeatHoldPolicy, void>({
      query: () => ({
        url: "/api/public/booking-policy",
        headers: { "X-Booking-Channel": BOOKING_CHANNEL },
        anonymous: true,
      }),
    }),
    createBooking: build.mutation<
      BookingConfirmation,
      { showtimeId: number; seatIds: number[]; idempotencyKey: string }
    >({
      query: ({ idempotencyKey, ...body }) => ({
        url: "/api/me/bookings",
        method: "POST",
        body,
        headers: {
          ...idem(idempotencyKey),
          "X-Booking-Channel": BOOKING_CHANNEL,
        },
      }),
      invalidatesTags: ["MyBookings"],
    }),
    getBooking: build.query<BookingDetail, string>({
      query: (bookingId) => ({ url: bookingUrl(bookingId) }),
      providesTags: (_r, _e, id) => [{ type: "Booking", id }],
    }),
    getMyBookings: build.query<
      BookingPage,
      {
        scope?: "upcoming" | "watched" | "pending";
        page?: number;
        size?: number;
      }
    >({
      query: ({ scope, page = 0, size = 10 }) => ({
        url: "/api/me/bookings",
        params: { scope, page, size },
      }),
      providesTags: ["MyBookings"],
    }),

    // ── Concessions & promotions ────────────────────────────────────────────
    getConcessionCatalog: build.query<
      CatalogConcession[],
      { clusterId: number; showtimeId?: number }
    >({
      query: ({ clusterId }) => ({
        url: `/api/public/cinemas/${clusterId}/concessions`,
        anonymous: true,
      }),
      transformResponse: (res: CatalogConcession[]) => res ?? [],
    }),
    attachConcessions: build.mutation<
      BookingDetail,
      { bookingId: string; items: ConcessionCartItem[]; idempotencyKey: string }
    >({
      query: ({ bookingId, items, idempotencyKey }) => ({
        url: bookingUrl(bookingId, "/concessions"),
        method: "PUT",
        body: { items },
        headers: idem(idempotencyKey),
      }),
      invalidatesTags: (_r, _e, { bookingId }) => [
        { type: "Booking", id: bookingId },
      ],
    }),
    getPublicOffers: build.query<PublicPromotionOffer[], void>({
      query: () => ({ url: "/api/public/promotions", anonymous: true }),
      transformResponse: (res: PublicPromotionOffer[]) => res ?? [],
    }),
    getPromotionOptions: build.query<PromotionOption[], string>({
      query: (bookingId) => ({
        url: bookingUrl(bookingId, "/promotion-options"),
      }),
      transformResponse: (res: PromotionOption[]) => res ?? [],
      providesTags: (_r, _e, id) => [{ type: "Booking", id }],
    }),
    applyPromotion: build.mutation<
      BookingDetail,
      { bookingId: string; promotionCode: string; idempotencyKey: string }
    >({
      query: ({ bookingId, promotionCode, idempotencyKey }) => ({
        url: bookingUrl(bookingId, "/promotion"),
        method: "PUT",
        body: { promotionCode },
        headers: idem(idempotencyKey),
      }),
      invalidatesTags: (_r, _e, { bookingId }) => [
        { type: "Booking", id: bookingId },
      ],
    }),
    removePromotion: build.mutation<BookingDetail, string>({
      query: (bookingId) => ({
        url: bookingUrl(bookingId, "/promotion"),
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, bookingId) => [
        { type: "Booking", id: bookingId },
      ],
    }),

    // ── Payment ─────────────────────────────────────────────────────────────
    createPaymentSession: build.mutation<
      PaymentSession,
      { bookingId: string; idempotencyKey: string; returnUrl?: string }
    >({
      query: ({ bookingId, idempotencyKey, returnUrl }) => ({
        url: bookingUrl(bookingId, "/payment"),
        method: "POST",
        body: { returnUrl },
        headers: idem(idempotencyKey),
      }),
    }),
    getPaymentByBooking: build.query<PaymentSession, string>({
      query: (bookingId) => ({ url: bookingUrl(bookingId, "/payment") }),
    }),

    // ── Account ─────────────────────────────────────────────────────────────
    getMyAccount: build.query<Account, void>({
      query: () => ({ url: "/api/me" }),
      providesTags: ["Profile"],
    }),
    getProfile: build.query<UserProfile, string | void>({
      query: () => ({ url: "/api/me/profile" }),
      providesTags: ["Profile"],
    }),
    updateProfile: build.mutation<
      UserProfile,
      { accountId?: string; body: Record<string, unknown> }
    >({
      query: ({ body }) => ({ url: "/api/me/profile", method: "PUT", body }),
      invalidatesTags: ["Profile"],
    }),

    // ── AI quick booking ────────────────────────────────────────────────────
    getQuickBookingSuggestions: build.mutation<
      QuickBookingResult,
      { message: string; clusterId: number; date?: string; partySize?: number }
    >({
      query: (body) => ({
        url: "/api/me/assistant/suggestions",
        method: "POST",
        body,
        timeoutMs: 30_000,
      }),
    }),
    quickBook: build.mutation<
      BookingConfirmation,
      {
        showtimeId: number;
        seatIds: number[];
        concessions: ConcessionCartItem[];
        idempotencyKey: string;
      }
    >({
      query: ({ idempotencyKey, ...body }) => ({
        url: "/api/me/assistant/bookings",
        method: "POST",
        body,
        headers: idem(idempotencyKey),
      }),
      invalidatesTags: ["MyBookings"],
    }),

    // ── Admin: movies ───────────────────────────────────────────────────────
    getTmdbList: build.query<
      TmdbSearchItem[],
      { kind: "now-playing" | "upcoming" | "search"; page: number; q?: string }
    >({
      query: ({ kind, page, q }) =>
        kind === "search"
          ? { url: "/api/admin/tmdb/movies", params: { q } }
          : { url: "/api/admin/tmdb/movies", params: { list: kind, page } },
      transformResponse: (res: TmdbSearchItem[]) => res ?? [],
      // Infinite list: pages of the same tab/query are appended into one cache entry.
      serializeQueryArgs: ({ queryArgs }) =>
        `${queryArgs.kind}|${queryArgs.q ?? ""}`,
      merge: (cache, incoming, { arg }) => {
        if (arg.page <= 1) return incoming;
        const seen = new Set(cache.map((i) => i.tmdbId));
        cache.push(...incoming.filter((i) => !seen.has(i.tmdbId)));
        return cache;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.page !== previousArg?.page,
      providesTags: ["AdminMovies"],
    }),
    getTmdbDetails: build.query<TmdbMovieDetails, number>({
      query: (tmdbId) => ({ url: `/api/admin/tmdb/movies/${tmdbId}` }),
    }),
    importTmdbMovie: build.mutation<AdminMovie, { tmdbId: number }>({
      query: (body) => ({
        url: "/api/admin/tmdb/imports",
        method: "POST",
        body,
      }),
      invalidatesTags: ["AdminMovies"],
    }),
    getAdminMovies: build.query<AdminMovie[], MovieStatus | void>({
      query: (status) => ({
        url: "/api/admin/movies",
        params: { status: status || undefined },
      }),
      transformResponse: (res: AdminMovie[]) => res ?? [],
      providesTags: ["AdminMovies"],
    }),
    getAdminMovie: build.query<AdminMovie, number>({
      query: (id) => ({ url: `/api/admin/movies/${id}` }),
      providesTags: (_r, _e, id) => [{ type: "AdminMovie", id }],
    }),
    updateMovie: build.mutation<
      AdminMovie,
      {
        movieId: number;
        title?: string;
        synopsis?: string;
        tagline?: string;
        durationMinutes?: number;
        releaseDate?: string;
        ageRatingCode?: AgeRatingCode;
        trailerUrl?: string | null;
        formats?: string[];
        priorityOverride?: number | null;
      }
    >({
      query: ({ movieId, ...body }) => ({
        url: `/api/admin/movies/${movieId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { movieId }) => [
        { type: "AdminMovie", id: movieId },
        "AdminMovies",
      ],
    }),
    approveMovie: build.mutation<AdminMovie, number>({
      query: (movieId) => ({
        url: `/api/admin/movies/${movieId}/approve`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, movieId) => [
        { type: "AdminMovie", id: movieId },
        "AdminMovies",
      ],
    }),
    archiveMovie: build.mutation<AdminMovie, number>({
      query: (movieId) => ({
        url: `/api/admin/movies/${movieId}/archive`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, movieId) => [
        { type: "AdminMovie", id: movieId },
        "AdminMovies",
        "Plans",
        "Showtimes",
        "Catalogue",
      ],
    }),

    // ── Admin: release plans ────────────────────────────────────────────────
    getReleasePlans: build.query<
      ReleasePlan[],
      { clusterId?: number; movieId?: number; status?: ReleasePlanStatus }
    >({
      query: (params) => ({ url: "/api/admin/release-plans", params }),
      transformResponse: (res: ReleasePlan[]) => res ?? [],
      providesTags: ["Plans"],
    }),
    createReleasePlans: build.mutation<
      {
        created: ReleasePlan[];
        skipped: { clusterId: number; clusterName: string; reason: string }[];
      },
      {
        movieId: number;
        clusterIds: number[];
        showingStartDate: string;
        showingEndDate?: string;
        status: "PLANNED" | "OPEN";
        note?: string;
      }
    >({
      query: (body) => ({
        url: "/api/admin/release-plans",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Plans", "AdminMovies", "Catalogue"],
    }),
    updateReleasePlan: build.mutation<
      ReleasePlan & { suspendedShowtimes: number },
      {
        planId: number;
        status?: ReleasePlanStatus;
        showingStartDate?: string;
        showingEndDate?: string | null;
        note?: string;
      }
    >({
      query: ({ planId, ...body }) => ({
        url: `/api/admin/release-plans/${planId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Plans", "AdminMovies", "Showtimes", "Catalogue"],
    }),
    deleteReleasePlan: build.mutation<unknown, number>({
      query: (planId) => ({
        url: `/api/admin/release-plans/${planId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Plans", "AdminMovies"],
    }),

    // ── Admin: automatic scheduling ─────────────────────────────────────────
    getSchedulingRuns: build.query<SchedulingRunSummary[], void>({
      query: () => ({ url: "/api/admin/scheduling-runs" }),
      transformResponse: (res: SchedulingRunSummary[]) => res ?? [],
      providesTags: ["Runs"],
    }),
    getSchedulingRun: build.query<SchedulingRunDetail, number>({
      query: (runId) => ({ url: `/api/admin/scheduling-runs/${runId}` }),
      providesTags: (_r, _e, id) => [{ type: "Runs", id }],
    }),
    runScheduling: build.mutation<
      SchedulingRunDetail,
      {
        startDate: string;
        endDate: string;
        clusterIds: number[];
        movieIds: number[];
        publish: boolean;
      }
    >({
      query: (body) => ({
        url: "/api/admin/scheduling-runs",
        method: "POST",
        body,
        timeoutMs: 60_000,
      }),
      invalidatesTags: ["Runs", "Showtimes", "AdminMovies", "Catalogue"],
    }),
    publishSchedulingRun: build.mutation<SchedulingRunDetail, number>({
      query: (runId) => ({
        url: `/api/admin/scheduling-runs/${runId}/publish`,
        method: "POST",
      }),
      invalidatesTags: ["Runs", "Showtimes", "AdminMovies", "Catalogue"],
    }),
    discardSchedulingRun: build.mutation<SchedulingRunDetail, number>({
      query: (runId) => ({
        url: `/api/admin/scheduling-runs/${runId}/discard`,
        method: "POST",
      }),
      invalidatesTags: ["Runs", "Showtimes"],
    }),

    // ── Admin: cinemas, showtimes & prices ──────────────────────────────────
    getAdminClusters: build.query<Cluster[], void>({
      query: () => ({ url: "/api/admin/cinemas" }),
      transformResponse: (res: Cluster[]) => res ?? [],
    }),
    getAdminShowtimes: build.query<
      AdminShowtime[],
      { date: string; clusterId?: number }
    >({
      query: (params) => ({ url: "/api/admin/showtimes", params }),
      transformResponse: (res: AdminShowtime[]) => res ?? [],
      providesTags: ["Showtimes"],
    }),
    bulkShowtimeStatus: build.mutation<
      BulkStatusResult,
      { showtimeIds: number[]; status: "ON_SALE" | "SUSPENDED" | "CANCELLED" }
    >({
      query: (body) => ({
        url: "/api/admin/showtimes/status",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Showtimes", "Catalogue", "AdminMovies"],
    }),
    getPriceBook: build.query<PriceBook, number>({
      query: (clusterId) => ({ url: `/api/admin/price-books/${clusterId}` }),
      providesTags: (_r, _e, id) => [{ type: "PriceBook", id }],
    }),
    updatePriceBook: build.mutation<
      PriceBook,
      {
        clusterId: number;
        rates: PriceRate[];
        seatMultipliers: PriceBook["seatMultipliers"];
      }
    >({
      query: ({ clusterId, ...body }) => ({
        url: `/api/admin/price-books/${clusterId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_r, _e, { clusterId }) => [
        { type: "PriceBook", id: clusterId },
      ],
    }),

    // ── Admin: bookings & customer accounts ─────────────────────────────────
    getAllBookings: build.query<
      BookingPage,
      { page?: number; status?: string; q?: string; clusterId?: number }
    >({
      query: ({ page = 0, status, q, clusterId }) => ({
        url: "/api/admin/bookings",
        params: { page, size: 20, status, q, clusterId },
      }),
      providesTags: ["MyBookings"],
    }),
    searchAccounts: build.query<
      AccountPage,
      { query?: string; status?: string; page?: number }
    >({
      query: ({ query, status, page = 1 }) => ({
        url: "/api/admin/customers",
        params: { query, status, page, size: 20 },
      }),
      providesTags: ["Accounts"],
    }),
    getAccount: build.query<Account, string>({
      query: (id) => ({
        url: `/api/admin/customers/${encodeURIComponent(id)}`,
      }),
      providesTags: ["Accounts"],
    }),
    setAccountStatus: build.mutation<
      Account,
      { id: string; status: "ACTIVE" | "INACTIVE" }
    >({
      query: ({ id, status }) => ({
        url: `/api/admin/customers/${encodeURIComponent(id)}`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["Accounts"],
    }),
    revokeSessions: build.mutation<unknown, string>({
      query: (id) => ({
        url: `/api/admin/customers/${encodeURIComponent(id)}/sessions`,
        method: "DELETE",
      }),
    }),

    register: build.mutation<
      unknown,
      { username: string; email: string; password: string }
    >({
      query: (body) => ({
        url: "/api/auth/register",
        method: "POST",
        body,
        anonymous: true,
      }),
    }),
  }),
});

export const {
  useGetClustersQuery,
  useGetPublicMoviesQuery,
  useGetPublicMovieQuery,
  useGetShowtimesByMovieQuery,
  useGetShowtimeQuery,
  useGetSeatMapQuery,
  useLazyGetSeatMapQuery,
  useGetSeatHoldPolicyQuery,
  useCreateBookingMutation,
  useGetBookingQuery,
  useGetMyBookingsQuery,
  useGetConcessionCatalogQuery,
  useAttachConcessionsMutation,
  useGetPublicOffersQuery,
  useGetPromotionOptionsQuery,
  useApplyPromotionMutation,
  useRemovePromotionMutation,
  useCreatePaymentSessionMutation,
  useLazyGetPaymentByBookingQuery,
  useGetMyAccountQuery,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetQuickBookingSuggestionsMutation,
  useQuickBookMutation,
  useGetTmdbListQuery,
  useGetTmdbDetailsQuery,
  useImportTmdbMovieMutation,
  useGetAdminMoviesQuery,
  useGetAdminMovieQuery,
  useUpdateMovieMutation,
  useApproveMovieMutation,
  useArchiveMovieMutation,
  useGetReleasePlansQuery,
  useCreateReleasePlansMutation,
  useUpdateReleasePlanMutation,
  useDeleteReleasePlanMutation,
  useGetSchedulingRunsQuery,
  useGetSchedulingRunQuery,
  useRunSchedulingMutation,
  usePublishSchedulingRunMutation,
  useDiscardSchedulingRunMutation,
  useGetAdminClustersQuery,
  useGetAdminShowtimesQuery,
  useBulkShowtimeStatusMutation,
  useGetPriceBookQuery,
  useUpdatePriceBookMutation,
  useGetAllBookingsQuery,
  useSearchAccountsQuery,
  useGetAccountQuery,
  useSetAccountStatusMutation,
  useRevokeSessionsMutation,
  useRegisterMutation,
} = api;

/** Message to show for an RTK Query error object. */
export const queryErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  const e = error as Partial<ApiQueryError> | undefined;
  if (e && typeof e.message === "string") return e.message || fallback;
  return fallback;
};
