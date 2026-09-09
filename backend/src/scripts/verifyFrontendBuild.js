import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const candidates = [
  path.resolve(root, 'frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist')
];

const dist = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));
const assets = dist ? path.join(dist, 'assets') : '';
const hasAssets = assets && fs.existsSync(assets) && fs.readdirSync(assets).some((file) => /\.(js|css)$/.test(file));

if (!dist || !hasAssets) {
  console.error('Frontend build missing. Expected frontend/dist/index.html and frontend/dist/assets/*.js/css.');
  process.exit(1);
}

console.log(`Frontend build verified: ${dist}`);
