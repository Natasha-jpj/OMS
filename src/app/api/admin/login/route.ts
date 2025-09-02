import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });

    const res = NextResponse.json({ success: true });
    res.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return res;
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
