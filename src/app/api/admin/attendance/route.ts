import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/mongodb";
import Attendance from "@/models/Attendance";

// Helper to extract userId from JWT token in cookies
function getUserIdFromToken(request: NextRequest): string | null {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // 🔐 Authenticate user
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 📦 Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const employeeId = searchParams.get("employeeId");

    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};
    if (employeeId) query.employeeId = employeeId;

    // 📊 Fetch attendance data
    const total = await Attendance.countDocuments(query);
    const attendance = await Attendance.find(query)
      .populate("employeeId", "name email position")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    // 🧹 Format response
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
    console.error("GET /api/admin/attendance - Error:", error.stack || error.message);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}