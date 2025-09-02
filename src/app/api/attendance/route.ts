import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';  // ✅ use Attendance, not Checkin

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();

    console.log('API Received attendance data:', {
      employeeId: body.employeeId,
      type: body.type,
      imageDataLength: body.imageData?.length || 0
    });

    if (!body.employeeId) {
      return NextResponse.json(
        { error: 'Missing employeeId field' },
        { status: 400 }
      );
    }

    if (!['checkin', 'checkout'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "checkin" or "checkout"' },
        { status: 400 }
      );
    }

    const attendanceRecord = await Attendance.create({
      employeeId: body.employeeId,
      employeeName: body.employeeName || 'Unknown Employee',
      type: body.type,
      timestamp: new Date(),
      imageData: body.imageData || null,
    });

    console.log('✅ Successfully created attendance record');

    return NextResponse.json(
      { 
        message: 'Attendance recorded successfully', 
        data: attendanceRecord 
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('API Error:', error);

    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await dbConnect();
    
    const records = await Attendance.find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    
    return NextResponse.json({ 
      message: 'Records retrieved successfully', 
      records 
    });
  } catch (error: any) {
    console.error('API Error:', error);

    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}