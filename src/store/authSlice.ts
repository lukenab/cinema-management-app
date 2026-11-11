import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { apiRequest, setAccessToken } from '@/lib/apiClient';
import { isTokenExpired, userFromToken, type SessionUser } from '@/lib/jwt';
import { secureStorage } from '@/lib/secureStorage';

import { api } from './api';

export interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  token: string | null;
  user: SessionUser | null;
}

const initialState: AuthState = { status: 'loading', token: null, user: null };

export const bootstrapSession = createAsyncThunk('auth/bootstrap', async () => {
  const token = await secureStorage.getToken();
  if (!token) return null;
  // An expired token can still be rotated by the first API call; keep it only if it decodes.
  if (isTokenExpired(token, 0) && !userFromToken(token)) {
    await secureStorage.clearToken();
    return null;
  }
  setAccessToken(token);
  return token;
});

export const signIn = createAsyncThunk('auth/signIn', async (credentials: { username: string; password: string }) => {
  const result = await apiRequest<{ token?: string }>('/api/auth/login', {
    method: 'POST',
    body: credentials,
    anonymous: true,
  });
  const token = result?.token;
  if (!token || !userFromToken(token)) throw new Error('Login failed: the server returned no valid token.');
  setAccessToken(token);
  await secureStorage.setToken(token);
  return token;
});

export const signOut = createAsyncThunk('auth/signOut', async (_: void, { getState, dispatch }) => {
  const token = (getState() as { auth: AuthState }).auth.token;
  if (token) {
    // Best effort: the local session is cleared even if the server call fails.
    apiRequest('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  setAccessToken(null);
  await secureStorage.clearToken();
  dispatch(api.util.resetApiState());
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    tokenRefreshed(state, action: PayloadAction<string>) {
      state.token = action.payload;
      state.user = userFromToken(action.payload) ?? state.user;
    },
    sessionExpired(state) {
      state.status = 'signedOut';
      state.token = null;
      state.user = null;
      setAccessToken(null);
      void secureStorage.clearToken();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        const user = action.payload ? userFromToken(action.payload) : null;
        state.status = user ? 'signedIn' : 'signedOut';
        state.token = user ? action.payload : null;
        state.user = user;
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.status = 'signedOut';
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.status = 'signedIn';
        state.token = action.payload;
        state.user = userFromToken(action.payload);
      })
      .addCase(signOut.fulfilled, (state) => {
        state.status = 'signedOut';
        state.token = null;
        state.user = null;
      });
  },
});

export const { tokenRefreshed, sessionExpired } = authSlice.actions;
export default authSlice.reducer;
