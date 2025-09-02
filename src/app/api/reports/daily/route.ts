// app/api/reports/daily/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date'); // YYYY-MM-DD (UTC)
    if (!dateStr) {
      return NextResponse.json({ error: 'Missing ?date=YYYY-MM-DD' }, { status: 400 });
    }

    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(`${dateStr}T23:59:59.999Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    // Attendance for the day
    const attendance = await Attendance.find({
      timestamp: { $gte: start, $lte: end },
    })
      .populate('employeeId', 'name') // populate employee name
      .sort({ timestamp: 1 })
      .lean();

    // normalize into { _id, employeeId, employeeName, type, timestamp }
   const attendanceData = attendance.map((a: any) => ({
  _id: String(a._id),
  employeeId: a.employeeId?._id ? String(a.employeeId._id) : String(a.employeeId),
  employeeName: a.employeeId?.name || a.employeeName || 'Unknown', // <- make the field
  type: a.type,
  timestamp: a.timestamp,
  imageData: a.imageData,
  createdAt: a.createdAt,
}));

    // Progress for the same day — use the route's supported ?date= param
    const url = new URL(`${req.nextUrl.origin}/api/tasks/progress`);
    url.searchParams.set('date', dateStr); // <-- CHANGE: use date, not start/end
    const progressRes = await fetch(url.toString(), {
      headers: { 'x-user-id': req.headers.get('x-user-id') || '' },
      cache: 'no-store',
    });
    const progressJson = await progressRes.json();

    return NextResponse.json(
      {
        attendance: attendanceData, // <-- RETURN THE NORMALIZED DATA
        progress: Array.isArray(progressJson.updates) ? progressJson.updates : [],
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load daily report' }, { status: 500 });
  }
}
