import { Platform } from 'react-native';

// Android emulator reaches the host machine through 10.0.2.2.
const DEFAULT_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');


/** Support contacts shown on the account tab (placeholders until the real ones are known). */
export const SUPPORT_HOTLINE = '1900 2224';
export const SUPPORT_EMAIL = 'hotro@cineprime.vn';

/**
 * Membership tier is mocked: every customer is a "Member" until the loyalty service
 * (/api/membership) is wired into the app.
 */
export const MOCK_MEMBER_TIER = 'Member';

/** Backend keys seat-hold TTL and policy by booking channel. */
export const BOOKING_CHANNEL = 'MOBILE';

