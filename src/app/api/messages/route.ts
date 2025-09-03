import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BroadcastMessage from '@/models/BroadcastMessage';
import Employee from '@/models/Employee';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const userId = req.headers.get('x-user-id'); // keep same pattern
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Optional: verify user exists (and could be admin later)
    const admin = await Employee.findById(userId).lean();
    if (!admin) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const messages = await BroadcastMessage.find({})
      .sort({ createdAt: -1 })
      .lean();

    // attach some helpful computed fields
    const withMeta = messages.map((m:any) => ({
      _id: String(m._id),
      subject: m.subject,
      body: m.body,
      urgent: !!m.urgent,
      createdAt: m.createdAt,
      createdByName: m.createdBy ? undefined : 'Admin',
      recipientCount: Array.isArray(m.recipients) ? m.recipients.length : undefined,
    }));

    return NextResponse.json({ messages: withMeta }, { status: 200 });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to load messages' }, { status: 500 });
  }
}
