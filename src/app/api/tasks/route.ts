import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Employee from '@/models/Employee';
import Role from '@/models/Role';

// Helper to get Role doc (supports role saved as ObjectId or name string)
async function getUserRole(userId: string) {
  const employee = await Employee.findById(userId).populate('role').lean();

  // If role already populated (ObjectId -> Role doc)
  if (employee?.role && typeof employee.role === 'object' && '_id' in employee.role) {
    return employee.role as any;
  }

  // If role saved as a name string, resolve it to a Role doc
  if (employee?.role && typeof employee.role === 'string') {
    const roleDoc = await Role.findOne({ name: employee.role }).lean();
    return roleDoc ?? null;
  }

  return null;
}

// ------------------------ TASKS API ------------------------

// GET /api/tasks
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const roleDoc = await getUserRole(userId);
    if (!roleDoc) return NextResponse.json({ success: false, error: 'No role assigned' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo') || undefined;

    const canViewAll = !!roleDoc.permissions?.canViewAllTasks;
    const canViewSome = !!roleDoc.permissions?.canViewTasks;

    let query: any = {};

    if (canViewAll) {
      if (assignedTo) query.assignedTo = assignedTo;
    } else if (canViewSome) {
      const or: any[] = [{ assignedTo: userId }];
      if (roleDoc._id) or.push({ role: roleDoc._id.toString() });

      query = assignedTo
        ? { $and: [{ $or: or }, { assignedTo }] }
        : { $or: or };
    } else {
      query = { assignedTo: userId };
    }

    const tasks = await Task.find(query).sort({ dueDate: 1, priority: -1 }).lean();
    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    console.error('Error in GET /tasks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    if (!body.title || !body.assignedBy || !body.assignedTo || !body.dueDate) {
      return NextResponse.json(
        { success: false, error: 'Title, assignedBy, assignedTo, and dueDate are required' },
        { status: 400 }
      );
    }

    // Resolve the assignee's role to a Role _id
    const assignedEmployee = await Employee.findById(body.assignedTo).populate('role').lean();
    let roleId: string | null = null;

    if (assignedEmployee?.role) {
      if (typeof assignedEmployee.role === 'object' && '_id' in assignedEmployee.role) {
        roleId = (assignedEmployee.role as any)._id.toString();
      } else if (typeof assignedEmployee.role === 'string') {
        const roleDoc = await Role.findOne({ name: assignedEmployee.role }).lean();
        roleId = roleDoc?._id?.toString() ?? null;
      }
    }

    const task = await Task.create({
      title: body.title,
      description: body.description,
      assignedBy: body.assignedBy,
      assignedTo: body.assignedTo,
      role: roleId, // store Role _id when possible
      priority: body.priority || 'medium',
      status: body.status || 'pending',
      dueDate: new Date(body.dueDate),
      progressUpdates: [],
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /tasks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
