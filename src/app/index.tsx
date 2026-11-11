import { Redirect } from 'expo-router';

import { areaForUser } from '@/lib/jwt';
import { useAppSelector } from '@/store';

/** Entry point: send each session to its own area. */
export default function Index() {
  const status = useAppSelector((s) => s.auth.status);
  const user = useAppSelector((s) => s.auth.user);
  const area = status === 'signedIn' ? areaForUser(user) : 'customer';

  if (area === 'admin') return <Redirect href="/admin" />;
  if (area === 'unsupported') return <Redirect href="/unsupported" />;
  return <Redirect href="/home" />;
}
