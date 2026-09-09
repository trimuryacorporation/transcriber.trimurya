import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, '../../public/index.html');

if (!fs.existsSync(indexPath)) {
  console.error(`Frontend build missing: ${indexPath}`);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
const assetsDir = path.resolve(__dirname, '../../public/assets');
const hasAssets = fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).some((file) => /\.(js|css)$/.test(file));

if (!html.includes('/assets/') || !hasAssets) {
  console.error('Frontend build must include backend/public/index.html and backend/public/assets/*.js/css.');
  process.exit(1);
}

console.log(`Frontend build verified: ${indexPath}`);
