import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/error.js';

export const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPublic = path.resolve(__dirname, '../public');
const frontendIndex = path.join(frontendPublic, 'index.html');

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 900, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'trimurya-transcriber-api' }));
app.get('/asset-check', (_req, res) => {
  const assetsDir = path.join(frontendPublic, 'assets');
  res.json({
    frontendDist: frontendPublic,
    indexExists: fs.existsSync(frontendIndex),
    assetsExists: fs.existsSync(assetsDir),
    assets: fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []
  });
});
app.use('/api', routes);
if (fs.existsSync(frontendIndex)) {
  const sendFrontend = (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(frontendIndex, (error) => {
      if (error) next(error);
    });
  };

  app.use(express.static(frontendPublic, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    if (req.path.startsWith('/assets')) return next();
    sendFrontend(req, res, next);
  });
}
app.use(notFound);
app.use(errorHandler);
