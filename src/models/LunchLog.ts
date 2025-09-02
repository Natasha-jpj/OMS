import mongoose, { Schema, Document } from "mongoose";

export interface ILunchLog extends Document {
  employeeId: mongoose.Types.ObjectId;
  type: "lunch-start" | "lunch-end";
  timestamp: Date;
}

const LunchLogSchema: Schema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  type: { type: String, enum: ["lunch-start", "lunch-end"], required: true },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.models.LunchLog ||
  mongoose.model<ILunchLog>("LunchLog", LunchLogSchema);
