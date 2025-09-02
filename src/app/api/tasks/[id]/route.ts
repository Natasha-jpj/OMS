// app/api/tasks/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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

type Params = { id: string };
type Ctx = { params: Params } | { params: Promise<Params> };

function isPromise<T>(x: unknown): x is Promise<T> {
  return !!x && typeof (x as Promise<T>).then === 'function';
}

function parseDateMaybe(value: unknown): Date | undefined {
  if (value == null) return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function hasId(x: unknown): x is { _id: { toString(): string } } {
  return typeof x === 'object' && x !== null && '_id' in x;
}
function hasPermissions(x: unknown): x is { permissions?: Perms } {
  return typeof x === 'object' && x !== null && 'permissions' in x;
}

async function resolveRoleIdForEmployee(employeeId: string): Promise<string | null> {
  const emp = await Employee.findById(employeeId).populate('role').lean();
  if (!emp) return null;

  const roleValue = (emp as Record<string, unknown>).role;

  // If it's already a populated doc with _id
  if (roleValue && typeof roleValue === 'object' && roleValue !== null && '_id' in roleValue) {
    // _id has toString on ObjectId
    return (roleValue as { _id: { toString(): string } })._id.toString();
  }

  // If it's a role name string, look up the role and return its _id as string
  if (typeof roleValue === 'string') {
    // 👇 Tell TS exactly what lean() will return
    const roleDoc = await Role.findOne({ name: roleValue })
      .select('_id')
      .lean<{ _id: { toString(): string } } | null>();

    return roleDoc ? roleDoc._id.toString() : null;
  }

  return null;
}


// PUT /api/tasks/[id]
export async function PUT(request: NextRequest, context: Ctx) {
  try {
    await dbConnect();

    const { id } = isPromise<Params>(context.params)
      ? await context.params
      : context.params;

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const rawBody: unknown = await request.json();
    const body = (typeof rawBody === 'object' && rawBody !== null)
      ? (rawBody as Record<string, unknown>)
      : ({} as Record<string, unknown>);

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const user = await Employee.findById(userId).populate('role').lean();
    const userRole = user && (user as Record<string, unknown>).role;
    const perms: Perms = hasPermissions(userRole) ? (userRole.permissions ?? {}) : {};
    const isManager = !!perms.canAssignTasks;
    const isAssignee = task.assignedTo?.toString() === userId;

    if (!isAssignee && !isManager) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (isManager) {
      if (typeof body.title === 'string') updates.title = body.title;
      if (typeof body.description === 'string') updates.description = body.description;
      if (typeof body.priority === 'string') updates.priority = body.priority;
      if (typeof body.status === 'string') updates.status = body.status;
      const due = parseDateMaybe(body.dueDate);
      if (due) updates.dueDate = due;

      if (typeof body.assignedTo === 'string' && body.assignedTo !== task.assignedTo?.toString()) {
        updates.assignedTo = body.assignedTo;
        const newRoleId = await resolveRoleIdForEmployee(body.assignedTo);
        updates.role = newRoleId ?? null;
      }
    } else if (isAssignee) {
      if (typeof body.description === 'string') updates.description = body.description;
      if (typeof body.status === 'string') updates.status = body.status;
    }

    Object.assign(task, updates);
    await task.save();

    return NextResponse.json({ success: true, task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('PUT /api/tasks/[id] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await dbConnect();

    const { id } = isPromise<Params>(context.params)
      ? await context.params
      : context.params;

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const user = await Employee.findById(userId).populate('role').lean();
    const userRole = user && (user as Record<string, unknown>).role;
    const perms: Perms = hasPermissions(userRole) ? (userRole.permissions ?? {}) : {};
    const isManager = !!perms.canAssignTasks;
    const isAssignee = task.assignedTo?.toString() === userId;

    if (!isAssignee && !isManager) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    await Task.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('DELETE /api/tasks/[id] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
