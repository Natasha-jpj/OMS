import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BroadcastMessage from '@/models/BroadcastMessage';
import Employee from '@/models/Employee';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();
    const urgent = !!payload.urgent;

    if (!subject || !body) {
      return NextResponse.json({ success: false, error: 'Subject and body are required' }, { status: 400 });
    }

    // Get all employee IDs as recipients
    const allEmployees = await Employee.find({}, { _id: 1 }).lean();
    const recipients = allEmployees.map((e:any) => e._id);

    await BroadcastMessage.create({
      subject,
      body,
      urgent,
      createdBy: userId,
      recipients,
    });

    // (Optional) You could also insert Notification docs per user here.

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e:any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to send' }, { status: 500 });
  }
}
