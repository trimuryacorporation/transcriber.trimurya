import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../../public');
const indexPath = path.join(publicDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error(`Frontend index not found at ${indexPath}`);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(
  /<link rel="stylesheet" crossorigin href="\/assets\/([^"]+\.css)">/g,
  (_tag, fileName) => {
    const cssPath = path.join(publicDir, 'assets', fileName);
    if (!fs.existsSync(cssPath)) throw new Error(`CSS asset not found: ${cssPath}`);
    return `<style>${fs.readFileSync(cssPath, 'utf8')}</style>`;
  }
);

html = html.replace(
  /<script type="module" crossorigin src="\/assets\/([^"]+\.js)"><\/script>/g,
  (_tag, fileName) => {
    const jsPath = path.join(publicDir, 'assets', fileName);
    if (!fs.existsSync(jsPath)) throw new Error(`JS asset not found: ${jsPath}`);
    return `<script type="module">${fs.readFileSync(jsPath, 'utf8')}</script>`;
  }
);

fs.writeFileSync(indexPath, html);
console.log(`Frontend assets inlined into ${indexPath}`);
