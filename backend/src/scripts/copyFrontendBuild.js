import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceCandidates = [
  path.resolve(__dirname, '../../../frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist')
];
const target = path.resolve(__dirname, '../../public');
const source = sourceCandidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));

if (!source) {
  console.error('Frontend build not found. Expected frontend/dist/index.html.');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });

console.log(`Frontend build copied to ${target}`);
