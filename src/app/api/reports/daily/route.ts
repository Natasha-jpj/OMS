// app/api/reports/daily/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Task from '@/models/Task';
import Employee from '@/models/Employee'; // required so populate works

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const start = new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
  const end   = new Date(`${yyyy_mm_dd}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    await dbConnect();

    const dateStr = new URL(req.url).searchParams.get('date') || '';
    const range = dayRangeUTC(dateStr);
    if (!range) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid ?date=YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // -------- Attendance (that day, UTC) --------
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

    // -------- Progress updates (best-effort, won’t crash) --------
    let progress: Array<{
      taskId: string;
      taskTitle: string;
      assignedTo: string;    // employee _id
      employeeName: string;  // assignee name
      message: string;
      timestamp: string;     // ISO
    }> = [];

    try {
      const taskRows = await Task.find(
        { 'progressUpdates.timestamp': { $gte: range.start, $lte: range.end } },
        { title: 1, assignedTo: 1, progressUpdates: 1 }
      )
        .populate('assignedTo', 'name')
        .lean();

      for (const t of taskRows as any[]) {
        const taskTitle = t.title ?? 'Task';
        const assignedToId =
          t.assignedTo?._id?.toString?.() ??
          (typeof t.assignedTo === 'object' ? t.assignedTo.toString?.() : String(t.assignedTo));
        const assignedToName = t.assignedTo?.name ?? 'Employee';

        if (Array.isArray(t.progressUpdates)) {
          for (const u of t.progressUpdates) {
            const tsNum = new Date(u?.timestamp).getTime();
            if (!Number.isNaN(tsNum) && tsNum >= range.start.getTime() && tsNum <= range.end.getTime()) {
              progress.push({
                taskId: String(t._id),
                taskTitle,
                assignedTo: String(assignedToId),
                employeeName: assignedToName,
                message: String(u?.message ?? ''),
                timestamp: new Date(tsNum).toISOString(),
              });
            }
          }
        }
      }

      progress.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (err) {
      console.error('Daily report: progress scan failed (returning empty list):', err);
      progress = [];
    }

    return NextResponse.json({ success: true, attendance, progress }, { status: 200 });
  } catch (e: any) {
    console.error('GET /api/reports/daily error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to load daily report', details: e?.message },
      { status: 500 }
    );
  }
}
