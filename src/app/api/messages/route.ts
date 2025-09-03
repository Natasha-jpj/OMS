import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import BroadcastMessage from '@/models/BroadcastMessage';
import Employee from '@/models/Employee';

// 🔐 Extract userId from JWT token stored in cookies
function getUserIdFromToken(request: NextRequest): string | null {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // 🔐 Authenticate user
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Verify user exists
    const admin = await Employee.findById(userId).lean();
    if (!admin) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 📦 Fetch broadcast messages
    const messages = await BroadcastMessage.find({})
      .sort({ createdAt: -1 })
      .lean();

    // 🧠 Attach computed metadata
    const withMeta = messages.map((m: any) => ({
      _id: String(m._id),
      subject: m.subject,
      body: m.body,
      urgent: !!m.urgent,
      createdAt: m.createdAt,
      createdByName: m.createdBy ? undefined : 'Admin',
      recipientCount: Array.isArray(m.recipients) ? m.recipients.length : undefined,
    }));

    return NextResponse.json({ messages: withMeta }, { status: 200 });
  } catch (e: any) {
    console.error('GET /api/messages - Error:', e.stack || e.message);
    return NextResponse.json(
      { error: e.message || 'Failed to load messages' },
      { status: 500 }
    );
  }
}