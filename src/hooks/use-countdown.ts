import { useEffect, useState } from "react";

/** Seconds remaining until an ISO timestamp, ticking every second. null when there is no valid target. */
export function useCountdown(target?: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const tick = () => setNow(Date.now());
    const kick = setTimeout(tick, 0); // refresh immediately: `now` may be stale from an earlier render
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
    };
  }, [target]);

  const end = target ? new Date(target).getTime() : Number.NaN;
  return Number.isNaN(end) ? null : Math.max(0, Math.round((end - now) / 1000));
}
