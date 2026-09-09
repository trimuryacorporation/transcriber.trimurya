import { z } from 'zod';
import { AppSetting } from '../models/AppSetting.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const defaults = {
  allowTlReportDownload: false,
  allowTlTeamCreate: false
};

export const settingsSchema = z.object({
  body: z.object({
    allowTlReportDownload: z.boolean().optional(),
    allowTlTeamCreate: z.boolean().optional()
  }).refine((body) => Object.keys(body).length > 0, 'At least one setting is required')
});

export async function getAppSettings() {
  const rows = await AppSetting.find({ key: { $in: Object.keys(defaults) } });
  return rows.reduce((settings, row) => ({ ...settings, [row.key]: row.value }), { ...defaults });
}

export const readSettings = asyncHandler(async (_req, res) => {
  res.json({ settings: await getAppSettings() });
});

export const updateSettings = asyncHandler(async (req, res) => {
  await Promise.all(Object.entries(req.body).map(([key, value]) => (
    AppSetting.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true, runValidators: true }
    )
  )));
  res.json({ settings: await getAppSettings() });
});
