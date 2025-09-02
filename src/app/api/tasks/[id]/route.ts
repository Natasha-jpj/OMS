// app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Employee from '@/models/Employee';
import Role from '@/models/Role';

type Perms = {
  canAssignTasks?: boolean;
  canCheckIn?: boolean;
  canManageEmployees?: boolean;
  canManageDepartments?: boolean;
  canManageRoles?: boolean;
  canViewAllTasks?: boolean;
  canViewTasks?: boolean;
  canViewReports?: boolean;
};

function parseDateMaybe(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? undefined : d;
}

async function resolveRoleIdForEmployee(employeeId: string): Promise<string | null> {
  const emp = await Employee.findById(employeeId).populate('role').lean();
  if (!emp) return null;

  if (emp.role && typeof emp.role === 'object' && '_id' in emp.role) {
    return (emp.role as any)._id?.toString() ?? null;
  }
  if (typeof emp.role === 'string') {
    const roleDoc = await Role.findOne({ name: emp.role }).lean();
    return roleDoc?._id?.toString() ?? null;
  }
  return null;
}

// PUT /api/tasks/[id]  (partial update allowed)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const body = await request.json();

    const task = await Task.findById(params.id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // current user + perms
    const user = await Employee.findById(userId).populate('role').lean<{ role?: { permissions?: Perms } }>();
    const perms: Perms = user?.role && typeof user.role === 'object' ? (user.role as any).permissions ?? {} : {};
    const isManager = !!perms.canAssignTasks;
    const isAssignee = task.assignedTo?.toString() === userId;

    // Authorization: either assignee or manager
    if (!isAssignee && !isManager) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Build the allowed changes
    const updates: any = {};

    if (isManager) {
      // Managers can update anything relevant
      if (typeof body.title === 'string') updates.title = body.title;
      if (typeof body.description === 'string') updates.description = body.description;
      if (typeof body.priority === 'string') updates.priority = body.priority;              // 'low' | 'medium' | 'high'
      if (typeof body.status === 'string') updates.status = body.status;                    // 'pending' | 'in-progress' | 'completed' | 'cancelled'
      const due = parseDateMaybe(body.dueDate);
      if (due) updates.dueDate = due;

      // Reassignment: update assignedTo and also refresh role based on new assignee's role
      if (typeof body.assignedTo === 'string' && body.assignedTo !== task.assignedTo?.toString()) {
        updates.assignedTo = body.assignedTo;
        const newRoleId = await resolveRoleIdForEmployee(body.assignedTo);
        updates.role = newRoleId ?? null;
      }
    } else if (isAssignee) {
      // Assignee can only update limited fields (e.g. status and description)
      if (typeof body.description === 'string') updates.description = body.description;
      if (typeof body.status === 'string') updates.status = body.status;
      // explicitly ignore all other fields if provided
    }

    // Apply and save
    Object.assign(task, updates);
    await task.save();

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error('PUT /api/tasks/[id] error:', error);
    return NextResponse.json({ success: false, error: error.message ?? 'Server error' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });

    const task = await Task.findById(params.id);
    if (!task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

    // current user + perms
    const user = await Employee.findById(userId).populate('role').lean<{ role?: { permissions?: Perms } }>();
    const perms: Perms = user?.role && typeof user.role === 'object' ? (user.role as any).permissions ?? {} : {};
    const isManager = !!perms.canAssignTasks;
    const isAssignee = task.assignedTo?.toString() === userId;

    if (!isAssignee && !isManager) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    await Task.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true, message: 'Task deleted' });
  } catch (error: any) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json({ success: false, error: error.message ?? 'Server error' }, { status: 500 });
  }
}
