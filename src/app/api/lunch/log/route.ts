import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import LunchLog from "@/models/LunchLog";

export async function POST(req: NextRequest) {
  await dbConnect();
  const { employeeId, type } = await req.json();

  if (!employeeId || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const log = await LunchLog.create({ employeeId, type });
  return NextResponse.json({ log });
}

export async function GET(req: NextRequest) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");

  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });
  }

  const logs = await LunchLog.find({ employeeId }).sort({ timestamp: -1 });
  return NextResponse.json({ logs });
}
