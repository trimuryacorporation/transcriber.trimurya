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
if (!html.includes('<style>') || !html.includes('<script type="module">')) {
  console.error('Frontend build must inline CSS and JS into backend/public/index.html.');
  process.exit(1);
}

console.log(`Frontend build verified: ${indexPath}`);
