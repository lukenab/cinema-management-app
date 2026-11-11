import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const POLL_MS = 5_000;

/**
 * Keeps a seat map current while the screen is open: reloads every few seconds and again
 * whenever the app returns to the foreground. The REST seat map stays the only source of truth.
 */
export function useSeatMapRefresh(enabled: boolean, reload: () => void): void {
  const callback = useRef(reload);
  useEffect(() => {
    callback.current = reload;
  });

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') callback.current();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') callback.current();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled]);
}
