import mongoose from 'mongoose';

const tagDefinitionSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true, trim: true },
  color: { type: String, default: '#1e3a8a' },
  description: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

tagDefinitionSchema.index({ project: 1, name: 1 }, { unique: true });

export const TagDefinition = mongoose.model('TagDefinition', tagDefinitionSchema);
