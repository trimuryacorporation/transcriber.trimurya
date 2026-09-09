import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { logActivity } from '../utils/audit.js';

const cookieName = process.env.COOKIE_NAME || 'trimurya_token';

function issueToken(res, user) {
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export const loginSchema = z.object({
  body: z.object({
    loginId: z.string().min(1),
    password: z.string().min(8)
  })
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ loginId: req.body.loginId.trim() }).select('+passwordHash');
  if (!user || !user.isActive || !(await user.comparePassword(req.body.password))) {
    throw new ApiError(401, 'Invalid login ID or password');
  }
  user.lastLoginAt = new Date();
  await user.save();
  issueToken(res, user);
  await logActivity({ actor: user._id, action: 'login', entityType: 'User', entityId: user._id, req });
  res.json({ user: sanitizeUser(user) });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => res.json({ user: req.user }));

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8)
  })
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  user.passwordHash = await User.hashPassword(req.body.newPassword);
  await user.save();
  await logActivity({ actor: user._id, action: 'password_changed', entityType: 'User', entityId: user._id, req });
  res.json({ message: 'Password updated' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await logActivity({ action: 'forgot_password_requested', entityType: 'User', metadata: { identifier: req.body.identifier }, req });
  res.json({ message: 'If an active account exists, an administrator will be notified to reset the password.' });
});

function sanitizeUser(user) {
  const data = user.toObject();
  delete data.passwordHash;
  return data;
}
