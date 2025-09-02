import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Employee from '@/models/Employee';
import { hash } from 'bcryptjs';

export async function GET() {
  try {
    await dbConnect();

    const employees = await Employee.find({ isActive: true })
      .select('-passwordHash')
      .sort({ department: 1, name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      employees
    });
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();

    const { name, email, password, department, role, position } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return NextResponse.json(
        { success: false, error: 'Employee with this email already exists' },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    const employee = await Employee.create({
      name,
      email,
      passwordHash,
      department: department || 'General',
      role: role || 'Employee',
      position: position || 'Employee',
      isActive: true
    });

    const { passwordHash: _, ...employeeWithoutPassword } = employee.toObject();

    return NextResponse.json(
      {
        success: true,
        message: 'Employee created successfully',
        employee: employeeWithoutPassword
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}