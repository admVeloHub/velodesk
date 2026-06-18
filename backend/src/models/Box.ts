import mongoose, { Schema, Document } from 'mongoose';

export interface IBox extends Document {
  name: string;
  order: number;
}

const BoxSchema = new Schema<IBox>(
  {
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Box = mongoose.model<IBox>('Box', BoxSchema);
