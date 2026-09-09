import dotenv from 'dotenv';
import { connectDatabase } from '../config/db.js';
import { User } from '../models/User.js';

dotenv.config();

await connectDatabase();

const email = process.env.SEED_TL_EMAIL || 'tl@trimurya.local';
const loginId = process.env.SEED_TL_LOGIN_ID || '400001';
const password = process.env.SEED_TL_PASSWORD || 'ChangeMe123!';
const languages = (process.env.SEED_TL_LANGUAGES || 'English,Hindi').split(',').map((item) => item.trim()).filter(Boolean);

const loginOwner = await User.findOne({ loginId });
const existing = await User.findOne({ email });

if (loginOwner && (!existing || String(loginOwner._id) !== String(existing._id))) {
  throw new Error(`Login ID "${loginId}" is already assigned to ${loginOwner.email}. Choose another SEED_TL_LOGIN_ID.`);
}

if (existing) {
  existing.name = process.env.SEED_TL_NAME || 'TL User';
  existing.loginId = loginId;
  existing.passwordHash = await User.hashPassword(password);
  existing.role = 'tl';
  existing.isActive = true;
  existing.languages = languages;
  await existing.save();
} else {
  await User.create({
    name: process.env.SEED_TL_NAME || 'TL User',
    email,
    loginId,
    passwordHash: await User.hashPassword(password),
    role: 'tl',
    isActive: true,
    languages
  });
}

console.log(`TL user ready. Login ID: ${loginId}`);
process.exit(0);
