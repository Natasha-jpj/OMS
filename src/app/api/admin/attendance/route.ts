// app/api/admin/attendance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_me';

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return { ok: false as const, error: 'Unauthorized' };
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role: string; username: string };
    if (payload.role !== 'Admin') return { ok: false as const, error: 'Forbidden' };
    return { ok: true as const, admin: payload };
  } catch {
    return { ok: false as const, error: 'Invalid token' };
  }
}

export async function GET(request: NextRequest) {
  // 🔐 guard
  const auth = requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const employeeId = searchParams.get('employeeId') || undefined;

    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (employeeId) query.employeeId = employeeId;

    const total = await Attendance.countDocuments(query);

    const attendance = await Attendance.find(query)
      .populate('employeeId', 'name email position')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const records = attendance.map((record: any) => ({
      _id: record._id,
      employeeId: record.employeeId?._id,
      employeeName: record.employeeId?.name,
      type: record.type,
      timestamp: record.timestamp,
      imageData: record.imageData ?? null,
    }));

    return NextResponse.json({
      success: true,
      attendance: records,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error: any) {
    console.error('GET /api/admin/attendance - Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
