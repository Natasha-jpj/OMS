import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Employee from '@/models/Employee';
import Role from '@/models/Role';                // <<< add this
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // If your Employee.role is an ObjectId -> populate; if it's a string name -> lookup below.
    // Try populate first; if you don't use refs, this will just leave it as-is.
    const employeeDoc = await Employee.findOne({ email }).populate('role');
    if (!employeeDoc) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, employeeDoc.passwordHash || '');
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Resolve role + permissions no matter how you store it
    let roleName: string | undefined;
    let permissions: any = {};

    // Case A: populated role object
    // @ts-ignore
    if (employeeDoc.role && typeof employeeDoc.role === 'object' && employeeDoc.role.name) {
      // @ts-ignore
      roleName = employeeDoc.role.name;
      // @ts-ignore
      permissions = employeeDoc.role.permissions || {};
    } else if (employeeDoc.role) {
      // Case B: role is a string name stored on Employee
      const roleDoc = await Role.findOne({ name: employeeDoc.role as any });
      roleName = roleDoc?.name || (employeeDoc.role as any);
      permissions = roleDoc?.permissions || {};
    } else {
      // Case C: no role set
      roleName = 'Employee';
      permissions = {};
    }

    // Build JWT with role + permissions so APIs can authorize
    const token = jwt.sign(
      { id: employeeDoc._id.toString(), email: employeeDoc.email, role: roleName, permissions },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return NextResponse.json({
      token,
      employee: {
        id: employeeDoc._id.toString(),
        name: employeeDoc.name,
        email: employeeDoc.email,
        position: employeeDoc.position,
        role: roleName,
        permissions,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
