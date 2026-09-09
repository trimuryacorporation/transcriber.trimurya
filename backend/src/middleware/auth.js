import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[process.env.COOKIE_NAME || 'trimurya_token'];
  if (!token) throw new ApiError(401, 'Authentication required');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.id).select('-passwordHash');
  if (!user || !user.isActive) throw new ApiError(401, 'Account is inactive or no longer exists');
  req.user = user;
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw new ApiError(403, 'You do not have permission to perform this action');
  next();
};
