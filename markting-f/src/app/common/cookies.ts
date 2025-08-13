'use server';
import { cookies } from 'next/headers';

const myCookie = async (key: string) => {
  const cookieStore = await cookies();
  return cookieStore.get(key);
};

const setServerCookie = async (
  key: string,
  value: string,
  options?: { maxAge?: number; path?: string }
) => {
  const cookieStore = await cookies();
  cookieStore.set(key, value, {
    path: options?.path || '/',
    maxAge: options?.maxAge || 60 * 60 * 24 * 7, // 7 days default
    httpOnly: false, // Allow client-side access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
};

export { myCookie, setServerCookie };
