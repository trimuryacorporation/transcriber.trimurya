import dotenv from 'dotenv';
import { connectDatabase } from '../config/db.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { TagDefinition } from '../models/TagDefinition.js';

dotenv.config();

await connectDatabase();

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@trimurya.local';
const adminLoginId = process.env.SEED_ADMIN_LOGIN_ID || '123456';
const transcriberEmail = process.env.SEED_TRANSCRIBER_EMAIL || 'transcriber@trimurya.local';
const transcriberLoginId = process.env.SEED_TRANSCRIBER_LOGIN_ID || '200001';
const reviewerEmail = process.env.SEED_REVIEWER_EMAIL || 'reviewer@trimurya.local';
const reviewerLoginId = process.env.SEED_REVIEWER_LOGIN_ID || '300001';
const tlEmail = process.env.SEED_TL_EMAIL || 'tl@trimurya.local';
const tlLoginId = process.env.SEED_TL_LOGIN_ID || '400001';

const usersWithoutLoginId = await User.find({ $or: [{ loginId: { $exists: false } }, { loginId: null }] });
for (const user of usersWithoutLoginId) {
  user.loginId = user.email || String(user._id);
  await user.save();
}

async function upsertUserByEmail({ email, loginId, values }) {
  const loginOwner = await User.findOne({ loginId });
  const existing = await User.findOne({ email });
  if (loginOwner && (!existing || String(loginOwner._id) !== String(existing._id))) {
    throw new Error(`Login ID "${loginId}" is already assigned to ${loginOwner.email}. Choose another SEED_*_LOGIN_ID or update that user manually.`);
  }
  if (existing) {
    Object.assign(existing, values, { loginId });
    await existing.save();
    return existing;
  }
  return User.create({ ...values, email, loginId });
}

const admin = await upsertUserByEmail({
  email: adminEmail,
  loginId: adminLoginId,
  values: {
    name: process.env.SEED_ADMIN_NAME || 'Trimurya Admin',
    passwordHash: await User.hashPassword(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'),
    role: 'admin',
    isActive: true
  }
});

await upsertUserByEmail({
  email: transcriberEmail,
  loginId: transcriberLoginId,
  values: {
    name: process.env.SEED_TRANSCRIBER_NAME || 'Transcriber User',
    passwordHash: await User.hashPassword(process.env.SEED_TRANSCRIBER_PASSWORD || 'ChangeMe123!'),
    role: 'transcriber',
    isActive: true,
    languages: (process.env.SEED_TRANSCRIBER_LANGUAGES || 'English,Hindi').split(',').map((item) => item.trim())
  }
});

await upsertUserByEmail({
  email: reviewerEmail,
  loginId: reviewerLoginId,
  values: {
    name: process.env.SEED_REVIEWER_NAME || 'Reviewer User',
    passwordHash: await User.hashPassword(process.env.SEED_REVIEWER_PASSWORD || 'ChangeMe123!'),
    role: 'reviewer',
    isActive: true,
    languages: (process.env.SEED_REVIEWER_LANGUAGES || 'English').split(',').map((item) => item.trim())
  }
});

const tl = await upsertUserByEmail({
  email: tlEmail,
  loginId: tlLoginId,
  values: {
    name: process.env.SEED_TL_NAME || 'TL User',
    passwordHash: await User.hashPassword(process.env.SEED_TL_PASSWORD || 'ChangeMe123!'),
    role: 'tl',
    isActive: true,
    languages: (process.env.SEED_TL_LANGUAGES || 'English,Hindi').split(',').map((item) => item.trim())
  }
});

const project = await Project.findOneAndUpdate(
  { name: process.env.SEED_PROJECT_NAME || 'Verbatim English Project' },
  {
    name: process.env.SEED_PROJECT_NAME || 'Verbatim English Project',
    client: process.env.SEED_PROJECT_CLIENT || 'Trimurya',
    language: process.env.SEED_PROJECT_LANGUAGE || 'English',
    description: process.env.SEED_PROJECT_DESCRIPTION || '',
    guidelines: process.env.SEED_PROJECT_GUIDELINES || ''
  },
  { upsert: true, new: true }
);

await TagDefinition.findOneAndUpdate(
  { project: project._id, name: 'Noise' },
  { project: project._id, name: 'Noise', color: '#f59e0b', description: 'Audible non-speech noise.' },
  { upsert: true }
);

console.log(`Seed complete. Admin login ID: ${admin.loginId} / ${process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'}`);
console.log(`TL login ID: ${tl.loginId} / ${process.env.SEED_TL_PASSWORD || 'ChangeMe123!'}`);
process.exit(0);
