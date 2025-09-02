import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Attendance from "@/models/Attendance";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const employeeId = searchParams.get("employeeId"); // ✅ new filter

    const skip = (page - 1) * limit;

    // ✅ build query
    const query: any = {};
    if (employeeId) {
      query.employeeId = employeeId;
    }

    const total = await Attendance.countDocuments(query);

    const attendance = await Attendance.find(query)
      .populate("employeeId", "name email position")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const records = attendance.map((record) => ({
      _id: record._id,
      employeeId: record.employeeId?._id,
      employeeName: record.employeeId?.name,
      type: record.type,
      timestamp: record.timestamp,
      imageData: record.imageData || null,
    }));

    return NextResponse.json({
      attendance: records,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error: any) {
    console.error("GET /api/admin/attendance - Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}