import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import { setAuthHandlers } from '@/lib/apiClient';

import { api } from './api';
import authReducer, { sessionExpired, tokenRefreshed } from './authSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

// apiClient refreshes tokens on its own; mirror the outcome into Redux.
setAuthHandlers({
  onTokenRefreshed: (token) => store.dispatch(tokenRefreshed(token)),
  onSessionExpired: () => {
    store.dispatch(sessionExpired());
    store.dispatch(api.util.resetApiState());
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
