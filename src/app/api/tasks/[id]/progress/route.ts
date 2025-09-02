// app/api/tasks/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Types, HydratedDocument } from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';

type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

type Progress = { message: string; timestamp: Date };

interface ITaskMinimal {
  _id: Types.ObjectId;
  assignedTo: Types.ObjectId | string;
  status: TaskStatus;
  progressUpdates: Progress[];
}

function isObjectId(x: unknown): x is Types.ObjectId {
  return !!x && typeof x === 'object' && typeof (x as Types.ObjectId).toString === 'function';
}

/* -------------------- POST: add progress -------------------- */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const message: unknown = body?.message;
    const status: unknown = body?.status;

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    // Need a mutable doc here (NOT lean)
    const task = (await Task.findById(params.id)) as HydratedDocument<ITaskMinimal> | null;
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const assignee = isObjectId(task.assignedTo)
      ? task.assignedTo.toString()
      : String(task.assignedTo ?? '');

    if (assignee !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Ensure array exists (in case old docs missed the field)
    if (!Array.isArray(task.progressUpdates)) task.progressUpdates = [];

    task.progressUpdates.push({ message, timestamp: new Date() });

    if (typeof status === 'string') {
      // optionally validate against allowed statuses
      task.status = status as TaskStatus;
    }

    await task.save();

    return NextResponse.json(
      { success: true, message: 'Progress update saved', task },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error adding progress:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

/* -------------------- GET: list progress -------------------- */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    // With lean(), tell TS exactly what comes back
    const task = await Task.findById(params.id)
      .select({ progressUpdates: 1 })
      .lean<{ _id: Types.ObjectId; progressUpdates: Progress[] } | null>();

    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, messages: task.progressUpdates ?? [] },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error fetching progress:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
