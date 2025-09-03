// /lib/auth-server.ts
import { cookies } from 'next/headers';

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // Prefer explicit header from client fetches
  const fromHeader = req.headers.get('x-user-id');
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();

  // ✅ Await cookies() because it’s a Promise now
  const store = await cookies();
  const fromCookie = store.get('employeeId')?.value;
  return fromCookie ?? null;
}
