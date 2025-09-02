// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Employee from '@/models/Employee';
import Role from '@/models/Role';

// ---- Types / Guards -------------------------------------------------

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

type RoleLean = {
  _id?: { toString(): string } | string;
  name?: string;
  permissions?: Perms;
} | null;

function hasObjId(x: unknown): x is { _id: { toString(): string } } {
  return typeof x === 'object' && x !== null && '_id' in x;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function parseDateMaybe(value: unknown): Date | undefined {
  if (value == null) return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Helper to get Role doc (supports role stored as ObjectId ref OR as a name string)
async function getUserRole(userId: string): Promise<RoleLean> {
  const employee = await Employee.findById(userId).populate('role').lean();

  // Populated role (ObjectId -> Role doc)
  const roleValue = isRecord(employee) ? (employee as Record<string, unknown>)['role'] : null;

  if (roleValue && isRecord(roleValue) && hasObjId(roleValue)) {
    // Already a role document
    const { _id } = roleValue;
    return { _id, permissions: (roleValue as Record<string, unknown>)['permissions'] as Perms | undefined };
  }

  // Role saved as a string name
  if (typeof roleValue === 'string') {
    const roleDoc = await Role.findOne({ name: roleValue }).lean();
    if (roleDoc) {
      return {
        _id: (roleDoc as Record<string, unknown>)['_id'] as { toString(): string },
        permissions: (roleDoc as Record<string, unknown>)['permissions'] as Perms | undefined,
      };
    }
  }

  return null;
}

// ------------------------ TASKS API ------------------------

// GET /api/tasks
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const roleDoc = await getUserRole(userId);
    if (!roleDoc) {
      return NextResponse.json({ success: false, error: 'No role assigned' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const assignedToParam = searchParams.get('assignedTo') || undefined;

    const canViewAll = !!roleDoc.permissions?.canViewAllTasks;
    const canViewSome = !!roleDoc.permissions?.canViewTasks;

    // Build query without using `any`
    let query: Record<string, unknown> = {};

    if (canViewAll) {
      if (assignedToParam) query.assignedTo = assignedToParam;
    } else if (canViewSome) {
      const orConditions: Array<Record<string, unknown>> = [{ assignedTo: userId }];

      // If we have a role _id, include role-based visibility
      if (roleDoc._id) {
        const roleIdStr =
          typeof roleDoc._id === 'string' ? roleDoc._id : roleDoc._id.toString();
        orConditions.push({ role: roleIdStr });
      }

      query = assignedToParam
        ? { $and: [{ $or: orConditions }, { assignedTo: assignedToParam }] }
        : { $or: orConditions };
    } else {
      query = { assignedTo: userId };
    }

    const tasks = await Task.find(query).sort({ dueDate: 1, priority: -1 }).lean();
    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Error in GET /api/tasks:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const raw = await request.json();
    const body = isRecord(raw) ? (raw as Record<string, unknown>) : {};

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const assignedBy = typeof body.assignedBy === 'string' ? body.assignedBy : '';
    const assignedTo = typeof body.assignedTo === 'string' ? body.assignedTo : '';
    const dueDate = parseDateMaybe(body.dueDate);
    const description = typeof body.description === 'string' ? body.description : '';
    const priority =
      body.priority === 'low' || body.priority === 'high' || body.priority === 'medium'
        ? body.priority
        : 'medium';
    const status =
      body.status === 'pending' || body.status === 'in-progress' || body.status === 'completed' || body.status === 'cancelled'
        ? body.status
        : 'pending';

    if (!title || !assignedBy || !assignedTo || !dueDate) {
      return NextResponse.json(
        { success: false, error: 'Title, assignedBy, assignedTo, and valid dueDate are required' },
        { status: 400 }
      );
    }

    // Resolve the assignee's role to a Role _id (string)
    const assignedEmployee = await Employee.findById(assignedTo).populate('role').lean();
    let roleId: string | null = null;

    if (assignedEmployee && isRecord(assignedEmployee)) {
      const empRole = (assignedEmployee as Record<string, unknown>)['role'];

      if (empRole && isRecord(empRole) && hasObjId(empRole)) {
        roleId = empRole._id.toString();
      } else if (typeof empRole === 'string') {
        const roleDoc = await Role.findOne({ name: empRole }).lean();
        roleId = roleDoc ? ((roleDoc as Record<string, unknown>)['_id'] as { toString(): string }).toString() : null;
      }
    }

    const task = await Task.create({
      title,
      description,
      assignedBy,
      assignedTo,
      role: roleId, // store Role _id when possible
      priority,
      status,
      dueDate,
      progressUpdates: [],
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Error in POST /api/tasks:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
