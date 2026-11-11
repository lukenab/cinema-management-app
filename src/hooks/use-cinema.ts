import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useGetClustersQuery } from '@/store/api';

// The cinema the customer is browsing, remembered between launches. Kept outside Redux because it is a
// device preference, not session data, and several screens read it.
const KEY = 'cineprime.cinemaId';
let selected: number | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((v) => {
      const id = Number(v);
      if (v && Number.isInteger(id) && selected === null) {
        selected = id;
        emit();
      }
    })
    .catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => selected;

export function selectCinema(clusterId: number) {
  selected = clusterId;
  emit();
  AsyncStorage.setItem(KEY, String(clusterId)).catch(() => {});
}

/** The cinemas and the one the customer chose (the first cinema until they pick one). */
export function useCinema() {
  useEffect(load, []);
  const chosen = useSyncExternalStore(subscribe, snapshot, snapshot);
  const clusters = useGetClustersQuery();
  const list = clusters.data ?? [];
  const cinema = list.find((c) => c.clusterId === chosen) ?? list[0];
  const setCinema = useCallback((id: number) => selectCinema(id), []);
  return {
    cinemas: list,
    cinema,
    clusterId: cinema?.clusterId,
    setCinema,
    isLoading: clusters.isLoading,
    error: clusters.error,
    refetch: clusters.refetch,
  };
}
