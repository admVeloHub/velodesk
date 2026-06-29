import mongoose, { Schema, Document } from 'mongoose';

/** Box v1.0.2 — reservada p/ caixas personalizadas futuras (POST); sem seed automático */

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
