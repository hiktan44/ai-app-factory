// ============================================================
// Server-side Supabase Client Helper
// ============================================================
// 
// Creates a Supabase client for use in server components,
// API routes, and middleware with proper session handling.
// ------------------------------------------------------------

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // In server components, we can't set cookies
            // This is handled by the middleware
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // In server components, we can't remove cookies
          }
        },
      },
    }
  );
}

// For use in middleware (requires request object)
export function createMiddlewareClient(request: Request) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookieHeader = request.headers.get('cookie') ?? '';
          const cookies = Object.fromEntries(
            cookieHeader.split('; ').map((c) => c.split('='))
          );
          return cookies[name];
        },
        set() {
          // Cookies are set via the response
          // Handled in middleware
        },
        remove() {
          // Cookies are removed via the response
          // Handled in middleware
        },
      },
    }
  );
}
