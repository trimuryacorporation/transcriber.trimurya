import { S3Client } from '@aws-sdk/client-s3';

const endpoint = process.env.R2_ENDPOINT && !process.env.R2_ENDPOINT.includes('local-placeholder')
  ? process.env.R2_ENDPOINT.replace(/\/+$/, '').replace(`/${process.env.R2_BUCKET_NAME}`, '')
  : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const r2 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

export const bucket = process.env.R2_BUCKET_NAME;
export const audioPrefix = process.env.R2_AUDIO_PREFIX || 'audio';
export const transcriptPrefix = process.env.R2_TRANSCRIPT_PREFIX || 'transcripts';

export function getStorageInfo() {
  return {
    bucket,
    endpoint,
    audioPrefix,
    transcriptPrefix,
    s3Api: `${endpoint}/${bucket}`
  };
}
