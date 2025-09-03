// app/api/reports/daily/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Task from '@/models/Task';
import Employee from '@/models/Employee'; // required so populate works

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_me';

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return { ok: false as const, error: 'Unauthorized' };
  try {
    const p = jwt.verify(token, JWT_SECRET) as { role: string; username: string };
    if (p?.role !== 'Admin') return { ok: false as const, error: 'Forbidden' };
    return { ok: true as const, admin: p };
  } catch {
    return { ok: false as const, error: 'Invalid token' };
  }
}

function dayRangeUTC(yyyy_mm_dd: string) {
  // expects "YYYY-MM-DD"
  const start = new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
  const end   = new Date(`${yyyy_mm_dd}T23:59:59.999Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

export async function GET(req: NextRequest) {
  // 🔐 admin required
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    await dbConnect();

    const dateStr = new URL(req.url).searchParams.get('date') || '';
    const range = dayRangeUTC(dateStr);
    if (!range) {
      return NextResponse.json({ success: false, error: 'Missing or invalid ?date=YYYY-MM-DD' }, { status: 400 });
    }

    // ---------- Attendance (this day, UTC) ----------
    const attRows = await Attendance.find({
      timestamp: { $gte: range.start, $lte: range.end },
    })
      .populate('employeeId', 'name') // requires model name "Employee"
      .sort({ timestamp: 1 })
      .lean();

    const attendance = (attRows as any[]).map((a) => ({
      _id: String(a._id),
      employeeId:
        a.employeeId?._id?.toString?.() ??
        (typeof a.employeeId === 'object' ? a.employeeId.toString?.() : String(a.employeeId)),
      employeeName: a.employeeId?.name ?? 'Unknown',
      type: a.type as 'checkin' | 'checkout',
      timestamp: a.timestamp,
      imageData: a.imageData ?? null,
      createdAt: a.createdAt,
    }));

    // ---------- Progress Updates (same day) ----------
    // We scan tasks whose embedded progressUpdates have timestamps in the range.
    const taskRows = await Task.find(
      { 'progressUpdates.timestamp': { $gte: range.start, $lte: range.end } },
      { title: 1, assignedTo: 1, progressUpdates: 1 }
    )
      .populate('assignedTo', 'name') // show employee name for assignee
      .lean();

    const progress: Array<{
      taskId: string;
      taskTitle: string;
      assignedTo: string;      // employee _id
      employeeName: string;    // assignee name (best available)
      message: string;
      timestamp: string;       // ISO
    }> = [];

    for (const t of taskRows as any[]) {
      const taskTitle = t.title ?? 'Task';
      const assignedToId =
        t.assignedTo?._id?.toString?.() ??
        (typeof t.assignedTo === 'object' ? t.assignedTo.toString?.() : String(t.assignedTo));
      const assignedToName = t.assignedTo?.name ?? 'Employee';

      if (Array.isArray(t.progressUpdates)) {
        for (const u of t.progressUpdates) {
          const ts = new Date(u.timestamp);
          if (ts >= range.start && ts <= range.end) {
            progress.push({
              taskId: String(t._id),
              taskTitle,
              assignedTo: String(assignedToId),
              employeeName: assignedToName,
              message: String(u.message ?? ''),
              timestamp: ts.toISOString(),
            });
          }
        }
      }
    }

    // Sort progress by time ascending (optional)
    progress.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json(
      { success: true, attendance, progress },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('GET /api/reports/daily error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to load daily report', details: e?.message },
      { status: 500 }
    );
  }
}
