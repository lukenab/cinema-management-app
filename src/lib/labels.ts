import type { AgeRating, BookingStatus, PublicMovie, Showtime } from '@/types/api';

/** Age-rating code such as "T16" (backend sends ratingCode, the mock sends code). */
export const ageRatingCode = (r?: AgeRating | null): string | undefined => r?.ratingCode ?? r?.code;

const viTranslation = (m: PublicMovie) => m.translations?.find((t) => t.languageCode?.toLowerCase().startsWith('vi'));

/** Vietnamese title when the detail payload carries one, otherwise the original title. */
export const movieTitle = (m: PublicMovie): string => viTranslation(m)?.title || m.title || m.originalTitle;
export const movieSynopsis = (m: PublicMovie): string | undefined => viTranslation(m)?.synopsis || m.synopsis;
export const movieTagline = (m: PublicMovie): string | undefined => viTranslation(m)?.tagline || m.tagline;

const LANGUAGE_LABEL: Record<string, string> = {
  vi: 'Tiếng Việt', en: 'Tiếng Anh', ja: 'Tiếng Nhật', ko: 'Tiếng Hàn', zh: 'Tiếng Trung', th: 'Tiếng Thái', fr: 'Tiếng Pháp', hi: 'Tiếng Hindi',
};
export const languageLabel = (code?: string): string | undefined => (code ? (LANGUAGE_LABEL[code.toLowerCase().slice(0, 2)] ?? code.toUpperCase()) : undefined);

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã thanh toán',
  CANCELLED: 'Đã huỷ',
  EXPIRED: 'Hết hạn giữ ghế',
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  CONFIRMED: 'success',
  PENDING_PAYMENT: 'warning',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

/** "2D PHỤ ĐỀ", "IMAX LỒNG TIẾNG" ... built from the showtime's format and language fields. */
export function showtimeFormatLabel(s: Pick<Showtime, 'formatCode' | 'subtitleLanguageCode' | 'audioLanguageCode'>): string {
  const format = (s.formatCode || '2D').toUpperCase();
  const audio = (s.audioLanguageCode || '').toLowerCase();
  const suffix = s.subtitleLanguageCode ? 'PHỤ ĐỀ' : audio.startsWith('vi') ? 'LỒNG TIẾNG' : '';
  return suffix ? `${format} ${suffix}` : format;
}

export const MOVIE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  ARCHIVED: 'Lưu trữ',
};

export const MOVIE_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  DRAFT: 'warning',
  APPROVED: 'success',
  ARCHIVED: 'neutral',
};

export const PLAN_STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Dự kiến',
  OPEN: 'Đang khai thác',
  SUSPENDED: 'Tạm ngưng',
  CLOSED: 'Đã đóng',
};

export const PLAN_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  PLANNED: 'info',
  OPEN: 'success',
  SUSPENDED: 'warning',
  CLOSED: 'neutral',
};

/** Why the scheduler did not create a slot (Java GenerationSkipReason). */
export const SKIP_REASON_LABEL: Record<string, string> = {
  MOVIE_NOT_AVAILABLE: 'Chưa có kế hoạch phát hành mở tại rạp',
  NOT_RELEASED_YET: 'Chưa đến ngày khởi chiếu',
  NO_ELIGIBLE_ROOM: 'Không có phòng hỗ trợ định dạng',
  EXISTING_SHOWTIME_CONFLICT: 'Trùng suất chiếu đã có',
  CLEANUP_BUFFER_CONFLICT: 'Trùng phòng (tính thời gian dọn phòng)',
  MAXIMUM_ROOM_SHARE_REACHED: 'Vượt tỉ lệ phòng chiếu cùng lúc',
  SAME_MOVIE_START_STAGGER_CONFLICT: 'Cùng phim bắt đầu quá sát nhau',
  MAX_DAILY_SHOWS_PER_MOVIE_REACHED: 'Đủ số suất tối đa/ngày',
  MISSING_DEMAND_PROFILE: 'Rạp chưa có hồ sơ nhu cầu',
};

export const SHOWTIME_STATUS_LABEL: Record<string, string> = {
  ON_SALE: 'Đang mở bán',
  SUSPENDED: 'Tạm dừng',
  CANCELLED: 'Đã huỷ',
  SCHEDULED: 'Chưa mở bán',
  COMPLETED: 'Đã chiếu',
};

export const SHOWTIME_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  ON_SALE: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'danger',
  SCHEDULED: 'neutral',
  COMPLETED: 'neutral',
};

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Đã vô hiệu hóa',
};

export const ACCOUNT_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  ACTIVE: 'success',
  INACTIVE: 'danger',
};
