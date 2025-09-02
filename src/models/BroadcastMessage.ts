import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IBroadcastMessage extends Document {
  subject: string;
  body: string;
  urgent?: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  recipients: mongoose.Types.ObjectId[]; // store all employee ids at time of send
}

const BroadcastMessageSchema = new Schema<IBroadcastMessage>(
  {
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true },
    urgent: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    recipients: [{ type: Schema.Types.ObjectId, ref: 'Employee', required: true }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const BroadcastMessage: Model<IBroadcastMessage> =
  mongoose.models.BroadcastMessage || mongoose.model<IBroadcastMessage>('BroadcastMessage', BroadcastMessageSchema);

export default BroadcastMessage;
