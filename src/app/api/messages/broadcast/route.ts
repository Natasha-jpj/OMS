import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import BroadcastMessage from '@/models/BroadcastMessage';
import Employee from '@/models/Employee';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_me';

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return { ok: false as const, error: 'Unauthorized' };
  try {
    const p = jwt.verify(token, JWT_SECRET) as { role: string; username: string };
    if (p?.role !== 'Admin') return { ok: false as const, error: 'Forbidden' };
    return { ok: true as const, username: p.username };
  } catch {
    return { ok: false as const, error: 'Invalid token' };
  }
}

export async function POST(req: NextRequest) {
  // 🔐 admin only
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    await dbConnect();

    const { subject = '', body = '', urgent = false } = await req.json();
    const subj = String(subject).trim();
    const msg  = String(body).trim();
    if (!subj || !msg) {
      return NextResponse.json({ success: false, error: 'Subject and body are required' }, { status: 400 });
    }

    // recipients = all employees
    const all = await Employee.find({}, { _id: 1 }).lean();
    const recipients = all.map((e: any) => e._id);

    await BroadcastMessage.create({
      subject: subj,
      body: msg,
      urgent: !!urgent,
      createdByName: auth.username ?? 'Admin', // optional metadata
      recipients,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/messages/broadcast error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Failed to send' }, { status: 500 });
  }
}
