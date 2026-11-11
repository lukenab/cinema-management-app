import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Provider } from 'react-redux';

import { areaForUser } from '@/lib/jwt';
import { bootstrapSession } from '@/store/authSlice';
import { store, useAppDispatch, useAppSelector } from '@/store';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

function SessionGate() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    dispatch(bootstrapSession());
  }, [dispatch]);

  const ready = status !== 'loading';
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = status === 'signedIn';
  const area = areaForUser(user);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        {/* "/" decides where to go from the current session. */}
        <Stack.Screen name="index" />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        {/* Guests may browse the catalogue; booking screens ask them to sign in. */}
        <Stack.Protected guard={!signedIn || area === 'customer'}>
          <Stack.Screen name="(customer)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && area === 'admin'}>
          <Stack.Screen name="admin" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && area === 'unsupported'}>
          <Stack.Screen name="unsupported" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SessionGate />
    </Provider>
  );
}
