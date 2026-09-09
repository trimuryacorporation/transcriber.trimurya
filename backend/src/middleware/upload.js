import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import multer from 'multer';
import { AUDIO_MIME_TYPES } from '../utils/constants.js';
import { ApiError } from '../utils/apiError.js';

const uploadDir = path.join(os.tmpdir(), 'trimurya-transcriber-uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    callback(null, `${Date.now()}-${safeName}`);
  }
});

export const audioUpload = multer({
  storage,
  limits: {
    files: Number(process.env.MAX_UPLOAD_FILES || 20),
    fileSize: Number(process.env.MAX_UPLOAD_SIZE_MB || 2048) * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExts = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'];
    if (AUDIO_MIME_TYPES.includes(file.mimetype) || allowedExts.includes(ext)) {
      callback(null, true);
      return;
    }
    callback(new ApiError(422, `${file.originalname} is not a supported audio format`));
  }
});
