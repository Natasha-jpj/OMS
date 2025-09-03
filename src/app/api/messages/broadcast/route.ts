import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import BroadcastMessage from '@/models/BroadcastMessage';
import Employee from '@/models/Employee';

// 🔐 Extract userId from JWT token in cookies
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

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // 🔐 Authenticate user
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 📦 Parse and validate payload
    const payload = await req.json();
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();
    const urgent = !!payload.urgent;

    if (!subject || !body) {
      return NextResponse.json(
        { success: false, error: 'Subject and body are required' },
        { status: 400 }
      );
    }

    // 👥 Get all employee IDs as recipients
    const allEmployees = await Employee.find({}, { _id: 1 }).lean();
    const recipients = allEmployees.map((e: any) => e._id);

    // 📤 Create broadcast message
    await BroadcastMessage.create({
      subject,
      body,
      urgent,
      createdBy: userId,
      recipients,
    });

    // (Optional) Insert Notification docs per user here

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/messages/broadcast - Error:', e.stack || e.message);
    return NextResponse.json(
      { success: false, error: e.message || 'Failed to send' },
      { status: 500 }
    );
  }
}