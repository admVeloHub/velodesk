import mongoose, { Schema, Document } from 'mongoose';

export interface IFormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  children?: unknown[];
}

export interface IForm extends Document {
  name: string;
  description?: string;
  fields: IFormField[];
}

const FormSchema = new Schema<IForm>(
  {
    name: { type: String, required: true },
    description: String,
    fields: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

export const Form = mongoose.model<IForm>('Form', FormSchema);
