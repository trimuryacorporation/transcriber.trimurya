import { ActivityLog } from '../models/ActivityLog.js';

export async function logActivity({ actor, action, entityType, entityId, metadata = {}, req }) {
  await ActivityLog.create({
    actor,
    action,
    entityType,
    entityId,
    metadata,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent']
  });
}
