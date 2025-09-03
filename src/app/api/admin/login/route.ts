import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_me';

// we'll verify against your existing public envs for now
const ADMIN_USER = process.env.ADMIN_USERNAME;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
  }

  // create JWT
  const token = jwt.sign({ role: 'Admin', username }, JWT_SECRET, { expiresIn: '1d' });

  // set httpOnly cookie
  const res = NextResponse.json({ success: true });
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });
  return res;
}
