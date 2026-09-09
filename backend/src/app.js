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
const frontendDistCandidates = [
  path.resolve(__dirname, '../public'),
  path.resolve(process.cwd(), 'public'),
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist')
];
const frontendDist = frontendDistCandidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));
const frontendIndex = frontendDist ? path.join(frontendDist, 'index.html') : '';
const frontendVersion = frontendIndex ? String(Math.floor(fs.statSync(frontendIndex).mtimeMs)) : '';

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
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
  const assetsDir = frontendDist ? path.join(frontendDist, 'assets') : '';
  res.json({
    frontendDist: frontendDist || null,
    indexExists: Boolean(frontendIndex && fs.existsSync(frontendIndex)),
    assetsExists: Boolean(assetsDir && fs.existsSync(assetsDir)),
    assets: assetsDir && fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []
  });
});
app.use('/api', routes);
if (frontendDist && frontendIndex) {
  const sendFrontend = (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    fs.readFile(frontendIndex, 'utf8', (error, html) => {
      if (error) return next(error);
      const versionedHtml = html.replace(/(\/assets\/[^"']+\.(?:js|css))/g, `$1?v=${frontendVersion}`);
      res.type('html').send(versionedHtml);
    });
  };

  app.get('/assets/:fileName', (req, res, next) => {
    const fileName = path.basename(req.params.fileName);
    const filePath = path.join(frontendDist, 'assets', fileName);
    if (!fs.existsSync(filePath)) return next();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (fileName.endsWith('.css')) res.type('text/css');
    if (fileName.endsWith('.js')) res.type('application/javascript');
    fs.createReadStream(filePath).on('error', next).pipe(res);
  });

  app.use('/assets', express.static(path.join(frontendDist, 'assets'), {
    fallthrough: false,
    maxAge: 0,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
  app.use(express.static(frontendDist, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
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
