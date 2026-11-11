import { requireEnv } from './env';
import { HttpError } from './http';
import type { MovieDoc } from './models';

// api.tmdb.org is TMDB's alias of api.themoviedb.org. Some Vietnamese ISPs reset connections to the latter.
const BASE = (process.env.TMDB_API_BASE || 'https://api.tmdb.org/3').replace(/\/+$/, '');
const IMG = 'https://image.tmdb.org/t/p';

export interface TmdbListItem {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
}

/** One page of TMDB's now-playing / upcoming list for Vietnam, or of a title search. */
export async function tmdbPage(kind: 'now_playing' | 'upcoming' | 'search', page: number, query?: string): Promise<TmdbListItem[]> {
  const data =
    kind === 'search'
      ? await tmdb<{ results: TmdbListItem[] }>('/search/movie', { query: query ?? '', language: 'vi-VN', page, include_adult: 'false' })
      : await tmdb<{ results: TmdbListItem[] }>(`/movie/${kind}`, { region: 'VN', language: 'vi-VN', page });
  return data.results ?? [];
}

async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', requireEnv('TMDB_API_KEY'));
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    console.error('[tmdb] fetch failed', path, e, (e as { cause?: unknown }).cause);
    throw new HttpError(502, 'Không kết nối được TMDB. Kiểm tra mạng và thử lại.');
  }
  if (res.status === 401) throw new HttpError(502, 'TMDB_API_KEY không hợp lệ.');
  if (!res.ok) throw new HttpError(502, `TMDB trả về lỗi ${res.status}.`);
  return (await res.json()) as T;
}

/** Newest first. `kind` follows TMDB's own lists for Vietnam. */
export async function listTmdb(kind: 'now_playing' | 'upcoming', pages = 2): Promise<TmdbListItem[]> {
  const items: TmdbListItem[] = [];
  for (let page = 1; page <= pages; page++) {
    const data = await tmdb<{ results: TmdbListItem[] }>(`/movie/${kind}`, { region: 'VN', language: 'vi-VN', page });
    items.push(...(data.results ?? []));
  }
  const seen = new Set<number>();
  return items
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
}

interface TmdbDetail {
  id: number;
  title: string;
  original_title: string;
  original_language?: string;
  overview?: string;
  tagline?: string;
  runtime?: number | null;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { id: number; name: string }[];
  production_countries?: { iso_3166_1: string }[];
  credits?: {
    cast?: { id: number; name: string; character?: string; profile_path?: string | null; order?: number }[];
    crew?: { id: number; name: string; job?: string; profile_path?: string | null }[];
  };
  videos?: { results?: { key: string; site: string; type: string; official?: boolean; iso_639_1?: string }[] };
  release_dates?: {
    results?: { iso_3166_1: string; release_dates: { certification?: string; type: number; release_date: string }[] }[];
  };
}

const VN_RATINGS: Record<string, number> = { P: 0, K: 0, T13: 13, T16: 16, T18: 18, C: 18 };
const US_TO_VN: Record<string, string> = { G: 'P', PG: 'P', 'PG-13': 'T13', R: 'T18', 'NC-17': 'T18' };

function ageRatingOf(detail: TmdbDetail): { ratingCode: string; minAge: number } {
  const certOf = (country: string) =>
    detail.release_dates?.results
      ?.find((r) => r.iso_3166_1 === country)
      ?.release_dates.map((d) => (d.certification ?? '').trim().toUpperCase())
      .find(Boolean);
  const vn = certOf('VN');
  if (vn && vn in VN_RATINGS) return { ratingCode: vn === 'C' ? 'C18' : vn, minAge: VN_RATINGS[vn] };
  const us = certOf('US');
  const mapped = us ? US_TO_VN[us] : undefined;
  const code = mapped ?? 'T13';
  return { ratingCode: code, minAge: VN_RATINGS[code] };
}

