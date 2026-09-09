import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true }
}, { _id: false });

const rulesSchema = new mongoose.Schema({
  millisecondPrecision: { type: Boolean, default: true },
  timestampBufferSeconds: { type: Number, default: 0.3 },
  minSegmentSeconds: { type: Number, default: 0.5 },
  maxSegmentSeconds: { type: Number, default: 20 },
  newSegmentOnSpeakerChange: { type: Boolean, default: true },
  silenceWarningSeconds: { type: Number, default: 4 },
  handleOverlappingSpeechSeparately: { type: Boolean, default: true },
  ignoreBackgroundVoices: { type: Boolean, default: true },
  verbatim: { type: Boolean, default: true }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  client: { type: String, trim: true },
  description: { type: String, trim: true },
  language: { type: String, required: true, trim: true },
  guidelines: { type: String, default: '' },
  speakers: { type: [optionSchema], default: [{ label: 'Speaker 1', value: 'Speaker 1' }, { label: 'Speaker 2', value: 'Speaker 2' }] },
  genders: { type: [optionSchema], default: [{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Unknown', value: 'Unknown' }] },
  rules: { type: rulesSchema, default: () => ({}) },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Project = mongoose.model('Project', projectSchema);
