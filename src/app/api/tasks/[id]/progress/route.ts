import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
// If you want managers to post progress too, import Employee/Role and check permissions here.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id'); // trust server header, not body
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { message, status } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const task = await Task.findById(params.id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Only assignee can add progress. (Adjust if managers should also be allowed.)
    if (task.assignedTo.toString() !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    task.progressUpdates.push({ message, timestamp: new Date() });
    if (status) task.status = status; // optional: allow status bump
    await task.save();

    return NextResponse.json({ success: true, message: 'Progress update saved', task }, { status: 201 });
  } catch (err: any) {
    console.error('Error adding progress:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const task = await Task.findById(params.id).select('progressUpdates').lean();
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, messages: task.progressUpdates }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching progress:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