/** Theatrical release in Vietnam when TMDB knows it, otherwise the global date. */
function releaseDateOf(detail: TmdbDetail): string | undefined {
  const vn = detail.release_dates?.results?.find((r) => r.iso_3166_1 === 'VN');
  const theatrical = vn?.release_dates.filter((d) => d.type === 3 || d.type === 2).map((d) => d.release_date.slice(0, 10)).sort()[0];
  return theatrical || detail.release_date || undefined;
}

function trailerOf(detail: TmdbDetail): string | undefined {
  const videos = (detail.videos?.results ?? []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const best = videos.find((v) => v.iso_639_1 === 'vi') ?? videos.find((v) => v.official) ?? videos[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : undefined;
}

function countryNames(detail: TmdbDetail): string | undefined {
  const names = new Intl.DisplayNames(['vi'], { type: 'region' });
  const list = (detail.production_countries ?? []).map((c) => names.of(c.iso_3166_1) ?? c.iso_3166_1);
  return list.length ? list.slice(0, 2).join(', ') : undefined;
}

/**
 * TMDB popularity (open ended, usually 1–1000) mapped to the 0..100 demand score the scheduler uses,
 * with a small boost for well-rated movies.
 */
export function popularityOf(detail: Pick<TmdbDetail, 'popularity' | 'vote_average' | 'vote_count'>): number {
  const pop = Math.min(80, Math.log10((detail.popularity ?? 0) + 1) * 30);
  const rating = (detail.vote_count ?? 0) >= 20 ? ((detail.vote_average ?? 0) / 10) * 20 : 10;
  return Math.round(Math.min(100, Math.max(5, pop + rating)));
}

/** Fetches a movie in Vietnamese (falling back to English text) and maps it to our movie document shape. */
export async function fetchMovieDoc(tmdbId: number): Promise<Omit<MovieDoc, '_id' | 'status' | 'createdAt'>> {
  const params = { language: 'vi-VN', append_to_response: 'credits,videos,release_dates', include_video_language: 'vi,en,null' };
  const detail = await tmdb<TmdbDetail>(`/movie/${tmdbId}`, params);
  let overview = detail.overview?.trim() ?? '';
  let tagline = detail.tagline?.trim() ?? '';
  if (!overview) {
    const en = await tmdb<TmdbDetail>(`/movie/${tmdbId}`, { language: 'en-US' });
    overview = en.overview?.trim() ?? '';
    tagline = tagline || en.tagline?.trim() || '';
  }

  const cast = [
    ...(detail.credits?.crew ?? [])
      .filter((c) => c.job === 'Director')
      .slice(0, 2)
      .map((c, i) => ({ personId: c.id, fullName: c.name, photoUrl: c.profile_path ? `${IMG}/w185${c.profile_path}` : undefined, roleType: 'DIRECTOR', billingOrder: i })),
    ...(detail.credits?.cast ?? [])
      .slice(0, 12)
      .map((c, i) => ({
        personId: c.id,
        fullName: c.name,
        photoUrl: c.profile_path ? `${IMG}/w185${c.profile_path}` : undefined,
        roleType: 'ACTOR',
        characterName: c.character || undefined,
        billingOrder: c.order ?? i,
      })),
  ];

  return {
    tmdbId: detail.id,
    originalTitle: detail.original_title || detail.title,
    title: detail.title || detail.original_title,
    translations: [{ languageCode: 'vi', title: detail.title, synopsis: overview || undefined, tagline: tagline || undefined }],
    synopsis: overview || undefined,
    tagline: tagline || undefined,
    durationMinutes: detail.runtime || undefined,
    releaseDate: releaseDateOf(detail),
    posterUrl: detail.poster_path ? `${IMG}/w500${detail.poster_path}` : undefined,
    thumbnailUrl: detail.poster_path ? `${IMG}/w342${detail.poster_path}` : undefined,
    backdropUrl: detail.backdrop_path ? `${IMG}/w1280${detail.backdrop_path}` : undefined,
    trailerUrl: trailerOf(detail),
    country: countryNames(detail),
    originalLanguage: detail.original_language,
    genres: (detail.genres ?? []).map((g) => ({ genreId: g.id, name: g.name })),
    ageRating: ageRatingOf(detail),
    cast,
    popularityScore: popularityOf(detail),
  };
}
